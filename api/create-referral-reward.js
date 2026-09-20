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
    const decodedToken = await app.auth().verifyIdToken(authorization.slice(7));
    const db = app.firestore();
    const usernameSnapshot = await db.collection("usernames").doc(referralUsername).get();
    if (!usernameSnapshot.exists) return sendJson(res, 404, { error: "Referral username not found." });

    const referrerId = usernameSnapshot.data().uid;
    if (!referrerId || referrerId === decodedToken.uid) {
      return sendJson(res, 400, { error: "Self-referrals are not allowed." });
    }

    const rewardRef = db.doc(`users/${referrerId}/referralRewards/${decodedToken.uid}`);
    const referrerRef = db.doc(`users/${referrerId}`);
    await db.runTransaction(async (transaction) => {
      const rewardSnapshot = await transaction.get(rewardRef);
      if (rewardSnapshot.exists) return;
      transaction.set(rewardRef, {
        referrerId,
        referredUserId: decodedToken.uid,
        amount: 5,
        status: "promotional",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      transaction.set(referrerRef, {
        referralCount: admin.firestore.FieldValue.increment(1),
      }, { merge: true });
    });

    return sendJson(res, 200, { recorded: true });
  } catch (error) {
    if (error?.code === "auth/id-token-expired" || error?.code === "auth/argument-error") {
      return sendJson(res, 401, { error: "Authentication token is invalid or expired." });
    }
    if (error?.message === "Firebase service account is not configured.") {
      return sendJson(res, 503, { error: "Referral rewards are not configured." });
    }
    console.error("create-referral-reward failed", error);
    return sendJson(res, 500, { error: "Referral reward could not be recorded." });
  }
}
