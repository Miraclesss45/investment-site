import { useEffect, useMemo, useState } from "react";
import { getIdTokenResult, onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { firebaseAuth, firestoreDb } from "./firebase";
import { AuthContext } from "./authContext";

function normalizeRole(value) {
  const role = String(value ?? "member").trim().toLowerCase();
  return role === "admin" ? "admin" : "member";
}

async function resolveUserRole(nextUser) {
  if (!nextUser) return "member";

  try {
    const tokenResult = await getIdTokenResult(nextUser, true);
    const claimRole = String(tokenResult?.claims?.role ?? "").trim().toLowerCase();
    if (claimRole === "admin" || tokenResult?.claims?.admin === true) {
      return "admin";
    }
  } catch {
    // Fall back to the Firestore profile when custom claims are not yet available.
  }

  if (!firestoreDb) return "member";

  try {
    const userDoc = await getDoc(doc(firestoreDb, "users", nextUser.uid));
    return userDoc.exists() ? normalizeRole(userDoc.data().role) : "member";
  } catch {
    return "member";
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState("member");
  const [loading, setLoading] = useState(Boolean(firebaseAuth));
  const [error, setError] = useState("");

  useEffect(() => {
    if (!firebaseAuth) {
      setRole("member");
      setLoading(false);
      setError("Firebase is not configured.");
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setLoading(false);
      setError("Firebase took too long to restore your session. Check your connection and try again.");
    }, 10000);

    const unsubscribe = onAuthStateChanged(firebaseAuth, async (nextUser) => {
      window.clearTimeout(timeoutId);

      if (!nextUser) {
        setUser(null);
        setRole("member");
        setLoading(false);
        setError("");
        return;
      }

      setUser(nextUser);
      setLoading(true);
      setError("");

      try {
        const nextRole = await resolveUserRole(nextUser);
        setRole(nextRole);
      } catch {
        setRole("member");
      } finally {
        setLoading(false);
      }
    });

    return () => {
      window.clearTimeout(timeoutId);
      unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      role,
      isAdmin: role === "admin",
      loading,
      error,
      signOutUser: () => (firebaseAuth ? signOut(firebaseAuth) : Promise.resolve()),
    }),
    [error, loading, role, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
