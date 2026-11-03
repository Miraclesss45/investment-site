import assert from "node:assert/strict";
import test from "node:test";
import { buildDepositEmailContent } from "../server/deposit-mailer.js";

for (const kind of ["pending", "successful"]) {
  for (const wallet of ["ethereum-wallet-address-must-not-leak", undefined]) {
    test(`${kind} deposit email always shows the provided-address placeholder`, () => {
      const content = buildDepositEmailContent(kind, {
        amount: 125,
        creditedAmount: 125,
        method: "Ethereum",
        plan: "Starter",
        wallet,
      }, "deposit-test-id");

      assert.match(content.text, /Provided address: n\/a/);
      assert.match(content.text, /MeridianVests/);
      assert.match(content.html, /Provided address/);
      assert.match(content.html, />n\/a</);
      if (wallet) {
        assert.doesNotMatch(content.text, new RegExp(wallet));
        assert.doesNotMatch(content.html, new RegExp(wallet));
      }
    });
  }
}

test("pending deposit email clearly says the request is under review and not yet credited", () => {
  const content = buildDepositEmailContent("pending", {
    amount: 125,
    method: "Ethereum",
    plan: "Starter",
  }, "deposit-test-id");

  assert.match(content.text, /received your deposit request for \$125\.00/i);
  assert.match(content.text, /under review/i);
  assert.match(content.text, /has not been credited yet/i);
});

test("successful deposit email confirms credit without guaranteeing promotional returns", () => {
  const content = buildDepositEmailContent("successful", {
    amount: 125,
    creditedAmount: 125,
    method: "Ethereum",
    plan: "Promo Mini Plan",
    displayName: "Anele Iuhabe",
  }, "deposit-test-id");

  assert.match(content.text, /Congratulations, Anele Iuhabe!/);
  assert.match(content.text, /has been credited/i);
  assert.match(content.text, /investment term has started/i);
  assert.match(content.text, /returns are not guaranteed/i);
});

test("successful deposit email falls back to the username when display name is unavailable", () => {
  const content = buildDepositEmailContent("successful", {
    amount: 125,
    creditedAmount: 125,
    method: "Ethereum",
    plan: "Starter",
    username: "anele",
  }, "deposit-test-id");

  assert.match(content.text, /Congratulations, anele!/);
  assert.match(content.html, /Congratulations, anele!/);
});
