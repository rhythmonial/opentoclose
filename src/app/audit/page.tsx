import type { Metadata } from "next";
import { MarketingFooter } from "@/components/MarketingFooter";
import { AUDIT_FEE, auditClosed } from "@/lib/audits";
import { AuditForm } from "./AuditForm";

export const metadata: Metadata = {
  title: "$55 OTC Audit | OTC Setup with Josie",
  description:
    "A review of your Open to Close account with a recorded walkthrough and written report of what's broken, missing, or could be optimized.",
};

const POINTS = [
  "We review your OTC account: fields, dates, templates, tasks, forms, and views.",
  "Within 5 business days, you'll get a recorded walkthrough and a written report on what you should fix, work on, or improve.",
  `If you hire us to work through the updates, the $${AUDIT_FEE} is credited towards implementation.`,
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
          <div className="mx-auto mt-8 max-w-2xl rounded-xl bg-white/10 p-5">
            <h2 className="font-caption text-xs font-semibold uppercase tracking-wide text-gold">
              Service Outline
            </h2>
            <ul className="mt-3 flex flex-col gap-2.5 text-sm text-white">
              {POINTS.map((p) => (
                <li key={p} className="flex gap-2.5">
                  <span aria-hidden className="mt-0.5 text-gold">
                    &#10003;
                  </span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
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
