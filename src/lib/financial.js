import { collection, count, doc, documentId, getAggregateFromServer, getDoc, getDocs, limit, orderBy, query, sum, where } from "firebase/firestore";
import { firestoreDb } from "./firebaseFirestore";
import { calculateMemberWithdrawalBalances, finiteMoney, hasStoredNonNegativeInteger, hasStoredNonNegativeNumber, nonNegativeMoney, roundMoney } from "./financialMath";
import { normalizeReferralRewardStatus } from "./referralRewards";

const moneyFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ACCOUNT_CACHE_TTL_MS = 20_000;
const OPEN_REQUEST_STATUSES = ["pending", "on-hold", "approved"];
const accountDataCache = new Map();
export const formatMoney = (value) => {
  if ((typeof value !== "number" && typeof value !== "string") || (typeof value === "string" && value.trim() === "")) {
    return "Unavailable";
  }
  const amount = Number(value);
  return Number.isFinite(amount) ? moneyFormatter.format(amount) : "Unavailable";
};
export function formatTransactionType(type, fallback = "Transaction") { return type || fallback; }
export function buildEmptyFinancialSummary() {
  return { availableBalance: 0, withdrawableBalance: 0, withdrawalRequestableBalance: 0, promotionalCredit: 0, adminBalanceAdjustment: 0, totalDeposit: 0, totalWithdrawal: 0, totalEarnings: 0, lastDeposit: 0, lastWithdrawal: 0, lockedBonus: 0, referralCount: 0, referralCredit: 0, transactions: [], transactionCursor: null, investments: [], investmentCursor: null, requests: [], referralRewards: 0, referralRewardCount: 0, referralRewardItems: [] };
}
function completed(item) { return ["completed", "complete", "approved", "settled", "success"].includes(String(item.status || "completed").toLowerCase()); }
function recordTimestamp(value) {
  if (typeof value?.toMillis === "function") return value.toMillis();
  const timestamp = new Date(value || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}
async function loadAtStage(stage, load) {
  try {
    return await load();
  } catch (error) {
    error.accountDataStage = stage;
    throw error;
  }
}
async function fetchAccountData(userId) {
  if (!userId) {
    throw Object.assign(new Error("A signed-in account is required to load member data."), { accountDataStage: "profile" });
  }
  if (!firestoreDb) {
    throw Object.assign(new Error("Firebase is not configured, so account data cannot be loaded."), { accountDataStage: "Firebase configuration" });
  }
  const rewardCollection = collection(firestoreDb, "users", userId, "referralRewards");
  const successfulReferralStatuses = ["promotional", "approved", "paid", "completed", "complete", "settled", "recorded"];
  const [profileSnap, txSnap, rewardsSnap, rewardTotalsSnap, referralCreditSnap, successfulReferralCountSnap, investmentsSnap, ledgerSnap, depositsSnap, withdrawalsSnap, activeDepositsSnap, activeWithdrawalsSnap, supportSnap] = await Promise.all([
    loadAtStage("profile", () => getDoc(doc(firestoreDb, "users", userId))),
    loadAtStage(
      "transaction history",
      () => getDocs(query(
        collection(firestoreDb, "users", userId, "transactions"),
        orderBy("createdAt", "desc"),
        orderBy(documentId(), "desc"),
        limit(26),
      )),
    ),
    loadAtStage(
      "referral rewards",
      () => getDocs(query(rewardCollection, orderBy("createdAt", "desc"), orderBy(documentId(), "desc"), limit(26))),
    ),
    loadAtStage("referral reward totals", () => getAggregateFromServer(
      query(rewardCollection, where("status", "==", "promotional")),
      { amount: sum("amount"), recordCount: count() },
    )),
    loadAtStage("referral credit total", () => getAggregateFromServer(
      query(rewardCollection, where("status", "==", "promotional"), where("recipientRole", "==", "referrer")),
      { amount: sum("amount") },
    )),
    loadAtStage("verified referral count", () => getAggregateFromServer(
      query(rewardCollection, where("recipientRole", "==", "referrer"), where("status", "in", successfulReferralStatuses)),
      { recordCount: count() },
    )),
    loadAtStage(
      "investments",
      () => getDocs(query(
        collection(firestoreDb, "users", userId, "investments"),
        orderBy("startedAt", "desc"),
        orderBy(documentId(), "desc"),
        limit(26),
      )),
    ),
    loadAtStage(
      "admin ledger",
      () => getDocs(query(
        collection(firestoreDb, "ledger"),
        where("userId", "==", userId),
        orderBy("createdAt", "desc"),
        orderBy(documentId(), "desc"),
        limit(26),
      )),
    ),
    loadAtStage(
      "deposits",
      () => getDocs(query(
        collection(firestoreDb, "users", userId, "deposits"),
        orderBy("createdAt", "desc"),
        limit(15),
      )),
    ),
    loadAtStage(
      "withdrawals",
      () => getDocs(query(
        collection(firestoreDb, "users", userId, "withdrawals"),
        orderBy("createdAt", "desc"),
        limit(15),
      )),
    ),
    loadAtStage(
      "open deposit requests",
      () => getDocs(query(
        collection(firestoreDb, "users", userId, "deposits"),
        where("status", "in", OPEN_REQUEST_STATUSES),
      )),
    ),
    loadAtStage(
      "open withdrawal requests",
      () => getDocs(query(
        collection(firestoreDb, "users", userId, "withdrawals"),
        where("status", "in", OPEN_REQUEST_STATUSES),
      )),
    ),
    loadAtStage(
      "support requests",
      () => getDocs(query(
        collection(firestoreDb, "users", userId, "supportTickets"),
        orderBy("createdAt", "desc"),
        limit(10),
      )),
    ),
  ]);
  if (!profileSnap.exists()) {
    throw Object.assign(new Error("Your member profile could not be found, so financial data cannot be confirmed."), {
      accountDataStage: "profile",
      code: "member-profile-not-found",
    });
  }
  const profile = profileSnap.data();
  const userTransactions = txSnap.docs.map((item) => ({
    id: item.id,
    ...item.data(),
    historySource: "transactions",
    historyId: item.id,
  }));
  const adminLedgerTransactions = ledgerSnap.docs.map((item) => {
    const data = item.data();
    const kind = String(data.kind || "").toLowerCase();
    return {
      id: `ledger-${item.id}`,
      ...data,
      type: data.type || (kind === "credit" ? "Admin credit" : kind === "debit" ? "Admin debit" : "Admin adjustment"),
      category: data.category || "admin-adjustment",
      historySource: "ledger",
      historyId: item.id,
    };
  });
  const referralRewardTransactions = rewardsSnap.docs.map((item) => {
    const reward = item.data();
    return {
      id: `referral-reward-${item.id}`,
      ...reward,
      type: reward.recipientRole === "referrer" ? "Referral reward" : "Referral signup reward",
      category: "promotional-credit",
      source: "referral-reward",
      rewardStatus: normalizeReferralRewardStatus(reward.status),
      status: normalizeReferralRewardStatus(reward.status) === "promotional"
        ? "completed"
        : normalizeReferralRewardStatus(reward.status),
      historySource: "referralRewards",
      historyId: item.id,
    };
  });
  const transactions = [...userTransactions, ...adminLedgerTransactions, ...referralRewardTransactions]
    .sort((left, right) => recordTimestamp(right.createdAt) - recordTimestamp(left.createdAt))
    .slice(0, 25);
  const summary = buildEmptyFinancialSummary();
  summary.transactions = transactions;
  const transactionSourceCounts = new Map();
  const transactionCursor = {};
  for (const item of transactions) {
    transactionSourceCounts.set(item.historySource, (transactionSourceCounts.get(item.historySource) || 0) + 1);
    transactionCursor[item.historySource] = item.historyId;
  }
  const sourceSnapshots = {
    transactions: txSnap,
    ledger: ledgerSnap,
    referralRewards: rewardsSnap,
  };
  const hasOlderTransactions = Object.entries(sourceSnapshots).some(([source, snapshot]) => (
    snapshot.size > (transactionSourceCounts.get(source) || 0)
  ));
  summary.transactionCursor = hasOlderTransactions ? { ...transactionCursor, hasMore: true } : null;
  summary.investments = investmentsSnap.docs.slice(0, 25).map((item) => ({ id: item.id, ...item.data() }));
  summary.investmentCursor = investmentsSnap.size > 25 && summary.investments.length
    ? { investmentId: summary.investments.at(-1).id, hasMore: true }
    : null;
  const requestCandidates = [
    ...depositsSnap.docs.map((item) => ({ id: item.id, requestType: "deposit", ...item.data() })),
    ...withdrawalsSnap.docs.map((item) => ({ id: item.id, requestType: "withdrawal", ...item.data() })),
    ...activeDepositsSnap.docs.map((item) => ({ id: item.id, requestType: "deposit", ...item.data() })),
    ...activeWithdrawalsSnap.docs.map((item) => ({ id: item.id, requestType: "withdrawal", ...item.data() })),
    ...supportSnap.docs.map((item) => ({ id: item.id, requestType: "support", ...item.data() })),
  ];
  const uniqueRequests = [...new Map(requestCandidates.map((item) => [`${item.requestType}:${item.id}`, item])).values()];
  const activeRequests = uniqueRequests.filter((item) => (
    item.requestType !== "support"
      && OPEN_REQUEST_STATUSES.includes(String(item.status || "pending").toLowerCase())
  ));
  const recentRequests = uniqueRequests.filter((item) => {
    if (item.requestType === "support") return true;
    return !["complete", "completed", "settled", "credited", "paid", "success"].includes(String(item.status || "pending").toLowerCase());
  }).sort((left, right) => recordTimestamp(right.updatedAt || right.createdAt) - recordTimestamp(left.updatedAt || left.createdAt)).slice(0, 10);
  summary.requests = [...new Map([...activeRequests, ...recentRequests].map((item) => [`${item.requestType}:${item.id}`, item])).values()]
    .sort((left, right) => recordTimestamp(right.updatedAt || right.createdAt) - recordTimestamp(left.updatedAt || left.createdAt));
  summary.referralCount = hasStoredNonNegativeInteger(profile.referralCount)
    ? Number(profile.referralCount)
    : Number(successfulReferralCountSnap.data().recordCount) || 0;
  const rewardTotals = rewardTotalsSnap.data();
  summary.referralCredit = nonNegativeMoney(referralCreditSnap.data().amount);
  summary.promotionalCredit = 0;
  summary.adminBalanceAdjustment = finiteMoney(profile.adminBalanceAdjustment) + nonNegativeMoney(profile.promotionalCredit);
  summary.referralRewards = nonNegativeMoney(rewardTotals.amount);
  summary.referralRewardCount = Math.max(Number(rewardTotals.recordCount) || 0, 0);
  summary.referralRewardItems = rewardsSnap.docs
    .map((item) => ({ id: item.id, ...item.data(), status: normalizeReferralRewardStatus(item.data().status) }))
    .filter((reward) => reward.recipientRole === "referrer")
    .sort((left, right) => recordTimestamp(right.creditedAt || right.createdAt) - recordTimestamp(left.creditedAt || left.createdAt));
  summary.promotionalCredit = roundMoney(summary.promotionalCredit + summary.referralRewards);
  const completedTransactions = transactions.filter(completed);
  const depositType = (item) => {
    if (["admin-adjustment", "promotional-credit"].includes(item.category)) return false;
    const type = String(item.type || "").toLowerCase();
    if (/admin|earning|profit|referral|commission|bonus/.test(type)) return false;
    return type.includes("deposit") || type === "credit" || type === "investment";
  };
  const withdrawalType = (item) => {
    if (["admin-adjustment", "promotional-credit"].includes(item.category)) return false;
    const type = String(item.type || "").toLowerCase();
    if (/admin|earning|profit|referral|commission|bonus/.test(type)) return false;
    return type.includes("withdraw") || type === "debit" || type.includes("payout");
  };
  const recentDeposit = completedTransactions.find(depositType);
  const recentWithdrawal = completedTransactions.find(withdrawalType);
  summary.lastDeposit = nonNegativeMoney(recentDeposit?.amount);
  summary.lastWithdrawal = nonNegativeMoney(recentWithdrawal?.amount);
  for (const item of completedTransactions) {
    const amount = nonNegativeMoney(item.amount);
    const type = String(item.type || "").toLowerCase();
    if (depositType(item)) summary.totalDeposit = roundMoney(summary.totalDeposit + amount);
    if (withdrawalType(item)) summary.totalWithdrawal = roundMoney(summary.totalWithdrawal + amount);
    if (!["admin-adjustment", "promotional-credit"].includes(item.category)
      && (type.includes("earn") || type.includes("profit") || type.includes("referral") || type.includes("commission"))) summary.totalEarnings = roundMoney(summary.totalEarnings + amount);
    if (item.locked === true) summary.lockedBonus += amount;
  }
  const hasLedgerValue = (field) => hasStoredNonNegativeNumber(profile[field]);
  const needsAggregateTotals = !hasLedgerValue("totalDeposit")
    || !hasLedgerValue("totalWithdrawal")
    || !hasLedgerValue("totalEarnings");
  const transactionsCollection = collection(firestoreDb, "users", userId, "transactions");
  if (needsAggregateTotals) {
    const [depositTotalSnap, withdrawalTotalSnap, earningsTotalSnap] = await Promise.all([
      hasLedgerValue("totalDeposit") ? Promise.resolve(null) : loadAtStage("deposit totals", () => getAggregateFromServer(
        query(transactionsCollection, where("type", "in", ["deposit", "Deposit", "investment", "Investment"])),
        { amount: sum("amount") },
      )),
      hasLedgerValue("totalWithdrawal") ? Promise.resolve(null) : loadAtStage("withdrawal totals", () => getAggregateFromServer(
        query(transactionsCollection, where("type", "in", ["withdrawal", "Withdrawal", "payout", "Payout"])),
        { amount: sum("amount") },
      )),
      hasLedgerValue("totalEarnings") ? Promise.resolve(null) : loadAtStage("earnings totals", () => getAggregateFromServer(
        query(transactionsCollection, where("type", "in", ["earning", "profit"])),
        { amount: sum("amount") },
      )),
    ]);
    if (depositTotalSnap) summary.totalDeposit = nonNegativeMoney(depositTotalSnap.data().amount);
    if (withdrawalTotalSnap) summary.totalWithdrawal = nonNegativeMoney(withdrawalTotalSnap.data().amount);
    if (earningsTotalSnap) summary.totalEarnings = nonNegativeMoney(earningsTotalSnap.data().amount);
  }
  const needsLatestMovementLookup =
    (summary.totalDeposit > 0 && !recentDeposit)
    || (summary.totalWithdrawal > 0 && !recentWithdrawal);
  if (needsLatestMovementLookup) {
    const [depositHistorySnap, withdrawalHistorySnap] = await Promise.all([
      Number(profile.totalDeposit) > 0 && !recentDeposit
        ? loadAtStage("latest deposit", () => getDocs(query(
          transactionsCollection,
          where("type", "in", ["deposit", "Deposit", "investment", "Investment"]),
          orderBy("createdAt", "desc"),
          orderBy(documentId(), "desc"),
          limit(25),
        )))
        : Promise.resolve(null),
      Number(profile.totalWithdrawal) > 0 && !recentWithdrawal
        ? loadAtStage("latest withdrawal", () => getDocs(query(
          transactionsCollection,
          where("type", "in", ["withdrawal", "Withdrawal", "payout", "Payout"]),
          orderBy("createdAt", "desc"),
          orderBy(documentId(), "desc"),
          limit(25),
        )))
        : Promise.resolve(null),
    ]);
    if (depositHistorySnap) {
      const latest = depositHistorySnap.docs.map((item) => item.data()).find((item) => completed(item) && depositType(item));
      summary.lastDeposit = nonNegativeMoney(latest?.amount);
    }
    if (withdrawalHistorySnap) {
      const latest = withdrawalHistorySnap.docs.map((item) => item.data()).find((item) => completed(item) && withdrawalType(item));
      summary.lastWithdrawal = nonNegativeMoney(latest?.amount);
    }
  }
  const ledgerTotalDeposit = hasLedgerValue("totalDeposit")
    ? nonNegativeMoney(profile.totalDeposit)
    : summary.totalDeposit;
  const ledgerTotalWithdrawal = hasLedgerValue("totalWithdrawal")
    ? nonNegativeMoney(profile.totalWithdrawal)
    : summary.totalWithdrawal;
  const ledgerEarnings = hasLedgerValue("totalEarnings")
    ? nonNegativeMoney(profile.totalEarnings)
    : summary.totalEarnings;
  summary.totalDeposit = ledgerTotalDeposit;
  summary.totalWithdrawal = ledgerTotalWithdrawal;
  summary.totalEarnings = ledgerEarnings;
  let activeInvestmentPrincipal = profile.activeInvestmentPrincipal;
  if (!hasStoredNonNegativeNumber(activeInvestmentPrincipal)) {
    const activeInvestments = await loadAtStage("active investment principal", () => getDocs(query(
      collection(firestoreDb, "users", userId, "investments"),
      where("status", "==", "active"),
    )));
    activeInvestmentPrincipal = activeInvestments.docs.reduce((total, item) => {
      const principal = item.data().principal;
      if (!hasStoredNonNegativeNumber(principal)) {
        throw Object.assign(new Error(`Active investment ${item.id} has an invalid principal.`), { accountDataStage: "active investment principal" });
      }
      return roundMoney(total + nonNegativeMoney(principal));
    }, 0);
  }
  let pendingWithdrawalAmount = profile.pendingWithdrawalAmount;
  if (!hasStoredNonNegativeNumber(pendingWithdrawalAmount)) {
    const allWithdrawals = await loadAtStage("pending withdrawal totals", () => getDocs(
      collection(firestoreDb, "users", userId, "withdrawals"),
    ));
    pendingWithdrawalAmount = allWithdrawals.docs.reduce((total, item) => {
      const withdrawal = item.data();
      if (!["pending", "on-hold", "approved"].includes(String(withdrawal.status || "pending").toLowerCase())) return total;
      if (!hasStoredNonNegativeNumber(withdrawal.amount)) {
        throw Object.assign(new Error(`Active withdrawal ${item.id} has an invalid amount.`), { accountDataStage: "pending withdrawal totals" });
      }
      return roundMoney(total + nonNegativeMoney(withdrawal.amount));
    }, 0);
  }
  const withdrawalBalances = calculateMemberWithdrawalBalances({
    totalDeposit: summary.totalDeposit,
    totalEarnings: summary.totalEarnings,
    totalWithdrawal: summary.totalWithdrawal,
    adminBalanceAdjustment: summary.adminBalanceAdjustment,
    pendingWithdrawalAmount,
  });
  summary.withdrawableBalance = withdrawalBalances.withdrawableBalance;
  summary.withdrawalRequestableBalance = withdrawalBalances.withdrawalRequestableBalance;
  summary.availableBalance = roundMoney(summary.withdrawableBalance + summary.promotionalCredit);
  return { profile, summary };
}

export function loadAccountData(userId, { force = false } = {}) {
  if (!userId) return Promise.reject(Object.assign(new Error("A signed-in account is required to load member data."), { accountDataStage: "profile" }));
  if (!firestoreDb) return Promise.reject(Object.assign(new Error("Firebase is not configured, so account data cannot be loaded."), { accountDataStage: "Firebase configuration" }));

  const cached = accountDataCache.get(userId);
  if (!force && cached?.data && Date.now() - cached.savedAt < ACCOUNT_CACHE_TTL_MS) {
    return Promise.resolve(cached.data);
  }
  if (!force && cached?.request) return cached.request;

  const request = fetchAccountData(userId).then((data) => {
    if (accountDataCache.get(userId)?.request === request) {
      accountDataCache.set(userId, { data, savedAt: Date.now() });
      if (accountDataCache.size > 25) {
        const oldestUserId = accountDataCache.keys().next().value;
        if (oldestUserId !== userId) accountDataCache.delete(oldestUserId);
      }
    }
    return data;
  }).catch((reason) => {
    if (accountDataCache.get(userId)?.request === request) accountDataCache.delete(userId);
    throw reason;
  });

  accountDataCache.set(userId, {
    data: cached?.data,
    savedAt: cached?.savedAt || 0,
    request,
  });
  return request;
}

export const loadFinancialSummary = async (userId) => (await loadAccountData(userId)).summary;
export function invalidateAccountData(userId) {
  if (userId) accountDataCache.delete(userId);
  else accountDataCache.clear();
}
