import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import fs from "node:fs/promises";
import { join } from "node:path";
import nodemailer from "nodemailer";
import { loadFirebaseServiceAccount } from "./firebase-service-account.js";
import { EMAIL_LOGO_CID, makeBrandedEmail } from "./email-template.js";
import { getMemberEmailName } from "./member-email-name.js";

const EMAIL_STATES = {
  processing: {
    field: "processing",
    subject: "Withdrawal request received | MeridianVests",
    heading: "YOUR WITHDRAWAL REQUEST HAS BEEN RECEIVED",
  },
  completed: {
    field: "completed",
    subject: "Your withdrawal request has been processed | MeridianVests",
    heading: "WITHDRAWAL SUCCESSFUL",
  },
};
const EMAIL_LEASE_MS = 2 * 60 * 1000;

export function getDeliveryFailure(error) {
  if (error?.code === "member-email-unavailable") {
    return {
      code: "member-email-unavailable",
      message: "The member account does not have a verified email address.",
    };
  }
  if (error?.code === "smtp-not-configured") {
    return {
      code: "smtp-not-configured",
      message: "Email delivery is not configured. Add SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and MAIL_FROM to the server environment, then restart or redeploy.",
    };
  }
  if (error?.code === "email-provider-not-configured" || error?.code === "email-from-not-configured") {
    return {
      code: error.code,
      message: error.code === "email-from-not-configured"
        ? "MAIL_FROM is missing from the server environment."
        : "The selected email provider is not configured in the server environment.",
    };
  }
  if (error?.code === "EAUTH" || error?.responseCode === 535) {
    return {
      code: "smtp-authentication-failed",
      message: "The mail provider rejected the SMTP login. Check SMTP_USER and SMTP_PASS in the server environment.",
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
      message: "The email service could not reach the mail provider. Check SMTP_HOST, SMTP_PORT, and SMTP_SECURE against your mailbox settings.",
    };
  }
  if (["ECONNRESET", "EPIPE", "ETLS", "EPROTO"].includes(error?.code)) {
    return {
      code: "smtp-connection-failed",
      message: "The SMTP connection was interrupted. Check the mail host, port, TLS mode, and whether the provider allows connections from this deployment.",
    };
  }
  if (error?.code === "resend-authentication-failed") {
    return {
      code: "resend-authentication-failed",
      message: "The email API rejected its key. Check RESEND_API_KEY in the server environment.",
    };
  }
  if (error?.code === "resend-sender-unverified") {
    return {
      code: "resend-sender-unverified",
      message: "The email provider has not verified the sender domain. Verify the domain and MAIL_FROM address with the provider.",
    };
  }
  if (error?.code === "resend-connection-failed") {
    return {
      code: "resend-connection-failed",
      message: "The email API could not be reached. Check the deployment network and email provider status.",
    };
  }
  if (error?.code === "resend-delivery-failed") {
    return {
      code: "resend-delivery-failed",
      message: `The email API rejected the message${Number.isInteger(error.responseCode) ? ` (HTTP ${error.responseCode})` : ""}. Check the sender domain and provider logs.`,
    };
  }
  if (Number.isInteger(error?.responseCode) && error.responseCode >= 400) {
    return {
      code: "smtp-provider-rejected",
      message: `The mail provider rejected the message (SMTP ${error.responseCode}). Check the sender mailbox, sender authorization, and provider logs.`,
    };
  }
  return {
    code: "email-delivery-failed",
    message: "The email could not be delivered. Check the server email settings and mail provider logs.",
  };
}

export function getFirebaseAdminApp() {
  if (getApps().length) return getApp();
  return initializeApp({ credential: cert(loadFirebaseServiceAccount()) });
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

async function sendViaResend({ apiKey, from, to, subject, text, html, attachments, replyTo }) {
  let response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: Array.isArray(to) ? to : [to],
        subject,
        text,
        html,
        ...(replyTo ? { reply_to: replyTo } : {}),
        ...(attachments.length ? {
          attachments: attachments.map((attachment) => ({
            filename: attachment.filename,
            content: Buffer.isBuffer(attachment.content)
              ? attachment.content.toString("base64")
              : String(attachment.content || ""),
            content_type: attachment.contentType,
            content_id: attachment.cid,
          })),
        } : {}),
      }),
      signal: AbortSignal.timeout(10000),
    });
  } catch (cause) {
    throw Object.assign(new Error("The email API could not be reached."), {
      code: "resend-connection-failed",
      cause,
    });
  }

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const providerCode = String(result.name || result.code || "").toLowerCase();
    const providerMessage = String(result.message || result.error || "").toLowerCase();
    const error = new Error("The email API rejected the message.");
    error.responseCode = response.status;
    error.providerCode = providerCode;
    error.code = response.status === 401 || response.status === 403
      ? providerCode.includes("domain") || providerCode.includes("sender") || /domain|sender|from address/.test(providerMessage)
        ? "resend-sender-unverified"
        : "resend-authentication-failed"
      : "resend-delivery-failed";
    throw error;
  }
  return result;
}

export async function sendConfiguredEmail({ to, subject, text, html, attachments = [], replyTo }) {
  const provider = String(process.env.EMAIL_PROVIDER || "smtp").trim().toLowerCase();
  const from = String(process.env.MAIL_FROM || "").trim();
  if (!from) {
    throw Object.assign(new Error("MAIL_FROM is not configured."), { code: "email-from-not-configured" });
  }
  if (provider === "resend") {
    const apiKey = String(process.env.RESEND_API_KEY || "").trim();
    if (!apiKey) {
      throw Object.assign(new Error("RESEND_API_KEY is not configured."), { code: "email-provider-not-configured" });
    }
    return sendViaResend({ apiKey, from, to, subject, text, html, attachments, replyTo });
  }
  if (provider !== "smtp") {
    throw Object.assign(new Error("EMAIL_PROVIDER must be smtp or resend."), { code: "email-provider-not-configured" });
  }
  const { transport, from: smtpFrom } = createTransport();
  return transport.sendMail({
    from: smtpFrom,
    to,
    subject,
    text,
    html,
    attachments,
    ...(replyTo ? { replyTo } : {}),
  });
}

export function buildWithdrawalEmailContent({ kind, withdrawal }) {
  const emailState = EMAIL_STATES[kind];
  if (!emailState) throw new Error("Unsupported withdrawal email type.");

  const memberName = getMemberEmailName(withdrawal);
  const amount = Number(withdrawal.amount);
  const formattedAmount = Number.isFinite(amount)
    ? `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "your requested amount";
  const asset = String(withdrawal.method || withdrawal.asset || "selected payout method").trim();
  const batch = "n/a";
  const providedAddress = "n/a";
  const greeting = kind === "completed"
    ? `Congratulations, ${memberName}!`
    : `Dear ${memberName}.`;
  const message = kind === "processing"
    ? `We have received your withdrawal request for ${formattedAmount}. It is now under review by the MeridianVests team. No payout has been marked as complete yet. We will email you when its status changes.`
    : `Your withdrawal request for ${formattedAmount} has been marked as completed. The MeridianVests team has recorded the payout as sent using your selected method. The destination address and transaction batch are shown as n/a in this notice. Contact support if you need help verifying the payout details.`;
  const html = makeBrandedEmail({
    heading: emailState.heading,
    greeting,
    message,
    details: [
      { label: "Amount (USD)", value: formattedAmount },
      { label: "Transaction method", value: asset },
      { label: "Transaction batch", value: batch },
      { label: "Provided address", value: providedAddress },
    ],
    footer: "If you have questions, contact the MeridianVests support team. This is an automated notification; please do not reply with sensitive account details.",
  });
  const text = `${emailState.heading}\n\n${greeting}\n\n${message}\n\nAmount (USD): ${formattedAmount}\nProvided address: ${providedAddress}\nTransaction method: ${asset}\nTransaction batch: ${batch}\n\nFor help, contact MeridianVests support.`;
  return { emailState, html, text };
}

async function sendWithdrawalEmail({ to, kind, withdrawal }) {
  const { emailState, html, text } = buildWithdrawalEmailContent({ kind, withdrawal });
  const logo = await fs.readFile(join(process.cwd(), "public", "meridianvest-favicon.png"));

  await sendConfiguredEmail({
    to,
    subject: emailState.subject,
    text,
    html,
    attachments: [{ filename: "meridianvest-logo.png", content: logo, contentType: "image/png", contentDisposition: "inline", cid: EMAIL_LOGO_CID }],
  });
}

export async function deliverWithdrawalEmail({ db, profileId, withdrawalId, kind, retryOnly = false }) {
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
    if (retryOnly && previous.status !== "failed") {
      throw Object.assign(new Error("Only a failed withdrawal email can be retried."), { statusCode: 409 });
    }
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
    const app = getFirebaseAdminApp();
    const auth = getAuth(app);
    const account = await auth.getUser(profileId);
    if (!account.email || account.emailVerified !== true) {
      throw Object.assign(new Error("The member needs a verified email address."), { code: "member-email-unavailable" });
    }
    const profileSnapshot = await profileRef.get();
    const profile = profileSnapshot.data() || {};
    await sendWithdrawalEmail({
      to: account.email,
      kind,
      withdrawal: {
        ...claim.withdrawal,
        displayName: profile.displayName,
        authDisplayName: account.displayName,
        username: profile.username,
      },
    });
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
      responseCode: error?.responseCode || null,
      providerCode: error?.providerCode || null,
      command: error?.command || null,
      failureCode: failure.code,
    });
    await withdrawalRef.update({
      [statePath]: {
        status: "failed",
        attemptCount: (Number(claim.withdrawal.emailNotifications?.[emailState.field]?.attemptCount) || 0) + 1,
        failedAt: FieldValue.serverTimestamp(),
        errorCode: failure.code,
        errorMessage: failure.message,
        providerCode: error?.providerCode || null,
        responseCode: Number.isInteger(error?.responseCode) ? error.responseCode : null,
      },
    });
    return {
      status: "failed",
      code: failure.code,
      error: failure.message,
    };
  }
}
