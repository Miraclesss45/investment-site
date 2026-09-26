import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "node:fs";
import fs from "node:fs/promises";
import { join } from "node:path";
import nodemailer from "nodemailer";
import { parseFirebaseServiceAccount } from "./firebase-service-account.js";

const EMAIL_STATES = {
  processing: {
    field: "processing",
    subject: "Withdrawal pending | MeridianVest",
    heading: "WITHDRAWAL PENDING",
  },
  completed: {
    field: "completed",
    subject: "Withdrawal successful | MeridianVest",
    heading: "WITHDRAWAL SUCCESSFUL",
  },
};
const EMAIL_LEASE_MS = 2 * 60 * 1000;
const LOGO_CID = "meridianvest-logo";

function getDeliveryFailure(error) {
  if (error?.code === "member-email-unavailable") {
    return {
      code: "member-email-unavailable",
      message: "The member account does not have a verified email address.",
    };
  }
  if (error?.code === "smtp-not-configured") {
    return {
      code: "smtp-not-configured",
      message: "Withdrawal email delivery is not configured.",
    };
  }
  if (error?.code === "EAUTH") {
    return {
      code: "smtp-authentication-failed",
      message: "The email service could not authenticate with the mail provider.",
    };
  }
  if (error?.code === "ETIMEDOUT") {
    return {
      code: "smtp-connection-timeout",
      message: "The email service could not connect to the mail provider.",
    };
  }
  if (["ECONNECTION", "ECONNREFUSED", "ENOTFOUND", "ESOCKET"].includes(error?.code)) {
    return {
      code: "smtp-connection-failed",
      message: "The email service could not reach the mail provider.",
    };
  }
  return {
    code: "email-delivery-failed",
    message: "The withdrawal email could not be delivered.",
  };
}

export function getFirebaseAdminApp() {
  if (getApps().length) return getApp();
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
    || (process.env.FIREBASE_SERVICE_ACCOUNT_FILE
      ? readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_FILE, "utf8")
      : "");
  if (!raw) throw new Error("Firebase service account is not configured.");
  return initializeApp({ credential: cert(parseFirebaseServiceAccount(raw)) });
}

function createTransport() {
  const host = String(process.env.SMTP_HOST || "").trim();
  const port = Number(process.env.SMTP_PORT);
  const user = String(process.env.SMTP_USER || "").trim();
  const pass = process.env.SMTP_PASS;
  const from = String(process.env.MAIL_FROM || "").trim();
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535 || !user || !pass || !from) {
    throw Object.assign(new Error("SMTP is not fully configured."), { code: "smtp-not-configured" });
  }
  const secureValue = String(process.env.SMTP_SECURE || "").trim().toLowerCase();
  if (secureValue && !["true", "false"].includes(secureValue)) {
    throw Object.assign(new Error("SMTP_SECURE must be true or false."), { code: "smtp-not-configured" });
  }
  const secure = secureValue ? secureValue === "true" : port === 465;
  return {
    transport: nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    }),
    from,
  };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

async function sendWithdrawalEmail({ to, kind, withdrawal }) {
  const emailState = EMAIL_STATES[kind];
  if (!emailState) throw new Error("Unsupported withdrawal email type.");

  const { transport, from } = createTransport();
  const logo = await fs.readFile(join(process.cwd(), "public", "meridianvest-favicon.png"));
  const amount = Number(withdrawal.amount);
  const formattedAmount = Number.isFinite(amount)
    ? `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "your requested amount";
  const asset = String(withdrawal.method || withdrawal.asset || "selected asset").trim();
  const message = kind === "processing"
    ? `Your withdrawal request for ${formattedAmount} using ${asset} is awaiting administrator approval. We’ve recorded your selected wallet address: (n/a). We’ll email you when there’s an update. Thank you for choosing MeridianVest.`
    : `Your withdrawal request for ${formattedAmount} using ${asset} has been processed to your selected wallet address: (n/a). Please check your wallet for confirmation. Thank you for choosing MeridianVest.`;
  const escapedAsset = escapeHtml(asset);
  const escapedMessage = escapeHtml(message);
  const escapedAmount = escapeHtml(formattedAmount);
  const html = `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#0f172a"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 12px;background:#f1f5f9"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden"><tr><td style="padding:28px 32px;background:#07111d"><table role="presentation" cellspacing="0" cellpadding="0"><tr><td><img src="cid:${LOGO_CID}" width="44" height="44" alt="MeridianVest" style="display:block;border:0;border-radius:8px"></td><td style="padding-left:12px;color:#fff;font-size:20px;font-weight:bold">Meridian<span style="color:#38bdf8">Vest</span></td></tr></table></td></tr><tr><td style="padding:32px"><h1 style="margin:0 0 16px;font-size:24px;line-height:1.3">${emailState.heading}</h1><p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.7">${escapedMessage}</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e2e8f0;border-radius:10px"><tr><td style="padding:14px 16px;color:#64748b;font-size:13px">Amount (USD)</td><td align="right" style="padding:14px 16px;font-weight:bold">${escapedAmount}</td></tr><tr><td style="padding:14px 16px;border-top:1px solid #e2e8f0;color:#64748b;font-size:13px">Payout asset</td><td align="right" style="padding:14px 16px;border-top:1px solid #e2e8f0;font-weight:bold">${escapedAsset}</td></tr></table><p style="margin:24px 0 0;color:#64748b;font-size:13px;line-height:1.6">If you have questions, contact our support team. This is an automated notification; please do not reply with sensitive account details.</p></td></tr></table></td></tr></table></body></html>`;
  const text = `${emailState.heading}\n\n${message}\n\nAmount (USD): ${formattedAmount}\nPayout asset: ${asset}\n\nFor help, contact MeridianVest support.`;

  await transport.sendMail({
    from,
    to,
    subject: emailState.subject,
    text,
    html,
    attachments: [{ filename: "meridianvest-logo.png", content: logo, cid: LOGO_CID }],
  });
}

export async function deliverWithdrawalEmail({ db, profileId, withdrawalId, kind }) {
  const emailState = EMAIL_STATES[kind];
  if (!emailState) throw new Error("Unsupported withdrawal email type.");
  const profileRef = db.collection("users").doc(profileId);
  const withdrawalRef = profileRef.collection("withdrawals").doc(withdrawalId);
  const statePath = `emailNotifications.${emailState.field}`;
  const claim = await db.runTransaction(async (transaction) => {
    const withdrawalSnapshot = await transaction.get(withdrawalRef);
    if (!withdrawalSnapshot.exists) {
      throw Object.assign(new Error("The withdrawal request was not found."), { statusCode: 404 });
    }
    const withdrawal = withdrawalSnapshot.data();
    if (kind === "completed" && String(withdrawal.status || "").toLowerCase() !== "completed") {
      throw Object.assign(new Error("The withdrawal must be completed before its success email is sent."), { statusCode: 409 });
    }
    const previous = withdrawal.emailNotifications?.[emailState.field] || {};
    if (previous.status === "sent") return { alreadySent: true, withdrawal };
    const leaseUntil = previous.leaseUntil?.toMillis?.() || 0;
    if (previous.status === "sending" && leaseUntil > Date.now()) {
      return { inProgress: true, withdrawal };
    }
    transaction.update(withdrawalRef, {
      [statePath]: {
        status: "sending",
        attemptCount: (Number(previous.attemptCount) || 0) + 1,
        startedAt: FieldValue.serverTimestamp(),
        leaseUntil: Timestamp.fromMillis(Date.now() + EMAIL_LEASE_MS),
      },
    });
    return { withdrawal };
  });

  if (claim.alreadySent) return { status: "sent", alreadySent: true };
  if (claim.inProgress) return { status: "sending", alreadySending: true };

  try {
    const auth = getAuth(getFirebaseAdminApp());
    const account = await auth.getUser(profileId);
    if (!account.email || account.emailVerified !== true) {
      throw Object.assign(new Error("The member needs a verified email address."), { code: "member-email-unavailable" });
    }
    await sendWithdrawalEmail({ to: account.email, kind, withdrawal: claim.withdrawal });
    await withdrawalRef.update({
      [statePath]: {
        status: "sent",
        attemptCount: (Number(claim.withdrawal.emailNotifications?.[emailState.field]?.attemptCount) || 0) + 1,
        sentAt: FieldValue.serverTimestamp(),
      },
    });
    return { status: "sent", alreadySent: false };
  } catch (error) {
    const failure = getDeliveryFailure(error);
    console.error("Withdrawal email delivery failed", {
      profileId,
      withdrawalId,
      kind,
      code: error?.code || null,
      failureCode: failure.code,
    });
    await withdrawalRef.update({
      [statePath]: {
        status: "failed",
        attemptCount: (Number(claim.withdrawal.emailNotifications?.[emailState.field]?.attemptCount) || 0) + 1,
        failedAt: FieldValue.serverTimestamp(),
        errorCode: failure.code,
      },
    });
    return {
      status: "failed",
      code: failure.code,
      error: failure.message,
    };
  }
}
