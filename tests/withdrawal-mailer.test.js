import assert from "node:assert/strict";
import test from "node:test";
import { buildWithdrawalEmailContent } from "../server/withdrawal-mailer.js";

for (const kind of ["processing", "completed"]) {
  for (const wallet of ["bitcoin-wallet-address-must-not-leak", undefined]) {
    test(`${kind} withdrawal email always shows the provided-address placeholder`, () => {
      const content = buildWithdrawalEmailContent({
        kind,
        withdrawal: {
          amount: 125,
          method: "Bitcoin",
          wallet,
          transactionBatch: "private-transaction-batch",
        },
      });

      assert.match(content.text, /Provided address: n\/a/);
      assert.match(content.text, /Transaction batch: n\/a/);
      assert.match(content.html, /Provided address/);
      assert.match(content.html, /Transaction batch/);
      assert.match(content.html, />n\/a</);
      if (wallet) {
        assert.doesNotMatch(content.text, new RegExp(wallet));
        assert.doesNotMatch(content.html, new RegExp(wallet));
      }
      assert.doesNotMatch(content.text, /private-transaction-batch/);
      assert.doesNotMatch(content.html, /private-transaction-batch/);
      assert.doesNotMatch(content.text, /check your wallet/i);
    });
  }
}

test("completed withdrawal email clearly reports the recorded payout status", () => {
  const content = buildWithdrawalEmailContent({
    kind: "completed",
    withdrawal: {
      amount: 500,
      method: "Bitcoin",
      wallet: "private-wallet-address",
      transactionBatch: "private-transaction-batch",
      displayName: "Anele Iuhabe",
    },
  });

  assert.equal(content.emailState.heading, "WITHDRAWAL SUCCESSFUL");
  assert.match(content.text, /Congratulations, Anele Iuhabe!/);
  assert.match(content.text, /withdrawal request for \$500\.00 has been marked as completed/i);
  assert.match(content.text, /recorded the payout as sent using your selected method/i);
  assert.match(content.text, /destination address and transaction batch are shown as n\/a/i);
  assert.match(content.text, /Transaction method: Bitcoin/);
  assert.doesNotMatch(content.text, /private-wallet-address/);
  assert.doesNotMatch(content.text, /private-transaction-batch/);
  assert.match(content.html, /cid:meridianvest-logo/);
  assert.match(content.html, /background:#e5e5e5/);
});

test("completed withdrawal email falls back to the username when display name is unavailable", () => {
  const content = buildWithdrawalEmailContent({
    kind: "completed",
    withdrawal: {
      amount: 500,
      method: "Bitcoin",
      username: "anele",
    },
  });

  assert.match(content.text, /Congratulations, anele!/);
  assert.match(content.html, /Congratulations, anele!/);
});