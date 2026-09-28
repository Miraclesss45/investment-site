import { getFirestore } from "firebase-admin/firestore";
import { requireVerifiedUser } from "../server/auth.js";
import { deliverSupportEmail } from "../server/support-mailer.js";
import { getFirebaseAdminApp } from "../server/withdrawal-mailer.js";

const SUPPORT_EMAIL = "meridianvest948@gmail.com";

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

  let app;
  let token;
  try {
    app = getFirebaseAdminApp();
    token = await requireVerifiedUser(req, app);
  } catch (error) {
    if (error?.message === "Firebase service account is not configured.") {
      return sendJson(res, 503, { error: "Support email delivery is not configured.", code: "firebase-not-configured" });
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
  const ticketId = String(body.ticketId || "").trim();
  if (!/^[A-Za-z0-9_-]{1,150}$/.test(ticketId)) {
    return sendJson(res, 400, { error: "A valid support request is required.", code: "support-ticket-invalid" });
  }
  if (!token.email) {
    return sendJson(res, 403, { error: "A verified account email is required.", code: "member-email-unavailable" });
  }

  const db = getFirestore(app);
  const notifications = {};
  for (const kind of ["support", "member"]) {
    try {
      notifications[kind] = await deliverSupportEmail({
        db,
        profileId: token.uid,
        ticketId,
        kind,
        verifiedEmail: token.email,
        supportEmail: SUPPORT_EMAIL,
      });
    } catch (error) {
      console.error("send-support-email failed", {
        profileId: token.uid,
        ticketId,
        kind,
        code: error.code || null,
      });
      return sendJson(res, error.statusCode || 500, {
        error: error.statusCode === 404
          ? "The support request could not be found."
          : "The support request was saved, but email delivery could not be completed.",
        code: error.code || "support-email-failed",
      });
    }
  }

  const failed = Object.values(notifications).some(({ status }) => status === "failed");
  const sending = Object.values(notifications).some(({ status }) => status === "sending");
  if (failed || sending) {
    return sendJson(res, sending && !failed ? 409 : 502, {
      delivered: false,
      ticketSaved: true,
      notifications,
      code: sending && !failed ? "support-email-in-progress" : "support-email-failed",
      error: "Your support request was saved, but all email notifications could not be confirmed.",
    });
  }

  return sendJson(res, 200, { delivered: true, ticketSaved: true, notifications });
}
