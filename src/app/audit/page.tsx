import type { Metadata } from "next";
import { MarketingFooter } from "@/components/MarketingFooter";
import { AuditLogo } from "./AuditLogo";
import { AUDIT_FEE, auditClosed } from "@/lib/audits";
import { AuditForm } from "./AuditForm";

export const metadata: Metadata = {
  title: "$55 OTC Audit | OTC Setup with Josie",
  description:
    "A review of your Open to Close account with a recorded walkthrough and written report of what's broken, missing, or could be optimized.",
};

// What the audit covers, then how it's delivered.
const CHECKS = [
  ["Fields", "Audit your field order for intake and workflow efficiency."],
  ["Dates", "Confirm date calculations and intake trigger functionality."],
  ["Emails", "Verify accuracy with your merge fields and templates."],
  ["Tasks", "Make sure the tasks and templates you need are in place."],
  ["Forms", "Review your intake form setup and suggest improvements."],
  ["Views", "Make sure the property, contact, and task views needed are in place."],
];
const TERMS = [
  ["Turn-Around Time", "All deliverables will be emailed within 5 business days from your Audit Date."],
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
            <AuditLogo onDark className="mb-6" />
            <div className="font-caption text-xs font-semibold uppercase tracking-wide text-gold">
              Slow Season Special &middot; Expires 12/31/26
            </div>
            <h1 className="mt-3 font-display text-3xl font-bold sm:text-4xl">
              The ${AUDIT_FEE} OTC Audit
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-white/80 sm:text-base">
              Figure out what&rsquo;s broken, missing, and could work harder in your Open to Close
              account.
            </p>
            <p className="mx-auto mt-2 max-w-2xl text-sm text-white/80">
              From someone who&rsquo;s set up almost 300 Open to Close accounts over 5 years and trained
              2,000+ people.
            </p>
          </div>
          <div className="mx-auto mt-8 max-w-2xl rounded-xl bg-surface p-5 text-center shadow-sm">
            <h2 className="font-caption text-xs font-semibold uppercase tracking-wide text-navy">
              Service Outline
            </h2>
            <ul className="mt-3 flex flex-col gap-2.5 text-sm text-navy">
              {CHECKS.map(([label, text]) => (
                <li key={label}>
                  <span aria-hidden className="mr-1.5 text-gold">
                    &#10003;
                  </span>
                  <span className="font-semibold">{label}:</span> {text}
                </li>
              ))}
            </ul>
            <dl className="mt-5 flex flex-col gap-2 border-t border-border-soft pt-4 text-sm text-navy">
              {TERMS.map(([label, text]) => (
                <div key={label}>
                  <dt className="inline font-semibold">{label}:</dt>{" "}
                  <dd className="inline">{text}</dd>
                </div>
              ))}
            </dl>
          </div>
          <p className="mx-auto mt-5 max-w-2xl text-center text-sm font-semibold text-gold">
            We take 5 audits a week. Audit dates are first come, first served, and this offer expires on
            12/31/26.
          </p>
        </div>
      </section>

      <div className="mx-auto w-full max-w-2xl px-4 py-10">
        {closed && (
          <div className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-ink-soft">
            This offer expired on 12/31/26. Thanks for your interest!
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
