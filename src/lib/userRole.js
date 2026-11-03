import { getIdTokenResult } from "firebase/auth";

export async function resolveUserRole(user) {
  if (!user) return "member";
  if (user.isAnonymous) return "member";

  try {
    const tokenResult = await getIdTokenResult(user);
    const claimRole = String(tokenResult?.claims?.role ?? "").trim().toLowerCase();
    if (claimRole === "admin" || tokenResult?.claims?.admin === true) return "admin";
    return "member";
  } catch (error) {
    throw new Error("Your account role could not be verified. Check your connection and sign in again.", { cause: error });
  }
}
