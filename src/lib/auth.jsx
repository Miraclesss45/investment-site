import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { firebaseAuth } from "./firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(firebaseAuth));

  useEffect(() => {
    if (!firebaseAuth) {
      setLoading(false);
      return undefined;
    }

    return onAuthStateChanged(
      firebaseAuth,
      (nextUser) => {
        setUser(nextUser);
        setLoading(false);
      },
      () => {
        setUser(null);
        setLoading(false);
      },
    );
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      signOutUser: () => (firebaseAuth ? signOut(firebaseAuth) : Promise.resolve()),
    }),
    [loading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}
