import assert from "node:assert/strict";
import test from "node:test";
import { allocateInvestmentPrincipalWithdrawal, calculateMemberWithdrawalBalances, calculateWithdrawableBalance, hasStoredNonNegativeInteger, hasStoredNonNegativeNumber } from "../src/lib/financialMath.js";

test("active investment principal is available for withdrawal without changing package terms", () => {
  assert.equal(calculateWithdrawableBalance({
    totalDeposit: 1000,
    totalEarnings: 350,
    totalWithdrawal: 100,
    activeInvestmentPrincipal: 500,
    adminBalanceAdjustment: 0,
  }), 1250);
});

test("withdrawal totals still cannot make the withdrawable balance negative", () => {
  assert.equal(calculateWithdrawableBalance({
    totalDeposit: 100,
    totalEarnings: 0,
    totalWithdrawal: 75,
    activeInvestmentPrincipal: 50,
    adminBalanceAdjustment: 0,
  }), 25);
});

test("administrator fund credits increase the withdrawable balance", () => {
  assert.equal(calculateWithdrawableBalance({
    totalDeposit: 100,
    totalEarnings: 25,
    totalWithdrawal: 10,
    activeInvestmentPrincipal: 40,
    adminBalanceAdjustment: 75,
  }), 190);
});

test("pending withdrawals stay in displayed balance but reduce the amount requestable", () => {
  assert.deepEqual(calculateMemberWithdrawalBalances({
    totalDeposit: 500,
    totalEarnings: 100,
    totalWithdrawal: 50,
    adminBalanceAdjustment: 0,
    pendingWithdrawalAmount: 125,
  }), {
    withdrawableBalance: 550,
    withdrawalRequestableBalance: 425,
  });
});

test("completed withdrawals reduce displayed funds while released reservations do not reduce requestable funds twice", () => {
  assert.deepEqual(calculateMemberWithdrawalBalances({
    totalDeposit: 500,
    totalEarnings: 100,
    totalWithdrawal: 175,
    adminBalanceAdjustment: 0,
    pendingWithdrawalAmount: 0,
  }), {
    withdrawableBalance: 425,
    withdrawalRequestableBalance: 425,
  });
});

test("early withdrawal allocates principal without changing an investment's profit basis", () => {
  const result = allocateInvestmentPrincipalWithdrawal([
    { id: "later", principal: 100, principalWithdrawn: 25, startedAt: "2026-02-01T00:00:00Z" },
    { id: "earlier", principal: 80, startedAt: "2026-01-01T00:00:00Z" },
  ], 100);
  assert.deepEqual(result, {
    allocations: [
      { id: "earlier", principalWithdrawn: 80, amount: 80 },
      { id: "later", principalWithdrawn: 45, amount: 20 },
    ],
    amountAllocated: 100,
  });
});

test("blank, null, malformed, and negative stored totals are not authoritative", () => {
  for (const value of [null, undefined, "", "   ", "not-money", -1, Number.NaN, Number.POSITIVE_INFINITY, true]) {
    assert.equal(hasStoredNonNegativeNumber(value), false, `expected ${String(value)} to be missing or invalid`);
  }
  assert.equal(hasStoredNonNegativeNumber(0), true);
  assert.equal(hasStoredNonNegativeNumber("12.50"), true);
});

test("stored referral counts must be nonnegative whole numbers", () => {
  assert.equal(hasStoredNonNegativeInteger(0), true);
  assert.equal(hasStoredNonNegativeInteger("12"), true);
  assert.equal(hasStoredNonNegativeInteger(1.5), false);
  assert.equal(hasStoredNonNegativeInteger(""), false);
  assert.equal(hasStoredNonNegativeInteger(null), false);
});
