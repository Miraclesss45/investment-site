import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { loadFirebaseServiceAccount } from "../server/firebase-service-account.js";

function sendJson(res, statusCode, body) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  return res.status(statusCode).json(body);
}

function parseBody(body) {
  if (body === undefined || body === null || body === "") return {};
  return typeof body === "string" ? JSON.parse(body) : body;
}

function getFirebaseAdmin() {
  if (getApps().length) return getApp();
  return initializeApp({ credential: cert(loadFirebaseServiceAccount()) });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed." });

  const authorization = req.headers?.authorization || req.headers?.Authorization || "";
  if (!authorization.startsWith("Bearer ")) {
    return sendJson(res, 401, { error: "Authentication is required." });
  }

  let values;
  try {
    values = parseBody(req.body);
  } catch {
    return sendJson(res, 400, { error: "Invalid request body." });
  }

  const referralUsername = String(values.referralUsername || "").trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,30}$/.test(referralUsername)) {
    return sendJson(res, 400, { error: "A valid referral username is required." });
  }

  try {
    const app = getFirebaseAdmin();
    const decodedToken = await getAuth(app).verifyIdToken(authorization.slice(7));
    if (decodedToken.email_verified !== true) {
      return sendJson(res, 403, { error: "Verify your email before claiming referral rewards." });
    }
    const db = getFirestore(app);
    const usernameSnapshot = await db.collection("usernames").doc(referralUsername).get();
    if (!usernameSnapshot.exists) return sendJson(res, 404, { error: "Referral username not found." });

    const referrerId = usernameSnapshot.data().uid;
    if (!referrerId || referrerId === decodedToken.uid) {
      return sendJson(res, 400, { error: "Self-referrals are not allowed." });
    }

    const referredUserRef = db.doc(`users/${decodedToken.uid}`);
    const referredUserSnapshot = await referredUserRef.get();
    if (!referredUserSnapshot.exists) {
      return sendJson(res, 409, { error: "Your member profile is not ready for referral attribution." });
    }
    const referredBy = String(referredUserSnapshot.data().referredBy || "").trim().toLowerCase();
    if (referredBy !== referralUsername) {
      return sendJson(res, 403, { error: "Referral attribution does not match your signup record." });
    }

    const rewardRef = db.doc(`users/${referrerId}/referralRewards/${decodedToken.uid}`);
    const refereeRewardRef = db.doc(`users/${decodedToken.uid}/referralRewards/${referrerId}`);
    const referrerRef = db.doc(`users/${referrerId}`);
    await db.runTransaction(async (transaction) => {
      const [rewardSnapshot, refereeRewardSnapshot, referrerProfileSnapshot] = await Promise.all([
        transaction.get(rewardRef),
        transaction.get(refereeRewardRef),
        transaction.get(referrerRef),
      ]);
      if (!referrerProfileSnapshot.exists) {
        throw Object.assign(new Error("The referral account is no longer active."), {
          statusCode: 409,
          code: "referrer-profile-missing",
        });
      }
      const existingRewardStatus = String(rewardSnapshot.data()?.status || "").toLowerCase();
      if (!rewardSnapshot.exists || existingRewardStatus === "pending") {
        transaction.set(rewardRef, {
          referrerId,
          referredUserId: decodedToken.uid,
          amount: 5,
          recipientRole: "referrer",
          status: "promotional",
          creditedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          ...(!rewardSnapshot.exists ? { createdAt: FieldValue.serverTimestamp() } : {}),
        }, { merge: true });
        transaction.set(referrerRef, {
          referralCount: FieldValue.increment(1),
        }, { merge: true });
      }
      if (!refereeRewardSnapshot.exists) {
        transaction.set(refereeRewardRef, {
          referrerId,
          referredUserId: decodedToken.uid,
          amount: 5,
          recipientRole: "referee",
          status: "promotional",
          createdAt: FieldValue.serverTimestamp(),
          creditedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    });

    return sendJson(res, 200, { recorded: true, amount: 5, status: "promotional" });
  } catch (error) {
    if (error?.code === "auth/id-token-expired" || error?.code === "auth/argument-error") {
      return sendJson(res, 401, { error: "Authentication token is invalid or expired." });
    }
    if (error?.message === "Firebase service account is not configured.") {
      return sendJson(res, 503, { error: "Referral rewards are not configured." });
    }
    if (error?.code === "referrer-profile-missing") {
      return sendJson(res, 409, { error: error.message, code: error.code });
    }
    console.error("create-referral-reward failed", error);
    return sendJson(res, 500, { error: "Referral reward could not be recorded." });
  }
}
