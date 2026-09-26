import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "./authContext";
import {
  buildEmptyFinancialSummary,
  loadAccountData,
} from "./financial";

export default function useAccountData() {
  const { user } = useAuth();
  const [account, setAccount] = useState({
    profile: {},
    summary: buildEmptyFinancialSummary(),
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(Boolean(user));
  const requestRef = useRef(null);

  useEffect(() => {
    if (!user) {
      setAccount({ profile: {}, summary: buildEmptyFinancialSummary() });
      setError("");
      setLoading(false);
      return undefined;
    }

    let active = true;
    setLoading(true);
    setError("");

    const refreshAccount = async () => {
      if (document.visibilityState !== "visible" || requestRef.current) return;
      const request = loadAccountData(user.uid);
      requestRef.current = request;
      let timeoutId;
      const timeout = new Promise((_, reject) => {
        timeoutId = window.setTimeout(() => {
          const timeoutError = new Error("Account data request timed out.");
          timeoutError.code = "account-data-timeout";
          reject(timeoutError);
        }, 12000);
      });
      try {
        const nextAccount = await Promise.race([request, timeout]);
        if (active) setAccount(nextAccount);
      } finally {
        window.clearTimeout(timeoutId);
        if (requestRef.current === request) requestRef.current = null;
      }
      return request;
    };

    refreshAccount()
      .then(() => {
        if (!active) return;
        setLoading(false);
      })
      .catch((reason) => {
        if (!active) return;
        setError(
          reason?.code?.includes("permission-denied")
            ? `Firebase denied access while loading your ${reason.accountDataStage || "account"} data. Deploy the current Firestore rules, then sign out and sign in again.`
            : reason?.code === "account-data-timeout"
              ? "Account data is taking too long to load. Check your connection and try again."
            : "We could not load your account data. Please try again.",
        );
        setLoading(false);
      });

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        setLoading(true);
        setError("");
        refreshAccount()
          .catch((reason) => {
            if (active) setError(reason?.message || "We could not refresh your account data.");
          })
          .finally(() => {
            if (active) setLoading(false);
          });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    const refreshTimer = window.setInterval(() => {
      refreshAccount().catch(() => {});
    }, 30000);

    return () => {
      active = false;
      requestRef.current = null;
      window.clearInterval(refreshTimer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [user]);

  const refresh = useCallback(async () => {
    if (!user || requestRef.current) return;
    const request = loadAccountData(user.uid);
    requestRef.current = request;
    try {
      const nextAccount = await request;
      setAccount(nextAccount);
    } finally {
      if (requestRef.current === request) requestRef.current = null;
    }
  }, [user]);

  return {
    ...account,
    error,
    loading,
    user,
    refresh,
  };
}
