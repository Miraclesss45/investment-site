import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { loadFirebaseServiceAccount } from "../server/firebase-service-account.js";
import { getPublicPackageCatalog } from "../server/package-catalog.js";

function getFirebaseAdminApp() {
  if (getApps().length) return getApp();
  return initializeApp({ credential: cert(loadFirebaseServiceAccount()) });
}

function sendJson(res, statusCode, body) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=60");
  return res.status(statusCode).json(body);
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: "Method not allowed." });
  }

  try {
    const items = await getPublicPackageCatalog(getFirestore(getFirebaseAdminApp()));
    return sendJson(res, 200, { items });
  } catch (error) {
    if (error?.message === "Firebase service account is not configured.") {
      return sendJson(res, 503, { error: "Investment packages are temporarily unavailable." });
    }
    console.error("Public investment package catalog could not be loaded.", error);
    return sendJson(res, 500, { error: "Investment packages are temporarily unavailable." });
  }
}
