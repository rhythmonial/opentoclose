import type { Metadata } from "next";
import { MarketingFooter } from "@/components/MarketingFooter";
import { AUDIT_FEE, auditClosed } from "@/lib/audits";
import { AuditForm } from "./AuditForm";

export const metadata: Metadata = {
  title: "$55 OTC Audit | OTC Setup with Josie",
  description:
    "A review of your Open to Close account with a recorded walkthrough and written report of what's broken, missing, or could be optimized.",
};

// What the audit covers, then how it's delivered.
const CHECKS = [
  ["Fields", "We'll audit your field order for intake and workflow efficiency."],
  ["Dates", "We'll confirm your date calculations and the intake triggers that add your templates."],
  [
    "Emails",
    "We'll verify your merge fields and make sure your templates are named and organized so they're easy to find and use.",
  ],
  ["Tasks", "We'll make sure the tasks and templates you need are in place for smooth task management."],
  ["Forms", "We'll review your intake form setup and suggest improvements."],
  ["Views", "We'll make sure the property, contact, and task views your team needs are in place."],
];
const TERMS = [
  ["Delivery", "Within 5 business days."],
  ["Deliverables", "A recorded walkthrough and a written report on what to fix, work on, or improve."],
  ["Bonus Offer", `Your $${AUDIT_FEE} is credited toward implementation if you hire us to make the updates.`],
];

// The $55 OTC Audit: a short pitch, then the request form (on submit it's
// saved and they go on to pay).
export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const closed = auditClosed();

  return (
    <main className="flex flex-1 flex-col bg-bg">
      <section className="bg-navy text-white">
        <div className="mx-auto max-w-3xl px-5 py-12 sm:px-6">
          <div className="text-center">
            <div className="font-caption text-xs font-semibold uppercase tracking-wide text-gold">
              Slow Season Special &middot; Closes New Year&rsquo;s Day
            </div>
            <h1 className="mt-3 font-display text-3xl font-bold sm:text-4xl">
              The ${AUDIT_FEE} OTC Audit
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-white/80 sm:text-base">
              Figure out what&rsquo;s broken, missing, and could work harder in your Open to Close
              account.
            </p>
          </div>
          <div className="mx-auto mt-8 max-w-2xl rounded-xl bg-white/10 p-5 text-center">
            <h2 className="font-caption text-xs font-semibold uppercase tracking-wide text-gold">
              Service Outline
            </h2>
            <p className="mt-3 text-sm font-semibold text-white">We&rsquo;ll review your OTC account:</p>
            <ul className="mt-3 flex flex-col gap-2.5 text-sm text-white/90">
              {CHECKS.map(([label, text]) => (
                <li key={label}>
                  <span aria-hidden className="mr-1.5 text-gold">
                    &#10003;
                  </span>
                  <span className="font-semibold text-white">{label}:</span> {text}
                </li>
              ))}
            </ul>
            <dl className="mt-5 flex flex-col gap-2 border-t border-white/15 pt-4 text-sm">
              {TERMS.map(([label, text]) => (
                <div key={label}>
                  <dt className="inline font-semibold text-gold">{label}:</dt>{" "}
                  <dd className="inline text-white/90">{text}</dd>
                </div>
              ))}
            </dl>
          </div>
          <p className="mx-auto mt-5 max-w-2xl text-center text-sm text-white/80">
            From someone who&rsquo;s set up almost 300 Open to Close accounts over 5 years and trained
            2,000+ people.
          </p>
        </div>
      </section>

      <div className="mx-auto w-full max-w-2xl px-4 py-10">
        {closed && (
          <div className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-ink-soft">
            This offer closed on New Year&rsquo;s Day. Thanks for your interest!
          </div>
        )}
        {error && (
          <div className="mb-5 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        {!closed && <AuditForm />}
      </div>
      <MarketingFooter />
    </main>
  );
}
