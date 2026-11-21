// Emails to send an audit client from their audit page: pick one, and it
// opens in your email app with the to, subject and body filled in.
// {{fields}} are filled from the request.
export const AUDIT_EMAILS = [
  {
    key: "payment_link",
    label: "Payment link",
    subject: "OTC Audit Payment Link",
    body: `Hi again!

As promised, here's the payment link to get started!

{{payment_link}}

I'm looking forward to getting you going!`,
  },
  {
    key: "audit_date",
    label: "Audit date scheduled",
    subject: "Your OTC Audit Date",
    body: `Hi {{first_name}}!

Thanks for booking your OTC Audit. Your Audit Date is {{audit_date}}, and you'll receive your recorded walkthrough and written report by {{report_due}}.

If you chose to share your Open to Close login directly, please text it to 813-906-6019 before then ("OTC Audit for {{name}} at {{team}} - username, password").

Talk soon!
Josie`,
  },
  {
    key: "login_needed",
    label: "Login needed",
    subject: "OTC Audit: Login Needed",
    body: `Hi {{first_name}}!

I'm getting ready for your OTC Audit on {{audit_date}}, but I don't have your Open to Close login yet.

Please text it to 813-906-6019 like this:
"OTC Audit for {{name}} at {{team}} - username, password"

Thanks!
Josie`,
  },
  {
    key: "report_delivered",
    label: "Report delivered",
    subject: "Your OTC Audit Report",
    body: `Hi {{first_name}}!

Your OTC Audit is complete.

Recorded walkthrough: {{video_link}}
Written report: {{report_link}}

It covers what to fix, work on, and improve in your account. If you'd like us to make the updates, implementation is $125/hour and your $55 audit fee is credited toward it. Just reply to this email to get started.

Josie`,
  },
  {
    key: "follow_up",
    label: "Implementation follow-up",
    subject: "Ready to make the updates?",
    body: `Hi {{first_name}}!

I wanted to check in on your OTC Audit. Do you have any questions about the walkthrough or report?

If you'd like us to take care of the updates, implementation is $125/hour and your $55 audit fee is credited toward it. Just reply and I'll get you scheduled.

Josie`,
  },
] as const;

export type AuditEmailFields = {
  name: string;
  team: string;
  audit_date: string;
  report_due: string;
  payment_link: string;
  video_link: string;
  report_link: string;
};

export function fillAuditEmail(text: string, f: AuditEmailFields) {
  const values: Record<string, string> = {
    ...f,
    first_name: f.name.trim().split(/\s+/)[0] ?? f.name,
  };
  return text.replace(/\{\{(\w+)\}\}/g, (all, key: string) => values[key] ?? all);
}
