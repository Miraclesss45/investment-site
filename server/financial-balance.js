import { AggregateField } from "firebase-admin/firestore";
import { calculateWithdrawableBalance, finiteMoney, hasStoredNonNegativeNumber, nonNegativeMoney, roundMoney } from "../src/lib/financialMath.js";

const TRANSACTION_TYPES = {
  totalDeposit: ["deposit", "Deposit", "investment", "Investment"],
  totalWithdrawal: ["withdrawal", "Withdrawal", "payout", "Payout"],
  totalEarnings: ["earning", "profit"],
};

function hasStoredTotal(profile, field) {
  return hasStoredNonNegativeNumber(profile[field]);
}

async function getLegacyTransactionTotal(db, userId, types, transaction) {
  const query = db.collection("users").doc(userId).collection("transactions")
    .where("type", "in", types);
  if (transaction) {
    const snapshot = await transaction.get(query);
    return snapshot.docs.reduce((total, item) => roundMoney(total + nonNegativeMoney(item.data().amount)), 0);
  }
  const snapshot = await query.aggregate({ amount: AggregateField.sum("amount") }).get();
  return nonNegativeMoney(snapshot.data().amount);
}

export async function getFinancialTotalsForProfile(db, userId, profile, transaction) {
  const [entries, activePrincipal] = await Promise.all([
    Promise.all(Object.entries(TRANSACTION_TYPES).map(async ([field, types]) => [
      field,
      hasStoredTotal(profile, field)
        ? nonNegativeMoney(profile[field])
        : await getLegacyTransactionTotal(db, userId, types, transaction),
    ])),
    hasStoredTotal(profile, "activeInvestmentPrincipal")
      ? Promise.resolve(nonNegativeMoney(profile.activeInvestmentPrincipal))
      : (transaction
        ? transaction.get(db.collection("users").doc(userId).collection("investments").where("status", "==", "active"))
        : db.collection("users").doc(userId).collection("investments").where("status", "==", "active").get())
        .then((snapshot) => snapshot.docs.reduce((total, item) => {
          const principal = item.data().principal;
          if (!hasStoredNonNegativeNumber(principal)) {
            throw new Error(`Active investment ${item.id} has an invalid principal.`);
          }
          return roundMoney(total + nonNegativeMoney(principal));
        }, 0)),
  ]);
  return {
    ...Object.fromEntries(entries),
    activeInvestmentPrincipal: activePrincipal,
  };
}

/** Keep server-side withdrawal checks aligned with member dashboard fallbacks. */
export async function getWithdrawableBalanceForProfile(db, userId, profile, transaction) {
  const totals = await getFinancialTotalsForProfile(db, userId, profile, transaction);
  const balance = calculateWithdrawableBalance({
    totalDeposit: totals.totalDeposit,
    totalEarnings: totals.totalEarnings,
    totalWithdrawal: totals.totalWithdrawal,
    adminBalanceAdjustment: finiteMoney(profile.adminBalanceAdjustment) + nonNegativeMoney(profile.promotionalCredit),
  });
  return {
    ...totals,
    balance: roundMoney(balance),
  };
}

export async function getPendingWithdrawalAmountForProfile(db, userId, profile, transaction) {
  if (hasStoredTotal(profile, "pendingWithdrawalAmount")) {
    return nonNegativeMoney(profile.pendingWithdrawalAmount);
  }
  const query = db.collection("users").doc(userId).collection("withdrawals");
  const snapshot = transaction ? await transaction.get(query) : await query.get();
  return snapshot.docs.reduce((total, item) => {
    const withdrawal = item.data();
    if (!["pending", "on-hold", "approved"].includes(String(withdrawal.status || "pending").toLowerCase())) return total;
    if (!hasStoredNonNegativeNumber(withdrawal.amount)) {
      throw new Error(`Active withdrawal ${item.id} has an invalid amount.`);
    }
    return roundMoney(total + nonNegativeMoney(withdrawal.amount));
  }, 0);
}
