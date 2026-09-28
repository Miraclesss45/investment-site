import { collection, doc, getDoc, getDocs, limit, orderBy, query } from "firebase/firestore";
import { firestoreDb } from "./firebaseFirestore";
import { calculateWithdrawableBalance, getPaperTradingCapital, sumCompletedLedgerTransactions } from "./financialMath";

const moneyFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const CRYPTO_SYMBOLS = ["BTC", "ETH", "LTC", "BNB"];
export const formatMoney = (value = 0) => moneyFormatter.format(Number(value) || 0);
export function formatTransactionType(type, fallback = "Transaction") {
  if (String(type || "").toLowerCase() === "paper-trading-valuation") {
    return "Trading Valuation";
  }
  return type || fallback;
}
export function buildEmptyFinancialSummary() {
  return { availableBalance: 0, withdrawableBalance: 0, promotionalCredit: 0, lockedBonus: 0, totalDeposit: 0, totalWithdrawal: 0, totalEarnings: 0, lastDeposit: 0, lastWithdrawal: 0, referralCount: 0, commission: 0, transactions: [], referralRewards: 0, depositCryptoCapital: 0, administratorCryptoCapital: 0, cryptoTradingCapital: 0 };
}
function completed(item) { return ["completed", "complete", "approved", "settled", "success"].includes(String(item.status || "completed").toLowerCase()); }
function isTradingValuation(item) {
  return String(item?.type || "").toLowerCase() === "paper-trading-valuation";
}
async function loadAtStage(stage, load) {
  try {
    return await load();
  } catch (error) {
    error.accountDataStage = stage;
    throw error;
  }
}
export async function loadAccountData(userId) {
  if (!firestoreDb || !userId) return { profile: {}, summary: buildEmptyFinancialSummary() };
  const [profileSnap, txSnap, rewardsSnap] = await Promise.all([
    loadAtStage("profile", () => getDoc(doc(firestoreDb, "users", userId))),
    loadAtStage(
      "transactions",
      () => getDocs(query(
        collection(firestoreDb, "users", userId, "transactions"),
        orderBy("createdAt", "desc"),
        limit(25),
      )),
    ),
    loadAtStage(
      "referral rewards",
      () => getDocs(query(
        collection(firestoreDb, "users", userId, "referralRewards"),
        limit(100),
      )),
    ),
  ]);
  const profile = profileSnap.exists() ? profileSnap.data() : {};
  const transactions = txSnap.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((item) => !isTradingValuation(item));
  const summary = buildEmptyFinancialSummary();
  summary.transactions = transactions;
  summary.referralCount = Number(profile.referralCount) || rewardsSnap.size;
  summary.commission = Number(profile.commission) || 0;
  summary.promotionalCredit = Number(profile.promotionalCredit) || 0;
  summary.referralRewards = rewardsSnap.docs.reduce((sum, item) => sum + (Number(item.data().amount) || 0), 0);
  summary.promotionalCredit += summary.referralRewards;
  for (const item of transactions.filter(completed)) {
    const amount = Math.max(Number(item.amount) || 0, 0);
    const type = String(item.type || "").toLowerCase();
    if (type.includes("deposit") || type.includes("credit") || type.includes("investment")) { summary.totalDeposit += amount; summary.lastDeposit = Math.max(summary.lastDeposit, amount); }
    if (type.includes("withdraw") || type.includes("debit") || type.includes("payout")) { summary.totalWithdrawal += amount; summary.lastWithdrawal = Math.max(summary.lastWithdrawal, amount); }
    if (type.includes("earn") || type.includes("profit") || type.includes("referral") || type.includes("commission")) summary.totalEarnings += amount;
    if (item.locked === true) summary.lockedBonus += amount;
  }
  const hasLedgerValue = (field) =>
    Object.prototype.hasOwnProperty.call(profile, field) &&
    Number.isFinite(Number(profile[field]));
  const needsCompleteLedger =
    (!hasLedgerValue("totalDeposit") || Number(profile.totalDeposit) <= 0 ||
      !hasLedgerValue("totalWithdrawal") || Number(profile.totalWithdrawal) <= 0) &&
    (txSnap.size > 0 || Number(profile.availableBalance) > 0 || Number(profile.totalEarnings) > 0);
  if (needsCompleteLedger) {
    const ledgerSnap = await loadAtStage(
      "transactions",
      () => getDocs(collection(firestoreDb, "users", userId, "transactions")),
    );
    if (!ledgerSnap.empty) {
      const ledgerTotals = sumCompletedLedgerTransactions(ledgerSnap.docs.map((item) => item.data()));
      summary.totalDeposit = ledgerTotals.totalDeposit;
      summary.totalWithdrawal = ledgerTotals.totalWithdrawal;
    }
  }
  const ledgerTotalDeposit = hasLedgerValue("totalDeposit") && Number(profile.totalDeposit) > 0
    ? Math.max(Number(profile.totalDeposit), 0)
    : summary.totalDeposit;
  const ledgerTotalWithdrawal = hasLedgerValue("totalWithdrawal") && Number(profile.totalWithdrawal) > 0
    ? Math.max(Number(profile.totalWithdrawal), 0)
    : summary.totalWithdrawal;
  const ledgerEarnings = hasLedgerValue("totalEarnings")
    ? Math.max(Number(profile.totalEarnings), 0)
    : summary.totalEarnings;
  summary.totalDeposit = ledgerTotalDeposit;
  summary.totalWithdrawal = ledgerTotalWithdrawal;
  const paperTradingProfit = Number(profile.paperTradingProfit) || 0;
  const administratorCryptoCapital = getPaperTradingCapital(profile);
  const depositCryptoCapital = Math.max(summary.totalDeposit, 0);
  summary.totalEarnings = ledgerEarnings + paperTradingProfit;
  summary.depositCryptoCapital = depositCryptoCapital;
  summary.administratorCryptoCapital = administratorCryptoCapital;
  summary.cryptoTradingCapital = depositCryptoCapital + administratorCryptoCapital;
  summary.withdrawableBalance = calculateWithdrawableBalance({
    totalDeposit: summary.totalDeposit,
    totalEarnings: summary.totalEarnings,
    totalWithdrawal: summary.totalWithdrawal,
    commission: summary.commission,
    paperTradingWithdrawals: profile.paperTradingWithdrawals,
    paperTradingCapital: administratorCryptoCapital,
  });
  summary.availableBalance = summary.withdrawableBalance + summary.promotionalCredit;
  return { profile, summary };
}
export const loadFinancialSummary = async (userId) => (await loadAccountData(userId)).summary;
export const invalidateAccountData = () => {};
