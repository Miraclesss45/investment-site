import { useCallback, useEffect, useRef, useState } from "react";
import { collection, doc, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { useAuth } from "./authContext";
import { processDueInvestments } from "./firebaseData";
import { firestoreDb } from "./firebaseFirestore";
import {
  buildEmptyFinancialSummary,
  invalidateAccountData,
  loadAccountData,
} from "./financial";
import { getSafeErrorMessage } from "./authHelpers";

function timestampMillis(value) {
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  const time = new Date(value || NaN).getTime();
  return Number.isFinite(time) ? time : 0;
}

function hasDueInvestmentAccrual(investments = []) {
  const now = Date.now();
  return investments.some((investment) => {
    if (String(investment.status || "").toLowerCase() !== "active") return false;
    const startedAt = timestampMillis(investment.startedAt);
    if (!startedAt) return false;
    const durationDays = Math.max(Number(investment.durationDays) || 14, 1);
    const elapsedDays = Math.min(
      durationDays,
      Math.max(Math.floor((now - startedAt) / (24 * 60 * 60 * 1000)), 0),
    );
    const accruedDays = Math.max(Number(investment.accruedDays) || 0, 0);
    const maturityAt = timestampMillis(investment.maturesAt)
      || startedAt + durationDays * 24 * 60 * 60 * 1000;
    return maturityAt <= now || elapsedDays > accruedDays;
  });
}

async function loadAccountWithInvestmentSync(user, force) {
  let account = await loadAccountData(user.uid, { force });
  if (!hasDueInvestmentAccrual(account.summary.investments)) return account;

  try {
    await processDueInvestments();
    invalidateAccountData(user.uid);
    account = await loadAccountData(user.uid, { force: true });
    return account;
  } catch (error) {
    error.investmentSyncFallback = account;
    throw error;
  }
}

function investmentSyncMessage() {
  return "Investment progress could not be synchronized yet. Please refresh shortly or contact support.";
}

function getAccountErrorMessage(reason) {
  const stage = String(reason?.accountDataStage || "account").replace(/[^a-z ]/gi, "");
  const code = String(reason?.code || "").toLowerCase();
  if (code.includes("failed-precondition")) {
    const missingIndex = /requires (an? )?index|requires a collection_group/i.test(String(reason?.message || ""));
    console.error("Member account query could not run.", { stage, code });
    return missingIndex
      ? `We could not load your ${stage} data because a required database index is missing or still building. Retry in a moment.`
      : `We could not load your ${stage} data because a database query prerequisite was not met. Retry in a moment.`;
  }
  if (reason?.code?.includes("permission-denied")) {
    console.error("Member account data access was denied.", { stage, code: reason.code });
    return `We could not access your ${stage} data. Refresh the page or sign in again. Contact support if the problem continues.`;
  }
  if (reason?.accountDataStage) {
    console.error("Member account data request failed.", { stage, code: reason?.code || "unknown" });
  }
  return getSafeErrorMessage(reason, "We could not load your account data. Please try again.");
}

export default function useAccountData() {
  const { user } = useAuth();
  const [account, setAccount] = useState({
    profile: {},
    summary: buildEmptyFinancialSummary(),
    hasData: false,
    stale: false,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(Boolean(user));
  const requestRef = useRef(null);
  const refreshQueuedRef = useRef(false);

  useEffect(() => {
    if (!user) {
      setAccount({ profile: {}, summary: buildEmptyFinancialSummary(), hasData: false, stale: false });
      setError("");
      setLoading(false);
      return undefined;
    }

    let active = true;
    setAccount({ profile: {}, summary: buildEmptyFinancialSummary(), hasData: false, stale: false });
    setLoading(true);
    setError("");
    refreshQueuedRef.current = false;

    const refreshAccount = async (force = false) => {
      if (document.visibilityState !== "visible") {
        if (force) refreshQueuedRef.current = true;
        return;
      }
      if (requestRef.current) {
        if (force) refreshQueuedRef.current = true;
        return requestRef.current;
      }
      const request = loadAccountWithInvestmentSync(user, force);
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
        if (active) {
          setAccount({ ...nextAccount, hasData: true, stale: false });
          setError("");
        }
      } finally {
        window.clearTimeout(timeoutId);
        if (requestRef.current === request) requestRef.current = null;
        if (active && refreshQueuedRef.current && document.visibilityState === "visible") {
          refreshQueuedRef.current = false;
          window.setTimeout(() => {
            refreshAccount(true).catch((reason) => {
              if (!active) return;
              if (reason.investmentSyncFallback) {
                setAccount({ ...reason.investmentSyncFallback, hasData: true, stale: true });
              } else {
                setAccount((current) => ({ ...current, stale: current.hasData }));
              }
              setError(reason.investmentSyncFallback
                ? investmentSyncMessage()
                : getAccountErrorMessage(reason));
            });
          }, 0);
        }
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
        if (reason.investmentSyncFallback) {
          setAccount({ ...reason.investmentSyncFallback, hasData: true, stale: true });
        } else {
          setAccount((current) => ({ ...current, stale: current.hasData }));
        }
        setError(reason.investmentSyncFallback
          ? investmentSyncMessage()
          : getAccountErrorMessage(reason));
        setLoading(false);
      });

    const watchedCollections = firestoreDb ? [
      ["profile", doc(firestoreDb, "users", user.uid)],
      ["investments", query(
        collection(firestoreDb, "users", user.uid, "investments"),
        orderBy("startedAt", "desc"),
        limit(25),
      )],
      ["deposits", query(collection(firestoreDb, "users", user.uid, "deposits"), orderBy("createdAt", "desc"), limit(15))],
      ["withdrawals", query(collection(firestoreDb, "users", user.uid, "withdrawals"), orderBy("createdAt", "desc"), limit(15))],
      ["support requests", query(collection(firestoreDb, "users", user.uid, "supportTickets"), orderBy("createdAt", "desc"), limit(10))],
      ["referral rewards", query(
        collection(firestoreDb, "users", user.uid, "referralRewards"),
        orderBy("createdAt", "desc"),
        limit(100),
      )],
    ] : [];
    const initialSnapshots = new Set(watchedCollections.map(([stage]) => stage));
    const unsubscribe = watchedCollections.map(([stage, target]) => onSnapshot(
        target,
        () => {
          if (initialSnapshots.has(stage)) {
            initialSnapshots.delete(stage);
            return;
          }
          refreshAccount(true).catch((reason) => {
            if (!active) return;
            setAccount((current) => ({ ...current, stale: current.hasData }));
            setError(getAccountErrorMessage(Object.assign(reason, { accountDataStage: stage })));
          });
        },
        (reason) => {
          if (!active) return;
          setAccount((current) => ({ ...current, stale: current.hasData }));
          setError(getAccountErrorMessage(Object.assign(reason, { accountDataStage: stage })));
        },
      ));

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        setLoading(true);
        setError("");
        refreshAccount(true)
          .catch((reason) => {
            if (!active) return;
            if (reason.investmentSyncFallback) {
              setAccount({ ...reason.investmentSyncFallback, hasData: true, stale: true });
            } else {
              setAccount((current) => ({ ...current, stale: current.hasData }));
            }
            setError(reason.investmentSyncFallback
              ? investmentSyncMessage()
              : getAccountErrorMessage(reason));
          })
          .finally(() => {
            if (active) setLoading(false);
          });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    const refreshTimer = window.setInterval(() => {
      refreshAccount(true).catch((reason) => {
        if (!active) return;
        setAccount((current) => ({ ...current, stale: current.hasData }));
        setError(getAccountErrorMessage(reason));
      });
    }, 120000);

    return () => {
      active = false;
      requestRef.current = null;
      refreshQueuedRef.current = false;
      unsubscribe.forEach((stop) => stop());
      window.clearInterval(refreshTimer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [user]);

  const refresh = useCallback(async () => {
    if (!user || requestRef.current) return;
    setLoading(true);
    const request = loadAccountWithInvestmentSync(user, true);
    requestRef.current = request;
    try {
      const nextAccount = await request;
      setAccount({ ...nextAccount, hasData: true, stale: false });
      setError("");
    } catch (reason) {
      if (reason.investmentSyncFallback) {
        setAccount({ ...reason.investmentSyncFallback, hasData: true, stale: true });
      } else {
        setAccount((current) => ({ ...current, stale: current.hasData }));
      }
      setError(reason.investmentSyncFallback
        ? investmentSyncMessage()
        : getAccountErrorMessage(reason));
    } finally {
      if (requestRef.current === request) requestRef.current = null;
      setLoading(false);
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
