import crypto from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { nonNegativeMoney, roundMoney } from "../src/lib/financialMath.js";
import { getFinancialTotalsForProfile } from "./financial-balance.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_TERM_DAYS = 14;

function getAccrualFailureRef(db, investmentPath) {
  const id = crypto.createHash("sha256").update(investmentPath).digest("hex");
  return db.collection("investmentAccrualFailures").doc(id);
}

export async function recordInvestmentAccrualFailure(db, investmentRef, error) {
  const failureRef = getAccrualFailureRef(db, investmentRef.path);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(failureRef);
    const previous = snapshot.exists ? snapshot.data() : {};
    transaction.set(failureRef, {
      investmentPath: investmentRef.path,
      status: "open",
      attempts: Math.max(Number(previous.attempts) || 0, 0) + 1,
      error: String(error?.message || "Investment accrual failed.").slice(0, 500),
      firstFailedAt: previous.firstFailedAt || FieldValue.serverTimestamp(),
      lastFailedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });
}

export async function resolveInvestmentAccrualFailure(db, investmentRef) {
  try {
    const failureRef = getAccrualFailureRef(db, investmentRef.path);
    const snapshot = await failureRef.get();
    if (!snapshot.exists || snapshot.data().status === "resolved") return;
    await failureRef.set({
      status: "resolved",
      resolvedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    console.error("could not resolve prior investment accrual failure record", { investmentPath: investmentRef.path, error });
  }
}

export function parseInvestmentDurationHours(value) {
  const match = String(value || "").trim().match(/^(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|days?|d|weeks?|w|months?|mos?)$/i);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const unit = match[2].toLowerCase();
  const multiplier = unit.startsWith("h") ? 1
    : unit.startsWith("w") ? 7 * 24
      : unit.startsWith("mo") ? 30 * 24
        : 24;
  const hours = amount * multiplier;
  return Number.isFinite(hours) && hours <= 10 * 365 * 24 ? hours : null;
}

function timestampDate(value) {
  if (typeof value?.toDate === "function") return value.toDate();
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function getPrincipalReturnAtMaturity(investment) {
  const principal = Number(investment?.principal);
  const principalWithdrawn = nonNegativeMoney(investment?.principalWithdrawn);
  if (!Number.isFinite(principal) || principal <= 0 || principalWithdrawn > principal) {
    throw new Error("Investment has invalid principal withdrawal data.");
  }
  return roundMoney(principal - principalWithdrawn);
}

export function getInvestmentMaturityDate(investment) {
  const startedAt = timestampDate(investment?.startedAt);
  if (!startedAt) return null;
  const durationDays = Math.max(Number(investment.durationDays) || DEFAULT_TERM_DAYS, 1);
  const explicitMaturity = timestampDate(investment.maturesAt);
  return explicitMaturity || new Date(startedAt.getTime() + durationDays * DAY_MS);
}

export async function accrueInvestment(db, investmentRef, now = new Date()) {
  const userId = investmentRef.parent.parent?.id;
  if (!userId) return "skipped";
  const profileRef = db.collection("users").doc(userId);
  const earningsRef = profileRef.collection("transactions").doc(`investment-profit-${investmentRef.id}`);

  return db.runTransaction(async (transaction) => {
    const [investmentSnapshot, profileSnapshot, earningsSnapshot] = await Promise.all([
      transaction.get(investmentRef),
      transaction.get(profileRef),
      transaction.get(earningsRef),
    ]);
    if (!investmentSnapshot.exists || !profileSnapshot.exists) return "skipped";
    const investment = investmentSnapshot.data();
    if (investment.status !== "active") return "skipped";
    const startedAt = timestampDate(investment.startedAt);
    const principal = Number(investment.principal);
    const dailyRate = Number(investment.dailyRate);
    const profitPercent = Number(investment.profitPercent);
    const totalProfitTerm = Number.isFinite(profitPercent) && profitPercent > 0;
    const durationDays = Math.max(Number(investment.durationDays) || DEFAULT_TERM_DAYS, 1);
    const maturesAt = getInvestmentMaturityDate(investment);
    if (!startedAt
      || !maturesAt
      || !Number.isFinite(principal)
      || principal <= 0
      || (!totalProfitTerm && (!Number.isFinite(dailyRate) || dailyRate <= 0))) {
      throw new Error(`Investment ${investmentRef.path} has invalid accrual terms.`);
    }

    const elapsedDays = Math.min(durationDays, Math.floor((now.getTime() - startedAt.getTime()) / DAY_MS));
    const matured = now.getTime() >= maturesAt.getTime();
    const alreadyAccruedDays = Math.max(Number(investment.accruedDays) || 0, 0);
    const principalToReturn = getPrincipalReturnAtMaturity(investment);
    if (totalProfitTerm && !matured) return "not-due";
    if (!matured && elapsedDays <= alreadyAccruedDays) return "not-due";
    const accruedProfit = totalProfitTerm
      ? roundMoney(principal * (profitPercent / 100))
      : roundMoney(principal * (dailyRate / 100) * (matured ? durationDays : elapsedDays));
    const profile = profileSnapshot.data();

    if (matured) {
      if (earningsSnapshot.exists) throw new Error(`Maturity ledger entry already exists for ${investmentRef.path}.`);
      const priorTotals = await getFinancialTotalsForProfile(db, userId, profile, transaction);
      transaction.create(earningsRef, {
        type: "earning",
        source: "investment-maturity",
        amount: accruedProfit,
        currency: "USD",
        status: "completed",
        investmentId: investmentRef.id,
        packageName: investment.packageName || "Investment package",
        principal,
        ...(totalProfitTerm ? { profitPercent } : { dailyRate }),
        durationDays,
        durationHours: investment.durationHours || durationDays * 24,
        createdAt: FieldValue.serverTimestamp(),
        completedAt: FieldValue.serverTimestamp(),
      });
      transaction.update(profileRef, {
        totalEarnings: roundMoney(priorTotals.totalEarnings + accruedProfit),
        activeInvestmentPrincipal: roundMoney(Math.max(priorTotals.activeInvestmentPrincipal - principalToReturn, 0)),
        availableBalance: roundMoney(nonNegativeMoney(profile.availableBalance) + principalToReturn + accruedProfit),
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.update(investmentRef, {
        accruedDays: durationDays,
        accruedProfit,
        status: "completed",
        maturedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return "matured";
    }

    transaction.update(investmentRef, {
      accruedDays: elapsedDays,
      accruedProfit,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return "accrued";
  });
}

export async function processDueInvestmentsForUser(db, userId, now = new Date()) {
  const investmentsSnapshot = await db.collection("users").doc(userId)
    .collection("investments")
    .where("status", "==", "active")
    .get();
  let accrued = 0;
  let matured = 0;
  let skipped = 0;
  let notDue = 0;
  let failed = 0;

  for (const investmentDoc of investmentsSnapshot.docs) {
    try {
      const result = await accrueInvestment(db, investmentDoc.ref, now);
      await resolveInvestmentAccrualFailure(db, investmentDoc.ref);
      if (result === "accrued") accrued += 1;
      else if (result === "matured") matured += 1;
      else if (result === "not-due") notDue += 1;
      else skipped += 1;
    } catch (error) {
      failed += 1;
      await recordInvestmentAccrualFailure(db, investmentDoc.ref, error);
      console.error("member investment accrual failed", { investmentPath: investmentDoc.ref.path, error });
    }
  }

  return { accrued, matured, notDue, skipped, failed };
}
