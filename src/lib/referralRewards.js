const REFERRAL_REWARD_LABELS = {
  pending: "Pending verification",
  promotional: "Promotional credit",
  approved: "Approved",
  paid: "Paid",
  completed: "Paid",
  complete: "Paid",
  settled: "Paid",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

const SUCCESSFUL_REFERRAL_STATUSES = new Set([
  "promotional",
  "approved",
  "paid",
  "completed",
  "complete",
  "settled",
  "recorded",
]);

export function normalizeReferralRewardStatus(status) {
  return String(status || "promotional").trim().toLowerCase();
}

export function referralRewardStatusLabel(status) {
  const normalized = normalizeReferralRewardStatus(status);
  return REFERRAL_REWARD_LABELS[normalized]
    || normalized.replaceAll(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
    || "Recorded";
}

export function isPromotionalReferralReward(status) {
  return normalizeReferralRewardStatus(status) === "promotional";
}

export function isSuccessfulReferral(status) {
  return SUCCESSFUL_REFERRAL_STATUSES.has(normalizeReferralRewardStatus(status));
}
