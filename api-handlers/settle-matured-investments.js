import { getFirestore } from "firebase-admin/firestore";
import { requireVerifiedUser } from "../server/auth.js";
import { getFirebaseAdminApp } from "../server/withdrawal-mailer.js";
import { processDueInvestmentsForUser } from "../server/investment-accrual.js";

function sendJson(res, statusCode, body) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  return res.status(statusCode).json(body);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed." });

  try {
    const app = getFirebaseAdminApp();
    const token = await requireVerifiedUser(req, app);
    const result = await processDueInvestmentsForUser(getFirestore(app), token.uid);
    return sendJson(res, 200, { ok: true, ...result });
  } catch (error) {
    if (error?.message === "Firebase service account is not configured.") {
      return sendJson(res, 503, { error: "Maturity processing is temporarily unavailable.", code: "firebase-not-configured" });
    }
    console.error("settle-matured-investments failed", error);
    return sendJson(res, error.statusCode || 500, {
      error: error.statusCode ? error.message : "Matured investments could not be credited.",
      code: error.code || "investment-maturity-failed",
    });
  }
}
