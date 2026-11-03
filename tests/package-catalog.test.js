import assert from "node:assert/strict";
import test from "node:test";
import {
  createPackageTermsSnapshot,
  isValidDailyReturnRate,
  MAX_DAILY_RETURN_RATE,
} from "../server/package-catalog.js";

test("custom daily return rates are capped at the highest built-in daily rate", () => {
  assert.equal(MAX_DAILY_RETURN_RATE, 35);
  assert.equal(isValidDailyReturnRate("Custom plan", 35), true);
  assert.equal(isValidDailyReturnRate("Custom plan", 35.01), false);
  assert.equal(isValidDailyReturnRate("Custom plan", -1), false);
});

test("fixed promotional packages retain their configured 100% and 500% terms", () => {
  assert.equal(isValidDailyReturnRate("PROMO MINI PLAN", 100), true);
  assert.equal(isValidDailyReturnRate("PROMO MEGA PLAN", 500), true);
  const mini = createPackageTermsSnapshot({
    id: "mini",
    name: "PROMO MINI PLAN",
    returnRate: 100,
    minimum: 1000,
    maximum: 4999.99,
  }, new Date());
  const mega = createPackageTermsSnapshot({
    id: "mega",
    name: "PROMO MEGA PLAN",
    returnRate: 500,
    minimum: 5000,
    maximum: null,
  }, new Date());
  assert.equal(mini.profitPercent, 100);
  assert.equal(mini.durationHours, 24);
  assert.equal(mega.profitPercent, 500);
  assert.equal(mega.durationHours, 24);
});

test("custom package term snapshots reject rates above the configured cap", () => {
  assert.throws(() => createPackageTermsSnapshot({
    id: "custom",
    name: "Custom plan",
    returnRate: 35.01,
    minimum: 35,
    duration: "14 Days",
  }, new Date()), /no more than 35%/i);
});
