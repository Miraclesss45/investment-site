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
  const name = String(ticket.fullName || "MeridianVests member").trim();
  const subject = String(ticket.subject || "Support request").trim();
  const message = String(ticket.message || "").trim();
  const isSupport = kind === "support";
  const title = isSupport ? "NEW SUPPORT REQUEST" : "YOUR SUPPORT REQUEST HAS BEEN RECEIVED";
  const mailSubject = isSupport
    ? `New MeridianVests support request (${ticketId})`
    : "We received your support request | MeridianVests";
  const intro = isSupport
    ? "A MeridianVests member has sent a support request. Review the details below and reply to this email to respond directly to the member."
    : `Dear ${name}. We have received your message and the MeridianVests support team will review it. We will reply to your verified email address when we have an update. Keep your ticket reference for follow-up.`;
  const detail = (label, value, index) => `<tr><td align="center" style="padding:14px 12px;${index ? "border-top:1px solid #e2e8f0;" : ""}"><p style="margin:0;color:#334155;font-size:14px;font-weight:bold;line-height:1.5">${escapeHtml(label)}</p><p style="margin:2px 0 0;color:#475569;font-size:14px;line-height:1.5;word-break:break-word">${escapeHtml(value)}</p></td></tr>`;
  const rows = isSupport
    ? `${detail("Name", name, 0)}${detail("Member email", email, 1)}${detail("Subject", subject, 1)}`
    : detail("Request status", "Received", 0);
  const messageBlock = isSupport
    ? `<div style="margin-top:20px;padding:16px;border-radius:10px;background:#f8fafc;color:#334155;font-size:14px;line-height:1.7;white-space:pre-wrap">${escapeHtml(message)}</div>`
    : "";
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} | MeridianVests</title></head><body style="margin:0;background:#f1edf4;font-family:Arial,Helvetica,sans-serif;color:#0f172a"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#f1edf4" style="padding:24px 12px;background:#f1edf4"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff;border:1px solid #e5e1e8;border-radius:12px;overflow:hidden"><tr><td style="padding:18px 24px;background:#07111d"><table role="presentation" cellspacing="0" cellpadding="0"><tr><td><img src="cid:${LOGO_CID}" width="48" height="48" alt="MeridianVests logo" style="display:block;border:0;border-radius:8px"></td><td style="padding-left:12px;color:#fff;font-size:21px;font-weight:bold">Meridian<span style="color:#38bdf8">Vests</span></td></tr></table></td></tr><tr><td style="padding:18px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#e5e5e5" style="background:#e5e5e5"><tr><td align="center" style="padding:18px 14px"><h1 style="margin:0;color:#111827;font-size:22px;font-weight:500;line-height:1.4;text-transform:uppercase">${title}</h1></td></tr></table><p style="margin:22px 8px;color:#1f2937;font-size:15px;line-height:1.65;text-align:center">${escapeHtml(intro)}</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e5e1e8;border-radius:8px;overflow:hidden">${rows}${detail("Ticket reference", ticketId, 1)}</table>${messageBlock}<p style="margin:22px 0 0;padding-top:16px;border-top:1px solid #e5e1e8;color:#64748b;font-size:12px;line-height:1.65;text-align:center">${isSupport ? "Reply to this message to respond to the member." : `For help, contact ${escapeHtml(supportEmail)}.`} This is an automated notification.</p></td></tr></table><p style="margin:14px 0 0;color:#64748b;font-size:11px;line-height:1.5;text-align:center">This is an automated email from MeridianVests.</p></td></tr></table></body></html>`;
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
