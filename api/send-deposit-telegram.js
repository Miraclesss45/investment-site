import admin from "firebase-admin";

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
  if (admin.apps.length) return admin.app();
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccount) throw new Error("Firebase service account is not configured.");
  return admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(serviceAccount)),
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed." });

  const authorization = req.headers?.authorization || req.headers?.Authorization || "";
  if (!authorization.startsWith("Bearer ")) {
    return sendJson(res, 401, { error: "Authentication is required." });
  }

  try {
    await getFirebaseAdmin().auth().verifyIdToken(authorization.slice(7));
  } catch (error) {
    if (error?.message === "Firebase service account is not configured.") {
      return sendJson(res, 503, { error: "Deposit notifications are not configured." });
    }
    return sendJson(res, 401, { error: "Authentication token is invalid or expired." });
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

  const name = escapeTelegram(values.name);
  const email = escapeTelegram(values.email);
  const plan = escapeTelegram(values.plan);
  const method = escapeTelegram(values.method);
  const requestId = escapeTelegram(values.requestId);
  const amount = `$${Number(values.amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const text = [
    "<b>NEW DEPOSIT REQUEST</b>",
    "",
    `<b>Depositor:</b> ${name}`,
    `<b>Email:</b> ${email}`,
    `<b>Bundle:</b> ${plan}`,
    `<b>Chain:</b> ${method}`,
    `<b>Amount:</b> ${amount}`,
    `<b>Request ID:</b> <code>${requestId}</code>`,
    "",
    "Please review this payment and update the member's deposit status.",
  ].join("\n");
  const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });

  if (!telegramResponse.ok) return sendJson(res, 502, { error: "Telegram could not deliver the notification." });
  return sendJson(res, 200, { delivered: true });
}
