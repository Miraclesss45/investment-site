const MINI_MINIMUM = 1000;
const MEGA_THRESHOLD = 5000;
const PROMO_DURATION_MS = 24 * 60 * 60 * 1000;

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function getPromoTermsForAmount(amount) {
  const investment = Number(amount);
  if (!Number.isFinite(investment) || investment < MINI_MINIMUM) return null;

  // Mega takes priority at the shared $5,000 threshold.
  const isMega = investment >= MEGA_THRESHOLD;
  const profitPercent = isMega ? 500 : 100;
  const profit = roundMoney(investment * profitPercent / 100);

  return {
    planName: isMega ? "PROMO MEGA PLAN" : "PROMO MINI PLAN",
    minimum: isMega ? MEGA_THRESHOLD : MINI_MINIMUM,
    maximum: isMega ? null : MEGA_THRESHOLD - 0.01,
    profitPercent,
    investment,
    profit,
    total: roundMoney(investment + profit),
    durationMs: PROMO_DURATION_MS,
  };
}
