import { getFirestore } from "firebase-admin/firestore";
import { requireVerifiedUser } from "./auth.js";
import { deliverWithdrawalEmail, getFirebaseAdminApp } from "./withdrawal-mailer.js";

function sendJson(res, statusCode, body) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  return res.status(statusCode).json(body);
}

function parseBody(body) {
  if (body === undefined || body === null || body === "") return {};
  return typeof body === "string" ? JSON.parse(body) : body;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed." });

  let token;
  let app;
  try {
    app = getFirebaseAdminApp();
    token = await requireVerifiedUser(req, app);
  } catch (error) {
    if (error?.message === "Firebase service account is not configured.") {
      return sendJson(res, 503, { error: "Withdrawal email delivery is not configured.", code: "firebase-not-configured" });
    }
    return sendJson(res, error.statusCode || 401, {
      error: error.message || "Authentication token is invalid or expired.",
      code: error.code || "auth-invalid",
    });
  }

  let body;
  try {
    body = parseBody(req.body);
  } catch {
    return sendJson(res, 400, { error: "Invalid request body." });
  }
  const withdrawalId = String(body.withdrawalId || "").trim();
  if (!/^[A-Za-z0-9_-]{1,150}$/.test(withdrawalId)) {
    return sendJson(res, 400, { error: "A valid withdrawal request is required." });
  }

  try {
    const db = getFirestore(app);
    const result = await deliverWithdrawalEmail({
      db,
      profileId: token.uid,
      withdrawalId,
      kind: "processing",
    });
    if (result.status === "failed") {
      return sendJson(res, 502, {
        error: result.error,
        code: result.code || "withdrawal-email-failed",
      });
    }
    if (result.status === "sending") {
      return sendJson(res, 409, { error: "The processing email is already being sent.", code: "withdrawal-email-in-progress" });
    }
    return sendJson(res, 200, { delivered: true, alreadySent: result.alreadySent === true });
  } catch (error) {
    console.error("send-withdrawal-email failed", error);
    return sendJson(res, error.statusCode || 500, {
      error: error.message || "The withdrawal email could not be sent.",
    });
  }
}
