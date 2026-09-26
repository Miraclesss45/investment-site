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
  const token = await getAuth(app).verifyIdToken(getBearerToken(req));
  if (token.email_verified !== true) {
    throw Object.assign(new Error("Verify your email before using this feature."), {
      statusCode: 403,
      code: "email-not-verified",
    });
  }
  return token;
}
import { getAuth } from "firebase-admin/auth";
