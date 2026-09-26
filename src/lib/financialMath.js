export function getPaperTradingCapital(profile) {
  if (!profile?.paperTrading?.enabled) return 0;
  return Object.values(profile.paperTrading.allocations || {})
    .reduce((sum, amount) => sum + Math.max(Number(amount) || 0, 0), 0);
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
