import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import crypto from "node:crypto";
import { loadFirebaseServiceAccount } from "../server/firebase-service-account.js";
import { enforceRateLimit, getClientAddress } from "../server/rate-limit.js";

function sendJson(res, statusCode, body) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  return res.status(statusCode).json(body);
}

function getFirebaseAdmin() {
  if (getApps().length) return getApp();
  return initializeApp({ credential: cert(loadFirebaseServiceAccount()) });
}

async function logProvisioning(db, requestId, stage, uid, email, username, status, error = null, required = false) {
  try {
    await db.collection("accountProvisioning").doc(requestId).set({
      stage,
      uid,
      email: String(email || "").trim().toLowerCase(),
      username: String(username || "").trim().toLowerCase(),
      status,
      error: error ? { message: error.message, code: error.code } : null,
      timestamp: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  } catch (logError) {
    console.error("Failed to log provisioning event", { uid, email, stage, logError });
    if (required) throw logError;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed." });

  let values;
  try {
    values = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  } catch {
    return sendJson(res, 400, { error: "Invalid request body." });
  }

  const email = String(values.email || "").trim().toLowerCase();
  const password = String(values.password || "");
  const fullName = String(values.fullName || "").trim();
  const username = String(values.username || "").trim().toLowerCase();
  const referralUsername = String(values.referredBy || "").trim().toLowerCase();
  if (
    !email.includes("@") ||
    password.length < 8 ||
    !fullName ||
    values.termsAccepted !== true ||
    !/^[a-z0-9._-]{3,30}$/.test(username)
  ) {
    return sendJson(res, 400, { error: "Valid account details are required." });
  }

  let app;
  let db;
  let createdUser = null;
  const requestId = String(values.requestId || crypto.randomUUID());
  if (!/^[A-Za-z0-9-]{20,80}$/.test(requestId)) {
    return sendJson(res, 400, { error: "Invalid account creation request." });
  }
  try {
    app = getFirebaseAdmin();
    db = getFirestore(app);
    await enforceRateLimit(db, {
      scope: "account-create-ip",
      identity: getClientAddress(req),
      limit: 10,
      windowMs: 15 * 60 * 1000,
    });
    await enforceRateLimit(db, {
      scope: "account-create-email",
      identity: email,
      limit: 5,
      windowMs: 60 * 60 * 1000,
    });
    await logProvisioning(db, requestId, "start", "", email, username, "pending", null, true);
    createdUser = await getAuth(app).createUser({
      email,
      password,
      displayName: fullName,
      emailVerified: false,
      disabled: false,
    });
    await logProvisioning(db, requestId, "auth-created", createdUser.uid, email, username, "pending");

    const userRef = db.doc(`users/${createdUser.uid}`);
    const usernameRef = db.doc(`usernames/${username}`);
    const referrerRef = referralUsername
      ? db.doc(`usernames/${referralUsername}`)
      : null;

    await db.runTransaction(async (transaction) => {
      const userSnapshot = await transaction.get(userRef);
      const usernameSnapshot = await transaction.get(usernameRef);
      const referrerSnapshot = referrerRef ? await transaction.get(referrerRef) : null;
      const referrerUid = String(referrerSnapshot?.data()?.uid || "");
      const referrerProfileRef = referrerUid ? db.doc(`users/${referrerUid}`) : null;
      const referrerProfileSnapshot = referrerProfileRef
        ? await transaction.get(referrerProfileRef)
        : null;
      const reservedUid = String(usernameSnapshot.data()?.uid || "");
      const reservedUserRef = reservedUid && reservedUid !== createdUser.uid
        ? db.doc(`users/${reservedUid}`)
        : null;
      const reservedUserSnapshot = reservedUserRef
        ? await transaction.get(reservedUserRef)
        : null;
      const hasLiveReservation =
        usernameSnapshot.exists &&
        reservedUid !== createdUser.uid &&
        reservedUserSnapshot?.exists;

      if (userSnapshot.exists || hasLiveReservation) {
        const error = new Error("That username is already in use.");
        error.code = "username-already-in-use";
        throw error;
      }
      if (referralUsername && (
        !referrerSnapshot?.exists
        || !referrerProfileSnapshot?.exists
        || referrerUid === createdUser.uid
      )) {
        const error = new Error("The referral username is invalid.");
        error.code = "invalid-referral";
        throw error;
      }

      transaction.set(userRef, {
        fullName,
        username,
        email,
        uid: createdUser.uid,
        phone: String(values.phone || ""),
        country: String(values.country || ""),
        bitcoinWallet: String(values.bitcoinWallet || "").trim(),
        ethereumWallet: String(values.ethereumWallet || "").trim(),
        litecoinWallet: String(values.litecoinWallet || "").trim(),
        referredBy: referralUsername,
        promotionalCredit: 0,
        adminBalanceAdjustment: 0,
        termsAccepted: true,
        role: "member",
        createdAt: FieldValue.serverTimestamp(),
      });
      if (referrerUid) {
        transaction.set(db.doc(`users/${referrerUid}/referralRewards/${createdUser.uid}`), {
          referrerId: referrerUid,
          referredUserId: createdUser.uid,
          referredUsername: username,
          amount: 5,
          recipientRole: "referrer",
          status: "pending",
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      if (usernameSnapshot.exists && reservedUid !== createdUser.uid) {
        transaction.delete(usernameRef);
      }
      transaction.set(usernameRef, { uid: createdUser.uid });
    });
    await logProvisioning(db, requestId, "profile-created", createdUser.uid, email, username, "success");

    return sendJson(res, 201, { uid: createdUser.uid, email });
  } catch (error) {
    if (error?.code === "rate-limit-exceeded") {
      return sendJson(res, 429, { error: error.message, code: error.code });
    }
    const errorUid = createdUser?.uid || "";
    const errorStage = !createdUser ? "auth-creation-failed" : "profile-creation-failed";
    if (db) {
      await logProvisioning(db, requestId, errorStage, errorUid, email, username, "failed", error);
    }
    if (createdUser?.uid && app) {
      try {
        await getAuth(app).deleteUser(createdUser.uid);
        if (db) {
          await logProvisioning(db, requestId, "auth-deleted", createdUser.uid, email, username, "recovered");
        }
      } catch (cleanupError) {
        console.error("create-account cleanup failed", {
          uid: createdUser.uid,
          email,
          username,
          error: cleanupError,
        });
        if (db) {
          await logProvisioning(db, requestId, "cleanup-failed", createdUser.uid, email, username, "failed", cleanupError);
        }
      }
    }
    if (error?.code === "auth/email-already-exists") {
      return sendJson(res, 409, { error: "An account already exists with this email address.", code: error.code });
    }
    if (error?.code === "username-already-in-use") {
      return sendJson(res, 409, { error: error.message, code: error.code });
    }
    if (error?.code === "invalid-referral") {
      return sendJson(res, 400, { error: error.message, code: error.code });
    }
    if (error?.message === "Firebase service account is not configured.") {
      return sendJson(res, 503, { error: "Account creation is not configured." });
    }
    console.error("create-account failed", error);
    return sendJson(res, 500, { error: "Your account could not be created. Please try again." });
  }
}
