import { useEffect, useState } from "react";
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

    const timeout = new Promise((_, reject) => {
      window.setTimeout(() => {
        const timeoutError = new Error("Account data request timed out.");
        timeoutError.code = "account-data-timeout";
        reject(timeoutError);
      }, 12000);
    });

    Promise.race([loadAccountData(user.uid), timeout])
      .then((nextAccount) => {
        if (!active) return;
        setAccount(nextAccount);
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

    return () => {
      active = false;
    };
  }, [user]);

  return {
    ...account,
    error,
    loading,
    user,
  };
}
