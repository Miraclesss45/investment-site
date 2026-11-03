import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { AuthContext } from "./authContext";

const AUTH_ROUTES = new Set([
  "/support",
  "/login",
  "/signup",
  "/verify-email",
  "/dashboard",
  "/deposit",
  "/deposit-pending",
  "/withdraw",
  "/withdrawal-pending",
  "/profile",
  "/transactions",
  "/referral",
]);

function routeNeedsAuth(pathname) {
  return AUTH_ROUTES.has(pathname) || pathname.startsWith("/control-room");
}

export function AuthProvider({ children }) {
  const { pathname } = useLocation();
  const [firebaseAuth, setFirebaseAuth] = useState(null);
  const [user, setUser] = useState(null);
  const [role, setRole] = useState("member");
  const [authInitialized, setAuthInitialized] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState("");
  const authEventVersion = useRef(0);
  const initializationRequest = useRef(null);
  const unsubscribeAuth = useRef(() => {});
  const timeoutRef = useRef(null);
  const activeRef = useRef(true);

  const ensureAuth = useCallback(() => {
    if (initializationRequest.current) return initializationRequest.current;

    setAuthLoading(true);
    setError("");
    const request = (async () => {
      try {
        const [{ firebaseAuth: auth }, { onAuthStateChanged }] = await Promise.all([
          import("./firebase"),
          import("firebase/auth"),
        ]);
        if (!activeRef.current) {
          initializationRequest.current = null;
          return;
        }

        setFirebaseAuth(auth);
        setAuthInitialized(true);
        if (!auth) {
          setRole("member");
          setAuthLoading(false);
          setError("Firebase is not configured.");
          return;
        }

        timeoutRef.current = window.setTimeout(() => {
          authEventVersion.current += 1;
          setAuthLoading(false);
          setError("Firebase took too long to restore your session. Check your connection and try again.");
        }, 10000);

        unsubscribeAuth.current = onAuthStateChanged(auth, async (nextUser) => {
          const eventVersion = ++authEventVersion.current;
          if (!activeRef.current) return;
          if (!nextUser) {
            window.clearTimeout(timeoutRef.current);
            setUser(null);
            setRole("member");
            setAuthLoading(false);
            setError("");
            return;
          }

          setUser(nextUser);
          setAuthLoading(true);
          setError("");

          try {
            const { resolveUserRole } = await import("./userRole");
            const nextRole = await resolveUserRole(nextUser);
            if (!activeRef.current || eventVersion !== authEventVersion.current) return;
            setRole(nextRole);
          } catch (roleError) {
            if (!activeRef.current || eventVersion !== authEventVersion.current) return;
            setRole("member");
            console.error("Account role could not be verified.", roleError);
            setError("We could not verify your account access. Refresh the page or sign in again.");
          } finally {
            if (activeRef.current && eventVersion === authEventVersion.current) {
              window.clearTimeout(timeoutRef.current);
              setAuthLoading(false);
            }
          }
        });
      } catch (authError) {
        if (!activeRef.current) {
          initializationRequest.current = null;
          return;
        }
        console.error("Firebase authentication could not be initialized.", authError);
        setAuthInitialized(true);
        setRole("member");
        setAuthLoading(false);
        setError("Firebase authentication could not be initialized. Check your connection and try again.");
      }
    })();

    initializationRequest.current = request;
    return request;
  }, []);

  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
      window.clearTimeout(timeoutRef.current);
      authEventVersion.current += 1;
      unsubscribeAuth.current();
    };
  }, []);

  useEffect(() => {
    if (routeNeedsAuth(pathname)) ensureAuth();
  }, [ensureAuth, pathname]);

  const loading = authLoading || (routeNeedsAuth(pathname) && !authInitialized);
  const value = useMemo(
    () => ({
      user,
      role,
      isAdmin: role === "admin",
      loading,
      error,
      ensureAuth,
      signOutUser: async () => {
        if (!firebaseAuth) return;
        const { signOut } = await import("firebase/auth");
        return signOut(firebaseAuth);
      },
    }),
    [ensureAuth, error, firebaseAuth, loading, role, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
