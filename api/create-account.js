import admin from "firebase-admin";

function sendJson(res, statusCode, body) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  return res.status(statusCode).json(body);
}

function getFirebaseAdmin() {
  if (admin.apps.length) return admin.app();
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccount) throw new Error("Firebase service account is not configured.");
  return admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(serviceAccount)),
  });
}

async function logProvisioning(db, stage, uid, email, username, status, error = null) {
  try {
    await db.collection("accountProvisioning").add({
      stage,
      uid,
      email: String(email || "").trim().toLowerCase(),
      username: String(username || "").trim().toLowerCase(),
      status,
      error: error ? { message: error.message, code: error.code } : null,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (logError) {
    console.error("Failed to log provisioning event", { uid, email, stage, logError });
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
  const username = String(values.username || "").trim().toLowerCase();
  const referralUsername = String(values.referredBy || "").trim().toLowerCase();
  if (
    !email.includes("@") ||
    password.length < 6 ||
    values.termsAccepted !== true ||
    !/^[a-z0-9._-]{3,30}$/.test(username)
  ) {
    return sendJson(res, 400, { error: "Valid account details are required." });
  }

  let app;
  let db;
  let createdUser = null;
  try {
    app = getFirebaseAdmin();
    db = app.firestore();
    await logProvisioning(db, "start", "", email, username, "pending");
    createdUser = await app.auth().createUser({
      email,
      password,
      displayName: String(values.fullName || "").trim(),
      emailVerified: false,
      disabled: false,
    });
    await logProvisioning(db, "auth-created", createdUser.uid, email, username, "success");

    const userRef = db.doc(`users/${createdUser.uid}`);
    const usernameRef = db.doc(`usernames/${username}`);
    const referrerRef = referralUsername
      ? db.doc(`usernames/${referralUsername}`)
      : null;

    await db.runTransaction(async (transaction) => {
      const userSnapshot = await transaction.get(userRef);
      const usernameSnapshot = await transaction.get(usernameRef);
      const referrerSnapshot = referrerRef ? await transaction.get(referrerRef) : null;
      if (userSnapshot.exists || (usernameSnapshot.exists && usernameSnapshot.data().uid !== createdUser.uid)) {
        const error = new Error("That username is already in use.");
        error.code = "username-already-in-use";
        throw error;
      }
      if (referralUsername && (!referrerSnapshot?.exists || referrerSnapshot.data().uid === createdUser.uid)) {
        const error = new Error("The referral username is invalid.");
        error.code = "invalid-referral";
        throw error;
      }

      transaction.set(userRef, {
        fullName: String(values.fullName || "").trim(),
        username,
        email,
        uid: createdUser.uid,
        phone: String(values.phone || ""),
        country: String(values.country || ""),
        bitcoinWallet: String(values.bitcoinWallet || "").trim(),
        bnbWallet: String(values.bnbWallet || "").trim(),
        ethereumWallet: String(values.ethereumWallet || "").trim(),
        litecoinWallet: String(values.litecoinWallet || "").trim(),
        referredBy: referralUsername,
        promotionalCredit: 0,
        termsAccepted: true,
        role: "member",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      transaction.set(usernameRef, { uid: createdUser.uid });
    });
    await logProvisioning(db, "profile-created", createdUser.uid, email, username, "success");

    return sendJson(res, 201, { uid: createdUser.uid, email });
  } catch (error) {
    const errorUid = createdUser?.uid || "";
    const errorStage = !createdUser ? "auth-creation-failed" : "profile-creation-failed";
    if (db) {
      await logProvisioning(db, errorStage, errorUid, email, username, "failed", error);
    }
    if (createdUser?.uid && app) {
      try {
        await app.auth().deleteUser(createdUser.uid);
        if (db) {
          await logProvisioning(db, "auth-deleted", createdUser.uid, email, username, "success");
        }
      } catch (cleanupError) {
        console.error("create-account cleanup failed", {
          uid: createdUser.uid,
          email,
          username,
          error: cleanupError,
        });
        if (db) {
          await logProvisioning(db, "cleanup-failed", createdUser.uid, email, username, "failed", cleanupError);
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
