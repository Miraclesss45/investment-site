import { getIdTokenResult } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { firestoreDb } from "./firebaseFirestore";

export async function resolveUserRole(user) {
  if (!user) return "member";
  if (user.isAnonymous) return "member";

  let tokenError;
  try {
    const tokenResult = await getIdTokenResult(user, true);
    const claimRole = String(tokenResult?.claims?.role ?? "").trim().toLowerCase();
    if (claimRole === "admin" || tokenResult?.claims?.admin === true) return "admin";
  } catch (error) {
    tokenError = error;
  }

  if (!firestoreDb) {
    throw new Error("Your session could not be verified because Firebase is unavailable.");
  }

  try {
    const userDoc = await getDoc(doc(firestoreDb, "users", user.uid));
    if (!userDoc.exists()) {
      throw new Error("Your member profile is not ready yet. Please try again shortly.");
    }
    const storedRole = String(userDoc.data().role ?? "member").trim().toLowerCase();
    return storedRole === "admin" ? "admin" : "member";
  } catch (error) {
    if (error?.message?.includes("member profile is not ready")) throw error;
    throw new Error(tokenError
      ? "Your administrator role could not be verified. Please sign in again."
      : "Your account role could not be loaded. Please try again.");
  }
}
