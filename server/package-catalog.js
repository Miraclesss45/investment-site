import { parseInvestmentDurationHours } from "./investment-accrual.js";

const MINIMUM_DEPOSIT = 35;
const PROMO_MINI_MINIMUM = 1000;
const PROMO_MINI_MAXIMUM = 4999.99;
const PROMO_MEGA_MINIMUM = 5000;
const PROMO_DURATION = "24 Hours";
export const MAX_DAILY_RETURN_RATE = 35;

export const DEFAULT_PACKAGE_CATALOG = [
  { id: "default-2-5-daily-14-days", name: "2.5% Daily for 14 Days", minimum: MINIMUM_DEPOSIT, maximum: null, returnRate: 2.5, duration: "14 Days", description: "Simple daily profit is calculated on the original investment. Profit unlocks at maturity." },
  { id: "default-10-daily-14-days", name: "10% Daily for 14 Days", minimum: MINIMUM_DEPOSIT, maximum: null, returnRate: 10, duration: "14 Days", description: "Simple daily profit is calculated on the original investment. Profit unlocks at maturity." },
  { id: "default-20-daily-14-days", name: "20% Daily for 14 Days", minimum: MINIMUM_DEPOSIT, maximum: null, returnRate: 20, duration: "14 Days", description: "Simple daily profit is calculated on the original investment. Profit unlocks at maturity." },
  { id: "default-35-daily-14-days", name: "35% Daily for 14 Days", minimum: MINIMUM_DEPOSIT, maximum: null, returnRate: 35, duration: "14 Days", description: "Simple daily profit is calculated on the original investment. Profit unlocks at maturity." },
  { id: "default-promo-mini-plan", name: "PROMO MINI PLAN", minimum: PROMO_MINI_MINIMUM, maximum: PROMO_MINI_MAXIMUM, returnRate: null, duration: PROMO_DURATION, description: "100% profit after 24 hours. The investment plus profit equals 2× the original amount; the term starts when an administrator confirms the credit." },
  { id: "default-promo-mega-plan", name: "PROMO MEGA PLAN", minimum: PROMO_MEGA_MINIMUM, maximum: null, returnRate: null, duration: PROMO_DURATION, description: "500% profit after 24 hours. The investment plus profit equals 6× the original amount; the term starts when an administrator confirms the credit." },
];

function numericValue(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function promoLimits(name) {
  const normalizedName = String(name || "").trim().toUpperCase();
  if (normalizedName === "PROMO MINI PLAN") return { minimum: PROMO_MINI_MINIMUM, maximum: PROMO_MINI_MAXIMUM };
  if (normalizedName === "PROMO MEGA PLAN") return { minimum: PROMO_MEGA_MINIMUM, maximum: null };
  return null;
}

export function isFixedPromoPackage(name) {
  return promoLimits(name) !== null;
}

export function isValidDailyReturnRate(name, value) {
  const rate = numericValue(value);
  return rate !== null
    && rate >= 0
    && (isFixedPromoPackage(name) || rate <= MAX_DAILY_RETURN_RATE);
}

export function normalizePackageRecord(id, data = {}) {
  const name = String(data.name || data.title || "").trim().slice(0, 120);
  if (!name) return null;
  const limits = promoLimits(name);
  return {
    id,
    name,
    description: limits
      ? DEFAULT_PACKAGE_CATALOG.find((item) => item.name === name.toUpperCase())?.description || ""
      : typeof data.description === "string" && data.description.trim()
        ? data.description.slice(0, 1000)
        : "Simple daily profit is calculated on the original investment. Profit unlocks at maturity.",
    minimum: limits?.minimum ?? Math.max(MINIMUM_DEPOSIT, numericValue(data.minimum) ?? 0),
    maximum: limits ? limits.maximum : numericValue(data.maximum) > 0 ? numericValue(data.maximum) : null,
    returnRate: limits ? null : numericValue(data.returnRate ?? data.rate),
    duration: limits ? PROMO_DURATION : typeof data.duration === "string" ? data.duration.slice(0, 120) : "",
  };
}

export async function getPublicPackageCatalog(db) {
  const snapshot = await db.collection("packages").get();
  if (snapshot.empty) return DEFAULT_PACKAGE_CATALOG;

  const items = snapshot.docs
    .filter((document) => {
      const data = document.data();
      return !["disabled", "inactive", "hidden"].includes(String(data.status || "active").toLowerCase())
        && data.enabled !== false;
    })
    .map((document) => normalizePackageRecord(document.id, document.data()))
    .filter(Boolean);
  const catalogNames = new Set(snapshot.docs.map((document) => (
    String(document.data().name || document.data().title || "").trim().toUpperCase()
  )).filter(Boolean));
  for (const promo of DEFAULT_PACKAGE_CATALOG.filter((item) => item.name.startsWith("PROMO "))) {
    if (!catalogNames.has(promo.name)) items.push(promo);
  }
  return items.sort((left, right) => left.name.localeCompare(right.name));
}

export function createPackageTermsSnapshot(item, capturedAt) {
  const limits = promoLimits(item.name);
  const duration = limits ? PROMO_DURATION : String(item.duration || "").trim();
  const durationHours = limits ? 24 : parseInvestmentDurationHours(duration);
  if (!durationHours) {
    throw Object.assign(new Error("This package has no valid duration configured."), {
      statusCode: 409,
      code: "package-duration-not-configured",
    });
  }

  const dailyRate = limits ? null : numericValue(item.returnRate);
  if (!limits && (!dailyRate || dailyRate <= 0 || dailyRate > MAX_DAILY_RETURN_RATE)) {
    throw Object.assign(new Error(`This package must have a daily profit rate greater than 0% and no more than ${MAX_DAILY_RETURN_RATE}%.`), {
      statusCode: 409,
      code: "package-rate-not-configured",
    });
  }

  return {
    version: 1,
    packageId: String(item.id),
    name: String(item.name),
    minimum: limits?.minimum ?? Math.max(MINIMUM_DEPOSIT, numericValue(item.minimum) ?? 0),
    maximum: limits ? limits.maximum : numericValue(item.maximum) > 0 ? numericValue(item.maximum) : null,
    dailyRate,
    profitPercent: item.name.trim().toUpperCase() === "PROMO MINI PLAN" ? 100
      : item.name.trim().toUpperCase() === "PROMO MEGA PLAN" ? 500 : null,
    duration,
    durationHours,
    capturedAt,
  };
}
