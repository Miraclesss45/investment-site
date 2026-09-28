import { FieldValue, Timestamp } from "firebase-admin/firestore";
import fs from "node:fs/promises";
import { join } from "node:path";
import {
  getDeliveryFailure,
  sendConfiguredEmail,
} from "./withdrawal-mailer.js";

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

function buildEmail({ kind, ticket, ticketId, email, supportEmail }) {
  const name = String(ticket.fullName || "MeridianVest member").trim();
  const subject = String(ticket.subject || "Support request").trim();
  const message = String(ticket.message || "").trim();
  const isSupport = kind === "support";
  const title = isSupport ? "NEW SUPPORT REQUEST" : "SUPPORT REQUEST RECEIVED";
  const mailSubject = isSupport
    ? `New MeridianVest support request (${ticketId})`
    : "We received your support request | MeridianVest";
  const intro = isSupport
    ? "A member submitted a support request. Reply to this email to contact the member."
    : "We received your support request. Our support team will review it and reply to you by email.";
  const rows = isSupport
    ? `<tr><td style="padding:14px 16px;color:#64748b;font-size:13px">Name</td><td align="right" style="padding:14px 16px;font-weight:bold">${escapeHtml(name)}</td></tr><tr><td style="padding:14px 16px;border-top:1px solid #e2e8f0;color:#64748b;font-size:13px">Member email</td><td align="right" style="padding:14px 16px;border-top:1px solid #e2e8f0;font-weight:bold">${escapeHtml(email)}</td></tr><tr><td style="padding:14px 16px;border-top:1px solid #e2e8f0;color:#64748b;font-size:13px">Subject</td><td align="right" style="padding:14px 16px;border-top:1px solid #e2e8f0;font-weight:bold">${escapeHtml(subject)}</td></tr>`
    : `<tr><td style="padding:14px 16px;color:#64748b;font-size:13px">Request status</td><td align="right" style="padding:14px 16px;font-weight:bold">Received</td></tr>`;
  const messageBlock = isSupport
    ? `<div style="margin-top:20px;padding:16px;border-radius:10px;background:#f8fafc;color:#334155;font-size:14px;line-height:1.7;white-space:pre-wrap">${escapeHtml(message)}</div>`
    : "";
  const html = `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#0f172a"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 12px;background:#f1f5f9"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden"><tr><td style="padding:28px 32px;background:#07111d"><table role="presentation" cellspacing="0" cellpadding="0"><tr><td><img src="cid:${LOGO_CID}" width="44" height="44" alt="MeridianVest" style="display:block;border:0;border-radius:8px"></td><td style="padding-left:12px;color:#fff;font-size:20px;font-weight:bold">Meridian<span style="color:#38bdf8">Vest</span></td></tr></table></td></tr><tr><td style="padding:32px"><h1 style="margin:0 0 16px;font-size:24px;line-height:1.3">${title}</h1><p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.7">${escapeHtml(intro)}</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e2e8f0;border-radius:10px">${rows}<tr><td style="padding:14px 16px;border-top:1px solid #e2e8f0;color:#64748b;font-size:13px">Ticket reference</td><td align="right" style="padding:14px 16px;border-top:1px solid #e2e8f0;font-weight:bold">${escapeHtml(ticketId)}</td></tr></table>${messageBlock}<p style="margin:24px 0 0;color:#64748b;font-size:13px;line-height:1.6">${isSupport ? "Reply to this message to respond to the member." : `For help, contact ${escapeHtml(supportEmail)}.`} This is an automated notification.</p></td></tr></table></td></tr></table></body></html>`;
  const text = isSupport
    ? `${title}\n\n${intro}\n\nName: ${name}\nMember email: ${email}\nSubject: ${subject}\nTicket reference: ${ticketId}\n\n${message}`
    : `${title}\n\n${intro}\n\nTicket reference: ${ticketId}\n\nFor help, contact ${supportEmail}.`;

  return { subject: mailSubject, text, html };
}

export async function deliverSupportEmail({
  db,
  profileId,
  ticketId,
  kind,
  verifiedEmail,
  supportEmail,
}) {
  if (!(["support", "member"].includes(kind))) {
    throw new Error("Unsupported support email type.");
  }

  const ticketRef = db.collection("users").doc(profileId)
    .collection("supportTickets").doc(ticketId);
  const claim = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ticketRef);
    if (!snapshot.exists) {
      throw Object.assign(new Error("The support request was not found."), { statusCode: 404 });
    }

    const ticket = snapshot.data();
    const previous = ticket.emailNotifications?.[kind] || {};
    if (previous.status === "sent") return { alreadySent: true, ticket };
    const leaseUntil = previous.leaseUntil?.toMillis?.() || 0;
    if (previous.status === "sending" && leaseUntil > Date.now()) {
      return { inProgress: true, ticket };
    }

    const attemptCount = (Number(previous.attemptCount) || 0) + 1;
    transaction.update(ticketRef, {
      [`emailNotifications.${kind}`]: {
        status: "sending",
        attemptCount,
        startedAt: FieldValue.serverTimestamp(),
        leaseUntil: Timestamp.fromMillis(Date.now() + EMAIL_LEASE_MS),
      },
    });
    return { ticket, attemptCount };
  });

  if (claim.alreadySent) return { status: "sent", alreadySent: true };
  if (claim.inProgress) return { status: "sending", alreadySending: true };

  try {
    const email = buildEmail({
      kind,
      ticket: claim.ticket,
      ticketId,
      email: verifiedEmail,
      supportEmail,
    });
    const logo = await fs.readFile(join(process.cwd(), "public", "meridianvest-favicon.png"));
    const isSupport = kind === "support";
    await sendConfiguredEmail({
      to: isSupport ? supportEmail : verifiedEmail,
      replyTo: isSupport ? verifiedEmail : supportEmail,
      ...email,
      attachments: [{ filename: "meridianvest-logo.png", content: logo, cid: LOGO_CID }],
    });
    await ticketRef.update({
      [`emailNotifications.${kind}`]: {
        status: "sent",
        attemptCount: claim.attemptCount,
        sentAt: FieldValue.serverTimestamp(),
      },
    });
    return { status: "sent", alreadySent: false };
  } catch (error) {
    const failure = getDeliveryFailure(error);
    console.error("Support email delivery failed", {
      profileId,
      ticketId,
      kind,
      code: failure.code,
    });
    await ticketRef.update({
      [`emailNotifications.${kind}`]: {
        status: "failed",
        attemptCount: claim.attemptCount,
        failedAt: FieldValue.serverTimestamp(),
        errorCode: failure.code,
      },
    });
    return { status: "failed", code: failure.code };
  }
}
