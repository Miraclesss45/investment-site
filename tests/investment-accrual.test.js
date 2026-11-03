import assert from "node:assert/strict";
import test from "node:test";
import { getPrincipalReturnAtMaturity } from "../server/investment-accrual.js";

test("maturity returns only principal not already paid out early", () => {
  assert.equal(getPrincipalReturnAtMaturity({ principal: 1000, principalWithdrawn: 350 }), 650);
});

test("maturity still returns all principal when there was no early withdrawal", () => {
  assert.equal(getPrincipalReturnAtMaturity({ principal: 1000 }), 1000);
});

test("maturity rejects withdrawn principal greater than the investment principal", () => {
  assert.throws(
    () => getPrincipalReturnAtMaturity({ principal: 1000, principalWithdrawn: 1001 }),
    /invalid principal withdrawal data/,
  );
});
