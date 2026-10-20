import "server-only";

// Transactional email via Resend's REST API. Without RESEND_API_KEY
// (e.g. local dev) messages are skipped, so support keeps working before
// email is configured.
const FROM = process.env.EMAIL_FROM ?? "TC Optimize <support@tcoptimize.com>";

export const SUPPORT_INBOX =
  process.env.SUPPORT_INBOX_EMAIL ?? "setup@tcoptimize.com";

export function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendEmail({
  to,
  subject,
  heading,
  body,
  ctaLabel,
  ctaUrl,
}: {
  to: string;
  subject: string;
  heading: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(`RESEND_API_KEY not set; skipped email "${subject}" to ${to}`);
    return;
  }

  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#0d1f3c">
  <h2 style="color:#00275e;margin:0 0 12px">${escapeHtml(heading)}</h2>
  <div style="background:#e9eaec;border-radius:10px;padding:14px 16px;white-space:pre-wrap;font-size:14px;line-height:1.5">${escapeHtml(body)}</div>
  <p style="margin:20px 0">
    <a href="${ctaUrl}" style="background:#00275e;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:bold;font-size:14px">${escapeHtml(ctaLabel)}</a>
  </p>
  <p style="color:#597ea2;font-size:12px">TC Optimize &middot; Save Time, Make Cents</p>
</div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to,
        subject,
        html,
        text: `${heading}\n\n${body}\n\n${ctaLabel}: ${ctaUrl}`,
      }),
    });
    if (!res.ok) {
      console.error(`Email "${subject}" to ${to} failed: ${await res.text()}`);
    }
  } catch (err) {
    console.error(`Email "${subject}" to ${to} failed:`, err);
  }
}
