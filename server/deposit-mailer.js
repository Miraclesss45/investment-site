import { getAuth } from "firebase-admin/auth";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import fs from "node:fs/promises";
import { join } from "node:path";
import {
  getDeliveryFailure,
  getFirebaseAdminApp,
  sendConfiguredEmail,
} from "./withdrawal-mailer.js";
import { EMAIL_LOGO_CID, makeBrandedEmail } from "./email-template.js";
import { getMemberEmailName } from "./member-email-name.js";

const DEPOSIT_EMAILS = {
  pending: {
    field: "pending",
    subject: "Deposit request received | MeridianVests",
    heading: "YOUR DEPOSIT REQUEST HAS BEEN RECEIVED",
  },
  successful: {
    field: "successful",
    subject: "Deposit credited | MeridianVests",
    heading: "YOUR DEPOSIT HAS BEEN CREDITED",
  },
};
const EMAIL_LEASE_MS = 2 * 60 * 1000;

function getAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "the requested amount";
}

export function buildDepositEmailContent(kind, deposit, depositId) {
  const memberName = getMemberEmailName(deposit);
  const amount = getAmount(kind === "successful"
    ? deposit.creditedAmount ?? deposit.receivedAmount ?? deposit.amount
    : deposit.amount);
  const plan = String(deposit.plan || deposit.packageName || "Selected plan");
  const normalizedPlan = plan.trim().toUpperCase();
  const asset = String(deposit.method || deposit.asset || "Selected asset");
  const promoPercent = normalizedPlan === "PROMO MINI PLAN"
    ? 100
    : normalizedPlan === "PROMO MEGA PLAN" ? 500 : null;
  const greeting = kind === "successful"
    ? `Congratulations, ${memberName}!`
    : `Dear ${memberName}.`;
  const message = kind === "pending"
    ? `We have received your deposit request for ${amount}. It is now under review by the MeridianVests team. Your account has not been credited yet. We will email you when the review is complete.`
    : promoPercent !== null
      ? `Your deposit of ${amount} has been credited to ${plan}, and the 24-hour investment term has started. Promotional returns are not guaranteed and are subject to the platform terms and applicable regulations. Sign in to your MeridianVests dashboard for the recorded start time and maturity details.`
      : `Your deposit of ${amount} has been approved and credited to your ${plan} investment account. Your investment term is now active. Sign in to your MeridianVests dashboard for the recorded start time and maturity details.`;
  const html = makeBrandedEmail({
    heading: DEPOSIT_EMAILS[kind].heading,
    greeting,
    message,
    details: [
      {
        label: kind === "pending" ? "Requested amount (USD)" : "Credited amount (USD)",
        value: amount,
      },
      { label: "Package", value: plan },
      { label: "Payment asset", value: asset },
      { label: "Provided address", value: "n/a" },
    ],
    reference: { label: "Request ID", value: depositId },
    footer: "For help, contact MeridianVests support. This is an automated notification; please do not reply with sensitive account details.",
  });
  const text = `${DEPOSIT_EMAILS[kind].heading}\n\n${greeting}\n\n${message}\n\n${kind === "pending" ? "Requested" : "Credited"} amount (USD): ${amount}\nPackage: ${plan}\nPayment asset: ${asset}\nProvided address: n/a\nRequest ID: ${depositId}\n\nFor help, contact MeridianVests support.`;
  return {
    subject: DEPOSIT_EMAILS[kind].subject,
    text,
    html,
  };
}

export async function deliverDepositEmail({ db, profileId, depositId, kind, retryOnly = false }) {
  const emailState = DEPOSIT_EMAILS[kind];
  if (!emailState) throw new Error("Unsupported deposit email type.");

  const depositRef = db.collection("users").doc(profileId).collection("deposits").doc(depositId);
  const statePath = `emailNotifications.${emailState.field}`;
  const claim = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(depositRef);
    if (!snapshot.exists) {
      throw Object.assign(new Error("The deposit request was not found."), { statusCode: 404 });
    }
    const deposit = snapshot.data();
    const status = String(deposit.status || "pending").toLowerCase();
    if (kind === "pending" && status !== "pending") {
      throw Object.assign(new Error("The pending email is only available while the deposit is pending review."), { statusCode: 409 });
    }
    if (kind === "successful" && (status !== "completed" || !deposit.settlementId)) {
      throw Object.assign(new Error("The deposit must be credited before its success email is sent."), { statusCode: 409 });
    }

    const previous = deposit.emailNotifications?.[emailState.field] || {};
    if (retryOnly && previous.status !== "failed") {
      throw Object.assign(new Error("Only a failed deposit email can be retried."), { statusCode: 409 });
    }
    if (previous.status === "sent") return { alreadySent: true, deposit };
    const leaseUntil = previous.leaseUntil?.toMillis?.() || 0;
    if (previous.status === "sending" && leaseUntil > Date.now()) {
      return { inProgress: true, deposit };
    }

    transaction.update(depositRef, {
      [statePath]: {
        status: "sending",
        attemptCount: (Number(previous.attemptCount) || 0) + 1,
        startedAt: FieldValue.serverTimestamp(),
        leaseUntil: Timestamp.fromMillis(Date.now() + EMAIL_LEASE_MS),
      },
    });
    return { deposit };
  });

  if (claim.alreadySent) return { status: "sent", alreadySent: true };
  if (claim.inProgress) return { status: "sending", alreadySending: true };

  try {
    const account = await getAuth(getFirebaseAdminApp()).getUser(profileId);
    if (!account.email || account.emailVerified !== true) {
      throw Object.assign(new Error("The member needs a verified email address."), { code: "member-email-unavailable" });
    }
    const profileSnapshot = await db.collection("users").doc(profileId).get();
    const profile = profileSnapshot.data() || {};
    const email = buildDepositEmailContent(kind, {
      ...claim.deposit,
      displayName: profile.displayName,
      authDisplayName: account.displayName,
      username: profile.username,
    }, depositId);
    const logo = await fs.readFile(join(process.cwd(), "public", "meridianvest-favicon.png"));
    await sendConfiguredEmail({
      to: account.email,
      ...email,
      attachments: [{ filename: "meridianvest-logo.png", content: logo, contentType: "image/png", contentDisposition: "inline", cid: EMAIL_LOGO_CID }],
    });
    await depositRef.update({
      [statePath]: {
        status: "sent",
        attemptCount: (Number(claim.deposit.emailNotifications?.[emailState.field]?.attemptCount) || 0) + 1,
        sentAt: FieldValue.serverTimestamp(),
      },
    });
    return { status: "sent", alreadySent: false };
  } catch (error) {
    const failure = getDeliveryFailure(error);
    console.error("Deposit email delivery failed", {
      profileId,
      depositId,
      kind,
      code: error?.code || null,
      responseCode: error?.responseCode || null,
      providerCode: error?.providerCode || null,
      command: error?.command || null,
      failureCode: failure.code,
    });
    await depositRef.update({
      [statePath]: {
        status: "failed",
        attemptCount: (Number(claim.deposit.emailNotifications?.[emailState.field]?.attemptCount) || 0) + 1,
        failedAt: FieldValue.serverTimestamp(),
        errorCode: failure.code,
        errorMessage: failure.message,
        providerCode: error?.providerCode || null,
        responseCode: Number.isInteger(error?.responseCode) ? error.responseCode : null,
      },
    });
    return { status: "failed", code: failure.code, error: failure.message };
  }
}
