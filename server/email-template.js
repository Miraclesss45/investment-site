export const EMAIL_LOGO_CID = "meridianvest-logo";

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

export function makeBrandedEmail({ heading, greeting, message, details, reference, footer }) {
  const rows = details.map(({ label, value }, index) => `
    <tr>
      <td align="center" style="padding:14px 12px;${index ? "border-top:1px solid #e2e8f0;" : ""}">
        <p style="margin:0;color:#334155;font-size:14px;font-weight:bold;line-height:1.5">${escapeHtml(label)}</p>
        <p style="margin:2px 0 0;color:#475569;font-size:14px;line-height:1.5;word-break:break-word">${escapeHtml(value)}</p>
      </td>
    </tr>`).join("");
  const greetingMarkup = greeting
    ? `<p style="margin:0 0 18px;color:#475569;font-size:15px;line-height:1.6;text-align:center">${escapeHtml(greeting)}</p>`
    : "";
  const referenceMarkup = reference
    ? `<p style="margin:18px 0 0;color:#64748b;font-size:12px;line-height:1.5">${escapeHtml(reference.label)}: <span style="color:#334155;font-weight:bold">${escapeHtml(reference.value)}</span></p>`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${escapeHtml(heading)} | MeridianVests</title>
  </head>
  <body style="margin:0;padding:0;background:#f1edf4;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(message)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f1edf4" style="width:100%;background:#f1edf4">
      <tr>
        <td align="center" style="padding:24px 12px">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #e5e1e8;border-radius:12px;overflow:hidden">
            <tr>
              <td bgcolor="#07111d" style="padding:18px 24px;background:#07111d">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td bgcolor="#ffffff" style="padding:6px;background:#ffffff;border:1px solid #dbeafe;border-radius:13px">
                      <img src="cid:${EMAIL_LOGO_CID}" width="48" height="48" alt="MeridianVests logo" style="display:block;width:48px;height:48px;border:0;border-radius:8px">
                    </td>
                    <td style="padding-left:12px;color:#ffffff;font-size:21px;font-weight:bold;letter-spacing:-0.5px">
                      Meridian<span style="color:#38bdf8">Vests</span>
                      <div style="padding-top:4px;color:#cbd5e1;font-size:10px;font-weight:normal;letter-spacing:1.2px;text-transform:uppercase">Account notification</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 18px 26px">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#e5e5e5" style="width:100%;background:#e5e5e5">
                  <tr>
                    <td align="center" style="padding:18px 14px">
                      <h1 style="margin:0;color:#111827;font-size:22px;font-weight:500;line-height:1.4;text-transform:uppercase">${escapeHtml(heading)}</h1>
                    </td>
                  </tr>
                </table>
                <div style="padding:22px 12px 0">
                  ${greetingMarkup}
                  <p style="margin:0 0 22px;color:#1f2937;font-size:15px;line-height:1.65;text-align:center">${escapeHtml(message)}</p>
                </div>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border:1px solid #e5e1e8;border-radius:8px;overflow:hidden">
                  ${rows}
                </table>
                ${referenceMarkup}
                <p style="margin:22px 0 0;padding-top:16px;border-top:1px solid #e5e1e8;color:#64748b;font-size:12px;line-height:1.65;text-align:center">${escapeHtml(footer)}</p>
              </td>
            </tr>
          </table>
          <p style="margin:14px 0 0;color:#64748b;font-size:11px;line-height:1.5">This is an automated email from MeridianVests.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
