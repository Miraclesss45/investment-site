import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getAdminAccountAccessState } from "./admin-access.js";

export function getBearerToken(req) {
  const authorization = req.headers?.authorization || req.headers?.Authorization || "";
  if (!authorization.startsWith("Bearer ")) {
    throw Object.assign(new Error("Authentication is required."), {
      statusCode: 401,
      code: "auth-required",
    });
  }
  return authorization.slice(7);
}

export async function requireVerifiedUser(req, app) {
  const auth = getAuth(app);
  const token = await auth.verifyIdToken(getBearerToken(req), true);
  if (token.email_verified !== true) {
    throw Object.assign(new Error("Verify your email before using this feature."), {
      statusCode: 403,
      code: "email-not-verified",
    });
  }
  const [authUser, profileSnapshot] = await Promise.all([
    auth.getUser(token.uid),
    getFirestore(app).collection("users").doc(token.uid).get(),
  ]);
  const profile = profileSnapshot.exists ? profileSnapshot.data() : null;
  if (getAdminAccountAccessState(profile, authUser.disabled) !== "active") {
    throw Object.assign(new Error("This account is not active. Contact support if you believe this is an error."), {
      statusCode: 403,
      code: "account-not-active",
    });
  }
  return token;
}
