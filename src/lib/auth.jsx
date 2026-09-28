import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { firebaseAuth } from "./firebase";
import { AuthContext } from "./authContext";

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
    let active = true;

    const unsubscribe = onAuthStateChanged(firebaseAuth, async (nextUser) => {
      if (!nextUser) {
        window.clearTimeout(timeoutId);
        if (!active) return;
        setUser(null);
        setRole("member");
        setLoading(false);
        setError("");
        return;
      }

      if (!active) return;
      setUser(nextUser);
      setLoading(true);
      setError("");

      try {
        const { resolveUserRole } = await import("./userRole");
        const nextRole = await resolveUserRole(nextUser);
        if (!active) return;
        setRole(nextRole);
      } catch (roleError) {
        if (!active) return;
        setRole("member");
        console.error("Account role could not be verified.", roleError);
        setError("We could not verify your account access. Refresh the page or sign in again.");
      } finally {
        if (active) {
          window.clearTimeout(timeoutId);
          setLoading(false);
        }
      }
    });

    return () => {
      active = false;
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
