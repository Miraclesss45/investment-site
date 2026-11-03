import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { loadFirebaseServiceAccount } from "../server/firebase-service-account.js";
import { getAdminAccountAccessState, isActiveAdminProfile } from "../server/admin-access.js";

const MINIMUM_ORPHAN_AGE_MS = 15 * 60 * 1000;

function sendJson(res, statusCode, body) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  return res.status(statusCode).json(body);
}

function getFirebaseAdmin() {
  if (getApps().length) return getApp();
  return initializeApp({ credential: cert(loadFirebaseServiceAccount()) });
}

async function authorize(req, app) {
  const authorization = req.headers?.authorization || req.headers?.Authorization || "";
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && (
    req.headers?.["x-cron-secret"] === cronSecret ||
    authorization === `Bearer ${cronSecret}`
  )) return;
  if (!authorization.startsWith("Bearer ")) {
    const error = new Error("Authentication is required.");
    error.statusCode = 401;
    throw error;
  }
  const auth = getAuth(app);
  const token = await auth.verifyIdToken(authorization.slice(7), true);
  if (token.admin !== true && String(token.role || "").trim().toLowerCase() !== "admin") {
    const error = new Error("Administrator privileges are required.");
    error.statusCode = 403;
    throw error;
  }
  const [authUser, profileSnapshot] = await Promise.all([
    auth.getUser(token.uid),
    getFirestore(app).collection("users").doc(token.uid).get(),
  ]);
  const profile = profileSnapshot.exists ? profileSnapshot.data() : null;
  if (authUser.disabled || !isActiveAdminProfile(profile)) {
    const accessState = getAdminAccountAccessState(profile, authUser.disabled);
    throw Object.assign(new Error("Active administrator access is required."), {
      statusCode: 403,
      code: `admin-${accessState}`,
    });
  }
}

function timestampMillis(value) {
  if (value?.toMillis instanceof Function) return value.toMillis();
  if (value?.toDate instanceof Function) return value.toDate().getTime();
  return 0;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: "Method not allowed." });
  }

  try {
    const app = getFirebaseAdmin();
    await authorize(req, app);
    const db = getFirestore(app);
    const auth = getAuth(app);
    const cutoff = Date.now() - MINIMUM_ORPHAN_AGE_MS;
    const candidates = await db.collection("accountProvisioning")
      .where("status", "in", ["pending", "failed"])
      .limit(100)
      .get();
    const recovered = [];

    for (const journal of candidates.docs) {
      const entry = journal.data();
      if (!["start", "auth-created", "cleanup-failed"].includes(entry.stage)) continue;
      if (timestampMillis(entry.updatedAt || entry.timestamp) > cutoff) continue;
      if (!entry.email) continue;

      let authUser;
      try {
        authUser = entry.uid
          ? await auth.getUser(entry.uid)
          : await auth.getUserByEmail(entry.email);
      } catch (error) {
        if (error?.code === "auth/user-not-found") {
          await journal.ref.update({
            stage: "auth-deleted",
            status: "recovered",
            updatedAt: FieldValue.serverTimestamp(),
          });
          recovered.push({ email: entry.email, action: "already-cleaned" });
          continue;
        }
        throw error;
      }

      const profile = await db.doc(`users/${authUser.uid}`).get();
      if (profile.exists) {
        await journal.ref.update({
          uid: authUser.uid,
          stage: "profile-created",
          status: "success",
          updatedAt: FieldValue.serverTimestamp(),
        });
        recovered.push({ uid: authUser.uid, email: entry.email, action: "profile-confirmed" });
        continue;
      }

      await auth.deleteUser(authUser.uid);
      await journal.ref.update({
        uid: authUser.uid,
        stage: "auth-deleted",
        status: "recovered",
        updatedAt: FieldValue.serverTimestamp(),
      });
      recovered.push({ uid: authUser.uid, email: entry.email, action: "orphan-deleted" });
    }

    return sendJson(res, 200, { checked: candidates.size, recovered: recovered.length, details: recovered });
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 500;
    if (statusCode < 500) return sendJson(res, statusCode, { error: error.message });
    console.error("recover-provisioning failed", error);
    return sendJson(res, 500, { error: "Provisioning recovery failed." });
  }
}
