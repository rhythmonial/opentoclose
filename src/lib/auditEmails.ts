// Emails to send an audit client from their audit page: pick one, and it
// opens in your email app with the to, subject and body filled in.
// {{fields}} are filled from the request; {{#no_login}}…{{/no_login}} only
// shows when there's no OTC login saved for them.
export const AUDIT_EMAILS = [
  {
    key: "payment_link",
    label: "Payment Link",
    subject: "OTC Audit Payment Link",
    body: `Hi again!

As promised, here's the payment link to get started!

{{payment_link}}

I'm looking forward to getting you going!`,
  },
  {
    key: "audit_booked",
    label: "Audit Booked",
    subject: "Your OTC Audit is booked for {{audit_date}}",
    body: `Hi {{first_name}}!

You're all set. Your OTC Audit is booked for {{audit_date}}, and you'll get your recorded walkthrough and written report by {{report_due}}.
{{#no_login}}
If you chose to share your login directly, please text it to 813-906-6019 before your Audit Date:
"OTC Audit for {{name}} at {{team}} - username, password"
{{/no_login}}
Talk soon!
Josie`,
  },
  {
    key: "send_report",
    label: "Send Report",
    subject: "Your OTC Audit Report is ready",
    body: `Hi {{first_name}}!

Your OTC Audit is complete! Here's everything:

Recorded walkthrough: {{video_link}}
Written report: {{report_link}}

The report breaks down what to fix, work on, and improve across your fields, dates, emails, tasks, forms, and views. Watch the walkthrough first, then use the report as your checklist.

Have questions? Just reply to this email.

Josie`,
  },
  {
    key: "setup_offer",
    label: "Setup Offer",
    subject: "Let's get your OTC updates done",
    body: `Hi {{first_name}}!

Now that you've had a chance to look through your audit, I'd love to take the updates off your plate.

Based on what I found, I estimate about {{upsell_hours}} hours of work. Implementation is $125/hour, and your $55 audit fee is credited toward it, so your total would be {{upsell_amount}}.

Just reply "Let's do it" and I'll get you scheduled.

Josie`,
  },
  {
    key: "setup_follow_up",
    label: "Setup Follow-up",
    subject: "Following up on your OTC updates",
    body: `Hi {{first_name}}!

I wanted to follow up on your OTC Audit and see if you had any questions about the report or the updates.

Your $55 credit toward implementation is available through 12/31, and I'd be happy to walk you through what I'd tackle first.

Just reply here and we'll find a time.

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
  upsell_hours: string;
  upsell_amount: string;
  // Whether an OTC login is saved for them.
  has_login: boolean;
};

export function fillAuditEmail(text: string, f: AuditEmailFields) {
  const values: Record<string, string> = {
    name: f.name,
    team: f.team,
    audit_date: f.audit_date,
    report_due: f.report_due,
    payment_link: f.payment_link,
    video_link: f.video_link,
    report_link: f.report_link,
    upsell_hours: f.upsell_hours,
    upsell_amount: f.upsell_amount,
    first_name: f.name.trim().split(/\s+/)[0] ?? f.name,
  };
  return text
    .replace(/\{\{#no_login\}\}([\s\S]*?)\{\{\/no_login\}\}/g, (_all, inner: string) => (f.has_login ? "" : inner))
    .replace(/\{\{(\w+)\}\}/g, (all, key: string) => values[key] ?? all);
}
