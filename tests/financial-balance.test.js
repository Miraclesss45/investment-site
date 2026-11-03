import assert from "node:assert/strict";
import test from "node:test";
import {
  getPendingWithdrawalAmountForProfile,
  getWithdrawableBalanceForProfile,
} from "../server/financial-balance.js";

function makeLegacyAccountDb() {
  const transactionTotals = new Map([
    ["deposit,Deposit,investment,Investment", 1000],
    ["withdrawal,Withdrawal,payout,Payout", 50],
    ["earning,profit", 100],
  ]);
  const collections = {
    transactions: {
      where(_field, _operator, types) {
        return {
          aggregate() {
            return {
              async get() {
                return { data: () => ({ amount: transactionTotals.get(types.join(",")) }) };
              },
            };
          },
        };
      },
    },
    investments: {
      where() {
        return {
          async get() {
            return { docs: [{ id: "active-1", data: () => ({ principal: 400 }) }] };
          },
        };
      },
    },
    withdrawals: {
      async get() {
        return {
          docs: [
            { id: "pending-1", data: () => ({ amount: 25, status: "pending" }) },
            { id: "approved-1", data: () => ({ amount: 10, status: "approved" }) },
            { id: "rejected-1", data: () => ({ amount: 90, status: "rejected" }) },
          ],
        };
      },
    },
  };
  return {
    collection(name) {
      assert.equal(name, "users");
      return {
        doc() {
          return {
            collection(name) {
              return collections[name];
            },
          };
        },
      };
    },
  };
}

test("legacy member totals are rebuilt when stored financial fields are blank", async () => {
  const totals = await getWithdrawableBalanceForProfile(
    makeLegacyAccountDb(),
    "member-1",
    { totalDeposit: null, totalEarnings: "", totalWithdrawal: -1, activeInvestmentPrincipal: null },
  );
  assert.deepEqual(totals, {
    totalDeposit: 1000,
    totalWithdrawal: 50,
    totalEarnings: 100,
    activeInvestmentPrincipal: 400,
    balance: 1050,
  });
});

test("previous administrator promotional credits are withdrawable", async () => {
  const totals = await getWithdrawableBalanceForProfile(
    {},
    "member-1",
    {
      totalDeposit: 0,
      totalEarnings: 0,
      totalWithdrawal: 0,
      activeInvestmentPrincipal: 0,
      adminBalanceAdjustment: 0,
      promotionalCredit: 75,
    },
  );
  assert.equal(totals.balance, 75);
});

test("legacy pending withdrawals include only reserved statuses", async () => {
  assert.equal(
    await getPendingWithdrawalAmountForProfile(makeLegacyAccountDb(), "member-1", { pendingWithdrawalAmount: null }),
    35,
  );
});
