import { cert, getApp as getAdminApp, getApps, initializeApp } from "firebase-admin/app";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { requireVerifiedUser } from "./auth.js";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { parseFirebaseServiceAccount } from "./firebase-service-account.js";

const SUPPORTED = ["BTC", "ETH", "LTC", "BNB"];
const COIN_IDS = { BTC: "bitcoin", ETH: "ethereum", LTC: "litecoin", BNB: "binancecoin" };
const MARKET_TIMEOUT_MS = 8000;

function sendJson(res, statusCode, body) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  return res.status(statusCode).json(body);
}

function getValuationSnapshotId(prices, allocations, entryPrices, currentValue, previousProfit, nextProfit) {
  const snapshot = JSON.stringify({
    prices: Object.fromEntries(SUPPORTED.map((symbol) => [symbol, Number(Number(prices[symbol]).toFixed(8))])),
    allocations: Object.fromEntries(SUPPORTED.map((symbol) => [symbol, Number(Number(allocations[symbol] || 0).toFixed(8))])),
    entryPrices: Object.fromEntries(SUPPORTED.map((symbol) => [symbol, Number(Number(entryPrices[symbol] || 0).toFixed(8))])),
    currentValue: Number(currentValue.toFixed(8)),
    previousProfit: Number(previousProfit.toFixed(8)),
    nextProfit: Number(nextProfit.toFixed(8)),
  });
  return createHash("sha256").update(snapshot).digest("hex").slice(0, 32);
}

function getApp() {
  if (getApps().length) return getAdminApp();
  let raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw && process.env.FIREBASE_SERVICE_ACCOUNT_FILE) {
    raw = fs.readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_FILE, "utf8");
  }
  if (!raw) throw new Error("Firebase service account is not configured.");
  return initializeApp({ credential: cert(parseFirebaseServiceAccount(raw)) });
}

async function fetchTrustedPrices() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), MARKET_TIMEOUT_MS);
  try {
    const url = new URL("https://api.coingecko.com/api/v3/simple/price");
    url.searchParams.set("ids", Object.values(COIN_IDS).join(","));
    url.searchParams.set("vs_currencies", "usd");
    url.searchParams.set("precision", "full");
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw Object.assign(new Error("Trusted market data is temporarily unavailable."), {
        statusCode: 502,
        code: "market-data-unavailable",
      });
    }
    const payload = await response.json();
    const prices = Object.fromEntries(
      SUPPORTED.map((symbol) => [symbol, Number(payload?.[COIN_IDS[symbol]]?.usd)])
        .filter(([, price]) => Number.isFinite(price) && price > 0),
    );
    if (Object.keys(prices).length !== SUPPORTED.length) {
      throw Object.assign(new Error("Trusted market data did not include all supported assets."), {
        statusCode: 502,
        code: "market-data-incomplete",
      });
    }
    return prices;
  } finally {
    clearTimeout(timeoutId);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed." });
  try {
    const app = getApp();
    const token = await requireVerifiedUser(req, app);
    const prices = await fetchTrustedPrices();
    const db = getFirestore(app);
    const profileRef = db.collection("users").doc(token.uid);
    let result;

    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(profileRef);
      if (!snapshot.exists) throw Object.assign(new Error("User profile was not found."), { statusCode: 404 });
      const profile = snapshot.data();
      const paperTrading = profile.paperTrading;
      if (!paperTrading?.enabled) {
        result = { synced: false, reason: "paper-trading-not-assigned" };
        return;
      }

      const allocations = Object.fromEntries(
        SUPPORTED
          .map((symbol) => [symbol, Math.max(Number(paperTrading.allocations?.[symbol]) || 0, 0)])
          .filter(([, amount]) => amount > 0),
      );
      const entryPrices = { ...(paperTrading.marketEntryPrices || {}) };
      let currentValue = 0;
      let capital = 0;

      for (const [symbol, amount] of Object.entries(allocations)) {
        const price = Number(prices[symbol]);
        if (!Number.isFinite(price) || price <= 0) {
          result = { synced: false, reason: "incomplete-market-prices" };
          return;
        }
        capital += amount;
        entryPrices[symbol] = Number(entryPrices[symbol]) > 0 ? Number(entryPrices[symbol]) : price;
        currentValue += (amount / entryPrices[symbol]) * price;
      }
      if (!Object.keys(allocations).length) {
        result = { synced: false, reason: "no-valid-market-prices" };
        return;
      }

      const nextProfit = currentValue - capital;
      const previousProfit = Number(paperTradingProfit(profile)) || 0;
      const delta = nextProfit - previousProfit;
      const valuationId = getValuationSnapshotId(prices, allocations, entryPrices, currentValue, previousProfit, nextProfit);
      const nextPaperTrading = {
        ...paperTrading,
        marketEntryPrices: entryPrices,
        paperTradingProfit: nextProfit,
        lastMarketValue: currentValue,
        lastMarketSyncAt: FieldValue.serverTimestamp(),
      };
      transaction.update(profileRef, {
        paperTrading: nextPaperTrading,
        paperTradingProfit: nextProfit,
        updatedAt: FieldValue.serverTimestamp(),
      });
      if (Math.abs(delta) >= 0.005) {
        transaction.set(profileRef.collection("transactions").doc(`paper-trading-${valuationId}`), {
          type: "paper-trading-valuation",
          amount: delta,
          currency: "USD",
          status: "completed",
          source: "paper-trading-market-sync",
          valuationId,
          marketPrices: prices,
          capital,
          currentValue,
          profit: nextProfit,
          createdAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
      result = { synced: true, capital, currentValue, profit: nextProfit, delta };
    });

    return sendJson(res, 200, result);
  } catch (error) {
    return sendJson(res, error.statusCode || 500, {
      error: error.message || "Paper-trading market sync failed.",
      code: error.code || "paper-trading-sync-failed",
    });
  }
}

function paperTradingProfit(profile) {
  return Number(profile.paperTradingProfit ?? profile.paperTrading?.paperTradingProfit) || 0;
}
