import type { Metadata } from "next";
import { MarketingFooter } from "@/components/MarketingFooter";
import { AUDIT_FEE } from "@/lib/audits";
import { AuditForm } from "./AuditForm";

export const metadata: Metadata = {
  title: "$55 OTC Audit | OTC Setup with Josie",
  description:
    "A review of your Open to Close account with a recorded walkthrough and written report of what's broken, missing, or could be optimized.",
};

const POINTS = [
  "I review your Open to Close account: fields, dates, templates, tasks, triggers and intake forms.",
  "You get a recorded walkthrough plus a written report: what's broken, what's missing, and what could be optimized.",
  "Delivered within 5 business days.",
  `If you hire me to make the fixes, the $${AUDIT_FEE} is credited toward implementation.`,
];

// The $55 OTC Audit: a short pitch, then the request form (on submit it's
// saved and they go on to pay).
export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex flex-1 flex-col bg-bg">
      <section className="bg-navy text-white">
        <div className="mx-auto max-w-3xl px-5 py-12 text-center sm:px-6">
          <div className="font-caption text-xs font-semibold uppercase tracking-wide text-gold">
            Slow Season Special
          </div>
          <h1 className="mt-3 font-display text-3xl font-bold sm:text-4xl">
            The ${AUDIT_FEE} OTC Audit
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-white/80 sm:text-base">
            Find out what&rsquo;s broken, what&rsquo;s missing, and what could work harder in your Open
            to Close account, from someone who&rsquo;s set up almost 300 of them over 5 years and
            trained 2,000+ people.
          </p>
        </div>
      </section>

      <div className="mx-auto w-full max-w-2xl px-4 py-10">
        <ul className="flex flex-col gap-2.5 rounded-xl border border-border bg-surface p-5 text-sm text-ink">
          {POINTS.map((p) => (
            <li key={p} className="flex gap-2.5">
              <span aria-hidden className="mt-0.5 text-success">
                &#10003;
              </span>
              <span>{p}</span>
            </li>
          ))}
        </ul>

        {error && (
          <div className="mt-6 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        <AuditForm />
      </div>
      <MarketingFooter />
    </main>
  );
}
