import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { hasStoredNonNegativeNumber, nonNegativeMoney, roundMoney } from "../src/lib/financialMath.js";
import { requireVerifiedUser } from "../server/auth.js";
import { getWithdrawableBalanceForProfile } from "../server/financial-balance.js";
import { getFirebaseAdminApp } from "../server/withdrawal-mailer.js";
import { processDueInvestmentsForUser } from "../server/investment-accrual.js";

const MINIMUM_WITHDRAWAL = 35;
const ACTIVE_STATUSES = new Set(["pending", "on-hold", "approved"]);
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{16,100}$/;
const WALLET_FIELDS = {
  Litecoin: "litecoinWallet",
  Bitcoin: "bitcoinWallet",
  Ethereum: "ethereumWallet",
};

function sendJson(res, statusCode, body) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  return res.status(statusCode).json(body);
}

function parseBody(body) {
  if (body === undefined || body === null || body === "") return {};
  return typeof body === "string" ? JSON.parse(body) : body;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed." });

  let app;
  let token;
  try {
    app = getFirebaseAdminApp();
    token = await requireVerifiedUser(req, app);
  } catch (error) {
    if (error?.message === "Firebase service account is not configured.") {
      return sendJson(res, 503, { error: "Withdrawal requests are temporarily unavailable.", code: "firebase-not-configured" });
    }
    return sendJson(res, error.statusCode || 401, { error: error.message || "Authentication token is invalid or expired.", code: error.code || "auth-invalid" });
  }

  let body;
  try {
    body = parseBody(req.body);
  } catch {
    return sendJson(res, 400, { error: "Invalid request body." });
  }

  const submittedAmount = Number(body.amount);
  const amount = roundMoney(submittedAmount);
  const method = String(body.method || "").trim();
  const wallet = String(body.wallet || "").trim();
  const idempotencyKey = String(body.idempotencyKey || "").trim();
  if (!Number.isFinite(submittedAmount) || Math.abs(submittedAmount - amount) > 1e-8 || amount < MINIMUM_WITHDRAWAL || amount > 100000000) {
    return sendJson(res, 400, { error: "The minimum withdrawal is $35. Enter a valid amount with no more than two decimal places." });
  }
  const walletField = WALLET_FIELDS[method];
  if (!walletField || wallet.length > 200) {
    return sendJson(res, 400, { error: "Select a supported payout asset. A wallet address is optional." });
  }
  if (!IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
    return sendJson(res, 400, { error: "Refresh the withdrawal form and submit again.", code: "invalid-idempotency-key" });
  }

  try {
    const db = getFirestore(app);
    // Daily cron runs at a fixed hour. Settle this member's matured packages
    // on demand so a completed term is withdrawable immediately.
    await processDueInvestmentsForUser(db, token.uid);
    const profileRef = db.collection("users").doc(token.uid);
    const withdrawalsRef = profileRef.collection("withdrawals");
    const withdrawalRef = withdrawalsRef.doc(`request_${idempotencyKey}`);
    const result = await db.runTransaction(async (transaction) => {
      const existingRequest = await transaction.get(withdrawalRef);
      if (existingRequest.exists) {
        const existing = existingRequest.data();
        if (existing.idempotencyKey !== idempotencyKey
          || Number(existing.amount) !== amount
          || String(existing.method || "") !== method
          || String(existing.wallet || "") !== wallet) {
          throw Object.assign(new Error("This submission key was already used for a different withdrawal. Refresh the form before submitting a new request."), {
            statusCode: 409,
            code: "idempotency-key-conflict",
          });
        }
        return { id: existingRequest.id, idempotent: true };
      }
      const profileSnapshot = await transaction.get(profileRef);
      if (!profileSnapshot.exists) {
        throw Object.assign(new Error("Your account profile could not be found."), { statusCode: 404 });
      }

      const profile = profileSnapshot.data();
      if (wallet && String(profile[walletField] || "").trim() !== wallet) {
        throw Object.assign(new Error("The payout wallet must match the saved wallet for this asset."), { statusCode: 400 });
      }
      let reserved;
      if (hasStoredNonNegativeNumber(profile.pendingWithdrawalAmount)) {
        reserved = roundMoney(Number(profile.pendingWithdrawalAmount));
      } else {
        // One-time compatibility path for older profiles without a reservation total.
        const requestsSnapshot = await transaction.get(withdrawalsRef);
        reserved = requestsSnapshot.docs.reduce((sum, request) => {
          const data = request.data();
          if (!ACTIVE_STATUSES.has(String(data.status || "pending").toLowerCase())) return sum;
          if (!hasStoredNonNegativeNumber(data.amount)) {
            throw Object.assign(new Error("An existing pending withdrawal has an invalid amount. Contact support before retrying."), {
              statusCode: 409,
              code: "pending-withdrawal-data-invalid",
            });
          }
          return roundMoney(sum + nonNegativeMoney(data.amount));
        }, 0);
      }
      const { balance: available } = await getWithdrawableBalanceForProfile(db, token.uid, profile, transaction);
      const remaining = roundMoney(Math.max(available - reserved, 0));
      if (amount > remaining) {
        throw Object.assign(new Error(`This request exceeds your withdrawable balance of $${remaining.toFixed(2)} after pending requests.`), { statusCode: 409, code: "insufficient-withdrawable-balance" });
      }

      transaction.create(withdrawalRef, {
        idempotencyKey,
        amount,
        currency: "USD",
        method,
        wallet,
        email: token.email || "",
        status: "pending",
        createdAt: FieldValue.serverTimestamp(),
      });
      transaction.update(profileRef, {
        pendingWithdrawalAmount: roundMoney(reserved + amount),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { id: withdrawalRef.id, remainingBalance: roundMoney(remaining - amount) };
    });
    return sendJson(res, result.idempotent ? 200 : 201, result);
  } catch (error) {
    if (error?.statusCode) return sendJson(res, error.statusCode, { error: error.message, code: error.code || "withdrawal-request-invalid" });
    console.error("create-withdrawal-request failed", error);
    return sendJson(res, 500, { error: "The withdrawal request could not be saved." });
  }
}
