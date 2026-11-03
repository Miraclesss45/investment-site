export function finiteMoney(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

export function nonNegativeMoney(value) {
  return Math.max(finiteMoney(value), 0);
}

export function hasStoredNonNegativeNumber(value) {
  if (typeof value !== "number" && typeof value !== "string") return false;
  if (typeof value === "string" && value.trim() === "") return false;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0;
}

export function hasStoredNonNegativeInteger(value) {
  if (!hasStoredNonNegativeNumber(value)) return false;
  return Number.isInteger(Number(value));
}

export function roundMoney(value) {
  const amount = finiteMoney(value);
  const epsilon = Number.EPSILON * Math.max(1, Math.abs(amount));
  return Math.round((amount + Math.sign(amount) * epsilon) * 100) / 100;
}

export function sumCompletedLedgerTransactions(transactions) {
  return transactions.reduce((totals, transaction) => {
    const status = String(transaction.status || "completed").toLowerCase();
    const type = String(transaction.type || "").toLowerCase();
    const category = String(transaction.category || "").toLowerCase();
    if (
      !["completed", "complete", "approved", "settled", "success"].includes(status)
      || ["admin-adjustment", "promotional-credit"].includes(category)
      || /admin|earning|profit|referral|commission|bonus/.test(type)
    ) {
      return totals;
    }
    const amount = nonNegativeMoney(transaction.amount);
    if (type.includes("deposit") || type === "credit" || type === "investment") {
      totals.totalDeposit = roundMoney(totals.totalDeposit + amount);
    }
    if (type.includes("withdraw") || type === "debit" || type.includes("payout")) {
      totals.totalWithdrawal = roundMoney(totals.totalWithdrawal + amount);
    }
    return totals;
  }, { totalDeposit: 0, totalWithdrawal: 0 });
}

export function calculateWithdrawableBalance({
  totalDeposit,
  totalEarnings,
  totalWithdrawal,
  adminBalanceAdjustment,
}) {
  return roundMoney(Math.max(
    nonNegativeMoney(totalDeposit)
      + nonNegativeMoney(totalEarnings)
      - nonNegativeMoney(totalWithdrawal)
      + finiteMoney(adminBalanceAdjustment),
    0,
  ));
}

export function calculateMemberWithdrawalBalances({
  totalDeposit,
  totalEarnings,
  totalWithdrawal,
  adminBalanceAdjustment,
  pendingWithdrawalAmount,
}) {
  const withdrawableBalance = calculateWithdrawableBalance({
    totalDeposit,
    totalEarnings,
    totalWithdrawal,
    adminBalanceAdjustment,
  });
  return {
    withdrawableBalance,
    withdrawalRequestableBalance: roundMoney(Math.max(
      withdrawableBalance - nonNegativeMoney(pendingWithdrawalAmount),
      0,
    )),
  };
}

export function allocateInvestmentPrincipalWithdrawal(investments, amount) {
  let remaining = nonNegativeMoney(amount);
  const ordered = [...investments].sort((left, right) => {
    const leftTime = new Date(left.startedAt?.toDate?.() || left.startedAt || 0).getTime() || 0;
    const rightTime = new Date(right.startedAt?.toDate?.() || right.startedAt || 0).getTime() || 0;
    return leftTime - rightTime || String(left.id).localeCompare(String(right.id));
  });
  const allocations = [];

  for (const investment of ordered) {
    const principal = Number(investment.principal);
    const principalWithdrawn = Number(investment.principalWithdrawn || 0);
    if (!Number.isFinite(principal) || principal <= 0
      || !Number.isFinite(principalWithdrawn) || principalWithdrawn < 0
      || principalWithdrawn > principal) {
      throw new Error(`Investment ${investment.id} has invalid principal withdrawal data.`);
    }
    if (remaining <= 0) break;
    const availablePrincipal = roundMoney(principal - principalWithdrawn);
    const withdrawn = roundMoney(Math.min(availablePrincipal, remaining));
    if (withdrawn <= 0) continue;
    allocations.push({
      id: investment.id,
      principalWithdrawn: roundMoney(principalWithdrawn + withdrawn),
      amount: withdrawn,
    });
    remaining = roundMoney(remaining - withdrawn);
  }

  return {
    allocations,
    amountAllocated: roundMoney(nonNegativeMoney(amount) - remaining),
  };
}
