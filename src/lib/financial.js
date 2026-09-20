import { collection, doc, getDoc, getDocs, limit, orderBy, query } from "firebase/firestore";
import { firestoreDb } from "./firebase";

const moneyFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const formatMoney = (value = 0) => moneyFormatter.format(Number(value) || 0);
export function buildEmptyFinancialSummary() {
  return { availableBalance: 0, withdrawableBalance: 0, promotionalCredit: 0, lockedBonus: 0, activeDeposit: 0, totalDeposit: 0, totalWithdrawal: 0, totalEarnings: 0, lastDeposit: 0, lastWithdrawal: 0, referralCount: 0, commission: 0, transactions: [], referralRewards: 0 };
}
function completed(item) { return ["completed", "complete", "approved", "settled", "success"].includes(String(item.status || "completed").toLowerCase()); }
export async function loadAccountData(userId) {
  if (!firestoreDb || !userId) return { profile: {}, summary: buildEmptyFinancialSummary() };
  let profileSnap;
  try {
    profileSnap = await getDoc(doc(firestoreDb, "users", userId));
  } catch (error) {
    error.accountDataStage = "profile";
    throw error;
  }
  const profile = profileSnap.exists() ? profileSnap.data() : {};
  let txSnap;
  try {
    txSnap = await getDocs(query(collection(firestoreDb, "users", userId, "transactions"), orderBy("createdAt", "desc"), limit(25)));
  } catch (error) {
    error.accountDataStage = "transactions";
    throw error;
  }
  const transactions = txSnap.docs.map((item) => ({ id: item.id, ...item.data() }));
  let rewardsSnap;
  try {
    rewardsSnap = await getDocs(query(collection(firestoreDb, "users", userId, "referralRewards"), limit(100)));
  } catch (error) {
    error.accountDataStage = "referral rewards";
    throw error;
  }
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
  summary.totalDeposit ||= Number(profile.totalDeposit) || 0;
  summary.totalWithdrawal ||= Number(profile.totalWithdrawal) || 0;
  summary.totalEarnings ||= Number(profile.totalEarnings) || 0;
  summary.activeDeposit = Math.max(summary.totalDeposit - summary.totalWithdrawal, 0);
  summary.withdrawableBalance = Math.max(summary.totalDeposit + summary.totalEarnings - summary.totalWithdrawal - summary.commission, 0);
  summary.availableBalance = summary.withdrawableBalance + summary.promotionalCredit;
  return { profile, summary };
}
export const loadFinancialSummary = async (userId) => (await loadAccountData(userId)).summary;
export const invalidateAccountData = () => {};
