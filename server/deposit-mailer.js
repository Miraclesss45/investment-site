import { getAuth } from "firebase-admin/auth";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import fs from "node:fs/promises";
import { join } from "node:path";
import {
  getDeliveryFailure,
  getFirebaseAdminApp,
  sendConfiguredEmail,
} from "./withdrawal-mailer.js";

const DEPOSIT_EMAILS = {
  pending: {
    field: "pending",
    subject: "Deposit request received | MeridianVest",
    heading: "DEPOSIT REQUEST RECEIVED",
  },
  successful: {
    field: "successful",
    subject: "Deposit successful | MeridianVest",
    heading: "DEPOSIT SUCCESSFUL",
  },
};
const EMAIL_LEASE_MS = 2 * 60 * 1000;
const LOGO_CID = "meridianvest-logo";

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function getAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "the requested amount";
}

function makeEmail(kind, deposit, depositId) {
  const amount = getAmount(kind === "successful"
    ? deposit.creditedAmount ?? deposit.receivedAmount ?? deposit.amount
    : deposit.amount);
  const plan = String(deposit.plan || deposit.packageName || "Selected plan");
  const asset = String(deposit.method || deposit.asset || "Selected asset");
  const message = kind === "pending"
    ? "We received your deposit request. It is awaiting administrator review. This email confirms the request only; no funds have been credited yet. We will email you again once your deposit has been approved and credited."
    : "Your deposit has been approved and credited to your account. Thank you for choosing MeridianVest.";
  const escapedMessage = escapeHtml(message);
  const escapedAmount = escapeHtml(amount);
  const escapedPlan = escapeHtml(plan);
  const escapedAsset = escapeHtml(asset);
  const escapedId = escapeHtml(depositId);
  const html = `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#0f172a"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 12px;background:#f1f5f9"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden"><tr><td style="padding:28px 32px;background:#07111d"><table role="presentation" cellspacing="0" cellpadding="0"><tr><td><img src="cid:${LOGO_CID}" width="44" height="44" alt="MeridianVest" style="display:block;border:0;border-radius:8px"></td><td style="padding-left:12px;color:#fff;font-size:20px;font-weight:bold">Meridian<span style="color:#38bdf8">Vest</span></td></tr></table></td></tr><tr><td style="padding:32px"><h1 style="margin:0 0 16px;font-size:24px;line-height:1.3">${DEPOSIT_EMAILS[kind].heading}</h1><p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.7">${escapedMessage}</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e2e8f0;border-radius:10px"><tr><td style="padding:14px 16px;color:#64748b;font-size:13px">${kind === "pending" ? "Requested amount (USD)" : "Credited amount (USD)"}</td><td align="right" style="padding:14px 16px;font-weight:bold">${escapedAmount}</td></tr><tr><td style="padding:14px 16px;border-top:1px solid #e2e8f0;color:#64748b;font-size:13px">Package</td><td align="right" style="padding:14px 16px;border-top:1px solid #e2e8f0;font-weight:bold">${escapedPlan}</td></tr><tr><td style="padding:14px 16px;border-top:1px solid #e2e8f0;color:#64748b;font-size:13px">Payment asset</td><td align="right" style="padding:14px 16px;border-top:1px solid #e2e8f0;font-weight:bold">${escapedAsset}</td></tr></table><p style="margin:20px 0 0;color:#64748b;font-size:12px">Request ID: ${escapedId}</p><p style="margin:24px 0 0;color:#64748b;font-size:13px;line-height:1.6">For help, contact MeridianVest support. This is an automated notification; please do not reply with sensitive account details.</p></td></tr></table></td></tr></table></body></html>`;
  const text = `${DEPOSIT_EMAILS[kind].heading}\n\n${message}\n\n${kind === "pending" ? "Requested" : "Credited"} amount (USD): ${amount}\nPackage: ${plan}\nPayment asset: ${asset}\nRequest ID: ${depositId}\n\nFor help, contact MeridianVest support.`;
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
    const email = makeEmail(kind, claim.deposit, depositId);
    const logo = await fs.readFile(join(process.cwd(), "public", "meridianvest-favicon.png"));
    await sendConfiguredEmail({
      to: account.email,
      ...email,
      attachments: [{ filename: "meridianvest-logo.png", content: logo, cid: LOGO_CID }],
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
      failureCode: failure.code,
    });
    await depositRef.update({
      [statePath]: {
        status: "failed",
        attemptCount: (Number(claim.deposit.emailNotifications?.[emailState.field]?.attemptCount) || 0) + 1,
        failedAt: FieldValue.serverTimestamp(),
        errorCode: failure.code,
      },
    });
    return { status: "failed", code: failure.code, error: failure.message };
  }
}
