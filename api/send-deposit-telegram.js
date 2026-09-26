import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { requireVerifiedUser } from "./auth.js";
import { parseFirebaseServiceAccount } from "./firebase-service-account.js";

function sendJson(res, statusCode, body) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  return res.status(statusCode).json(body);
}

function parseBody(body) {
  if (body === undefined || body === null || body === "") return {};
  return typeof body === "string" ? JSON.parse(body) : body;
}

function escapeTelegram(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function getFirebaseAdmin() {
  if (getApps().length) return getApp();
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccount) throw new Error("Firebase service account is not configured.");
  return initializeApp({ credential: cert(parseFirebaseServiceAccount(serviceAccount)) });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed." });

  const authorization = req.headers?.authorization || req.headers?.Authorization || "";
  if (!authorization.startsWith("Bearer ")) {
    return sendJson(res, 401, { error: "Authentication is required." });
  }

  let decodedToken;
  try {
    decodedToken = await requireVerifiedUser({ headers: { authorization } }, getFirebaseAdmin());
  } catch (error) {
    if (error?.message === "Firebase service account is not configured.") {
      return sendJson(res, 503, { error: "Deposit notifications are not configured." });
    }
    return sendJson(res, error.statusCode || 401, {
      error: error.message || "Authentication token is invalid or expired.",
      code: error.code || "auth-invalid",
    });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) return sendJson(res, 503, { error: "Telegram notifications are not configured." });

  let values;
  try {
    values = parseBody(req.body);
  } catch {
    return sendJson(res, 400, { error: "Invalid request body." });
  }

  const required = ["name", "email", "plan", "method", "amount", "requestId"];
  if (required.some((field) => !String(values[field] ?? "").trim())) {
    return sendJson(res, 400, { error: "Deposit details are incomplete." });
  }
  const requestId = String(values.requestId).trim();
  const submittedEmail = String(values.email).trim().toLowerCase();
  if (!/^[A-Za-z0-9._:-]{8,120}$/.test(requestId)) {
    return sendJson(res, 400, { error: "The deposit request identifier is invalid." });
  }
  if (!decodedToken.email || submittedEmail !== String(decodedToken.email).trim().toLowerCase()) {
    return sendJson(res, 403, { error: "Deposit details must belong to the authenticated account." });
  }
  const numericAmount = Number(values.amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0 || numericAmount > 100000000) {
    return sendJson(res, 400, { error: "A valid positive deposit amount is required." });
  }

  const name = escapeTelegram(values.name);
  const email = escapeTelegram(submittedEmail);
  const plan = escapeTelegram(values.plan);
  const method = escapeTelegram(values.method);
  const escapedRequestId = escapeTelegram(requestId);
  const amount = `$${numericAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const text = [
    "<b>NEW DEPOSIT REQUEST</b>",
    "",
    `<b>Depositor:</b> ${name}`,
    `<b>Email:</b> ${email}`,
    `<b>Bundle:</b> ${plan}`,
    `<b>Chain:</b> ${method}`,
    `<b>Amount:</b> ${amount}`,
    `<b>Request ID:</b> <code>${escapedRequestId}</code>`,
    "",
    "Please review this payment and update the member's deposit status.",
  ].join("\n");
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
      signal: controller.signal,
    });

    if (!telegramResponse.ok) {
      return sendJson(res, 502, { error: "Telegram could not deliver the notification." });
    }
    return sendJson(res, 200, { delivered: true });
  } catch (error) {
    if (error?.name === "AbortError") {
      return sendJson(res, 504, { error: "Telegram notification timed out." });
    }
    return sendJson(res, 502, { error: "Telegram could not deliver the notification." });
  } finally {
    clearTimeout(timeoutId);
  }
}
