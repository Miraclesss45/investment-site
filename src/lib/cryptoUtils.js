export function safeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function hasUsableMarketPrice(price) {
  const numericPrice = safeNumber(price, 0);
  return numericPrice > 0;
}

export function getAssetAllocation(allocations = {}, symbol, fallback = 0) {
  return Math.max(safeNumber(allocations?.[symbol], 0), fallback);
}

export function getActiveAssetAllocation({ allocations = {}, symbol, baseAllocation = 0 }) {
  return Math.max(baseAllocation, getAssetAllocation(allocations, symbol, 0));
}
