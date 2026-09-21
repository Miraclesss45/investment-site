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

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed." });

  try {
    const app = getFirebaseAdmin();
    const auth = app.auth();
    const db = app.firestore();
    const recovered = [];
    const orphaned = [];

    const provisioning = await db.collection("accountProvisioning")
      .where("status", "==", "failed")
      .where("stage", "==", "cleanup-failed")
      .limit(50)
      .get();

    for (const doc of provisioning.docs) {
      const entry = doc.data();
      const { uid, email, username } = entry;

      if (!uid || !email) continue;

      try {
        const authUser = await auth.getUser(uid);
        if (authUser.disabled) {
          recovered.push({
            uid,
            email,
            username,
            action: "skipped-disabled",
            reason: "Auth account already disabled",
          });
          continue;
        }

        const userProfile = await db.doc(`users/${uid}`).get();
        if (userProfile.exists) {
          recovered.push({
            uid,
            email,
            username,
            action: "recovered",
            reason: "Profile exists and is intact",
          });
          continue;
        }

        orphaned.push({
          uid,
          email,
          username,
          reason: "Auth account exists but profile is missing",
          canDelete: true,
        });
      } catch (error) {
        if (error?.code === "auth/user-not-found") {
          recovered.push({
            uid,
            email,
            username,
            action: "cleaned-up",
            reason: "Auth account already deleted by cleanup",
          });
          await doc.ref.update({ status: "recovered" });
        } else {
          throw error;
        }
      }
    }

    return sendJson(res, 200, {
      checked: provisioning.docs.length,
      recovered: recovered.length,
      orphaned: orphaned.length,
      details: {
        recovered,
        orphaned,
      },
    });
  } catch (error) {
    console.error("recover-provisioning failed", error);
    return sendJson(res, 500, { error: "Provisioning recovery check failed." });
  }
}
