import admin from "firebase-admin";
import fs from "node:fs";

const SUPPORTED = ["BTC", "ETH", "LTC", "BNB"];
const COIN_IDS = { BTC: "bitcoin", ETH: "ethereum", LTC: "litecoin", BNB: "binancecoin" };

function sendJson(res, statusCode, body) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  return res.status(statusCode).json(body);
}

function getApp() {
  if (admin.apps.length) return admin.app();
  let raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw && process.env.FIREBASE_SERVICE_ACCOUNT_FILE) {
    raw = fs.readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_FILE, "utf8");
  }
  if (!raw) throw new Error("Firebase service account is not configured.");
  return admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
}

async function authenticate(req, app) {
  const header = req.headers?.authorization || "";
  if (!header.startsWith("Bearer ")) {
    throw Object.assign(new Error("Authentication is required."), { statusCode: 401, code: "auth-required" });
  }
  return app.auth().verifyIdToken(header.slice(7));
}

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed." });
  try {
    const app = getApp();
    const token = await authenticate(req, app);
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const prices = body.prices || {};
    const db = app.firestore();
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
      const nextPaperTrading = {
        ...paperTrading,
        marketEntryPrices: entryPrices,
        paperTradingProfit: nextProfit,
        lastMarketValue: currentValue,
        lastMarketSyncAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      transaction.update(profileRef, {
        paperTrading: nextPaperTrading,
        paperTradingProfit: nextProfit,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      if (Math.abs(delta) >= 0.005) {
        transaction.create(profileRef.collection("transactions").doc(`paper-trading-${Date.now()}`), {
          type: "paper-trading-valuation",
          amount: delta,
          currency: "USD",
          status: "completed",
          source: "paper-trading-market-sync",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
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
