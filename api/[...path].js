import accrueInvestments from "../api-handlers/accrue-investments.js";
import adminData from "../api-handlers/admin-data.js";
import createAccount from "../api-handlers/create-account.js";
import createDepositRequest from "../api-handlers/create-deposit-request.js";
import createReferralReward from "../api-handlers/create-referral-reward.js";
import createWithdrawalRequest from "../api-handlers/create-withdrawal-request.js";
import marketPrices from "../api-handlers/market-prices.js";
import memberHistory from "../api-handlers/member-history.js";
import packages from "../api-handlers/packages.js";
import processAccountDeletions from "../api-handlers/process-account-deletions.js";
import reconcileAccountStatus from "../api-handlers/reconcile-account-status.js";
import recoverProvisioning from "../api-handlers/recover-provisioning.js";
import reindexSupportSearch from "../api-handlers/reindex-support-search.js";
import sendDepositEmail from "../api-handlers/send-deposit-email.js";
import sendSupportEmail from "../api-handlers/send-support-email.js";
import sendWithdrawalEmail from "../api-handlers/send-withdrawal-email.js";
import settleMaturedInvestments from "../api-handlers/settle-matured-investments.js";

const HANDLERS = {
  "accrue-investments": accrueInvestments,
  "admin-data": adminData,
  "create-account": createAccount,
  "create-deposit-request": createDepositRequest,
  "create-referral-reward": createReferralReward,
  "create-withdrawal-request": createWithdrawalRequest,
  "market-prices": marketPrices,
  "member-history": memberHistory,
  packages,
  "process-account-deletions": processAccountDeletions,
  "reconcile-account-status": reconcileAccountStatus,
  "recover-provisioning": recoverProvisioning,
  "reindex-support-search": reindexSupportSearch,
  "send-deposit-email": sendDepositEmail,
  "send-support-email": sendSupportEmail,
  "send-withdrawal-email": sendWithdrawalEmail,
  "settle-matured-investments": settleMaturedInvestments,
};

export default async function handler(req, res) {
  const pathname = new URL(req.url || "/api", "http://localhost").pathname;
  const route = pathname.replace(/^\/api\/?/, "").replace(/\/$/, "");
  const routeHandler = HANDLERS[route];
  if (!routeHandler) {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    return res.status(404).json({ error: "API route not found." });
  }
  return routeHandler(req, res);
}
