import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { requireVerifiedUser } from "../server/auth.js";
import { getFirebaseAdminApp } from "../server/withdrawal-mailer.js";
import { createPackageTermsSnapshot, getPublicPackageCatalog } from "../server/package-catalog.js";
import { roundMoney } from "../src/lib/financialMath.js";

const MAX_DEPOSIT = 100000000;
const DEPOSIT_ASSETS = new Set(["Bitcoin", "Ethereum", "Litecoin"]);
const SAFE_ID = /^[A-Za-z0-9_-]{1,150}$/;

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
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Method not allowed." });
  }

  let app;
  let token;
  try {
    app = getFirebaseAdminApp();
    token = await requireVerifiedUser(req, app);
  } catch (error) {
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

  const packageId = String(body.packageId || "").trim();
  const submittedAmount = Number(body.amount);
  const amount = roundMoney(submittedAmount);
  const method = String(body.method || "").trim();
  if (!SAFE_ID.test(packageId)) return sendJson(res, 400, { error: "Select a valid investment package." });
  if (!Number.isFinite(submittedAmount) || Math.abs(submittedAmount - amount) > 1e-8 || amount <= 0 || amount > MAX_DEPOSIT) {
    return sendJson(res, 400, { error: "Enter a valid deposit amount with no more than two decimal places." });
  }
  if (!DEPOSIT_ASSETS.has(method)) return sendJson(res, 400, { error: "Select a supported deposit asset." });

  try {
    const db = getFirestore(app);
    const catalog = await getPublicPackageCatalog(db);
    const selectedPackage = catalog.find((item) => item.id === packageId);
    if (!selectedPackage) {
      return sendJson(res, 409, { error: "That package is no longer available. Refresh the package list and try again." });
    }

    const capturedAt = Timestamp.now();
    const packageTermsSnapshot = createPackageTermsSnapshot(selectedPackage, capturedAt);
    if (amount < packageTermsSnapshot.minimum
      || (packageTermsSnapshot.maximum !== null && amount > packageTermsSnapshot.maximum)) {
      const maximum = packageTermsSnapshot.maximum === null ? "" : ` and no more than $${packageTermsSnapshot.maximum.toFixed(2)}`;
      return sendJson(res, 400, {
        error: `This package accepts deposits of at least $${packageTermsSnapshot.minimum.toFixed(2)}${maximum}.`,
      });
    }

    const profileRef = db.collection("users").doc(token.uid);
    const profileSnapshot = await profileRef.get();
    if (!profileSnapshot.exists) return sendJson(res, 404, { error: "Your account profile could not be found." });
    const profile = profileSnapshot.data();
    const depositRef = profileRef.collection("deposits").doc();
    const fullName = String(profile.fullName || token.name || "Not provided").trim().slice(0, 120);
    const email = String(token.email || profile.email || "").trim().slice(0, 254);

    await depositRef.create({
      packageId,
      packageTermsSnapshot,
      plan: packageTermsSnapshot.name,
      amount,
      currency: "USD",
      method,
      fullName,
      email,
      status: "pending",
      createdAt: FieldValue.serverTimestamp(),
    });
    return sendJson(res, 201, { id: depositRef.id, packageId, packageName: packageTermsSnapshot.name });
  } catch (error) {
    if (error?.statusCode) return sendJson(res, error.statusCode, { error: error.message, code: error.code });
    if (error?.message === "Firebase service account is not configured.") {
      return sendJson(res, 503, { error: "Deposit requests are temporarily unavailable.", code: "firebase-not-configured" });
    }
    console.error("create-deposit-request failed", error);
    return sendJson(res, 500, { error: "The deposit request could not be saved." });
  }
}
