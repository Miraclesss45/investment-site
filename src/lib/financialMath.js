export function getPaperTradingCapital(profile) {
  if (!profile?.paperTrading?.enabled) return 0;
  return Object.values(profile.paperTrading.allocations || {})
    .reduce((sum, amount) => sum + Math.max(Number(amount) || 0, 0), 0);
}

export function sumCompletedLedgerTransactions(transactions) {
  return transactions.reduce((totals, transaction) => {
    const status = String(transaction.status || "completed").toLowerCase();
    const type = String(transaction.type || "").toLowerCase();
    if (
      type === "paper-trading-valuation" ||
      !["completed", "complete", "approved", "settled", "success"].includes(status)
    ) {
      return totals;
    }
    const amount = Math.max(Number(transaction.amount) || 0, 0);
    if (type.includes("deposit") || type.includes("credit") || type.includes("investment")) {
      totals.totalDeposit += amount;
    }
    if (type.includes("withdraw") || type.includes("debit") || type.includes("payout")) {
      totals.totalWithdrawal += amount;
    }
    return totals;
  }, { totalDeposit: 0, totalWithdrawal: 0 });
}

export function calculateWithdrawableBalance({
  totalDeposit,
  totalEarnings,
  totalWithdrawal,
  commission,
  paperTradingWithdrawals,
  paperTradingCapital,
}) {
  const nonTradingWithdrawals = Math.max(
    (Number(totalWithdrawal) || 0) - (Number(paperTradingWithdrawals) || 0),
    0,
  );
  const cashBalance = Math.max(
    (Number(totalDeposit) || 0)
      + (Number(totalEarnings) || 0)
      - nonTradingWithdrawals
      - (Number(commission) || 0),
    0,
  );
  return cashBalance + Math.max(Number(paperTradingCapital) || 0, 0);
}
