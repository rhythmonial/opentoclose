import type { Metadata } from "next";
import Link from "next/link";
import { MarketingFooter } from "@/components/MarketingFooter";
import { AuditLogo } from "../AuditLogo";

export const metadata: Metadata = {
  title: "Thanks for booking your OTC Audit | OTC Setup with Josie",
};

const STEPS = [
  "If you chose to share your Open to Close login directly, text it to 813-906-6019 (\"OTC Audit for [your name] at [your team] - username, password\").",
  "Once I'm in, I review your account and record a walkthrough of what I find.",
  "Within 5 business days you'll get the recording plus a written report: what's broken, what's missing, and what could be optimized.",
  "If you'd like me to make the fixes, your audit fee is credited toward implementation.",
];

// Where the Stripe Payment Link sends them after paying (and where the form
// lands if payment isn't set up yet).
export default async function AuditThanksPage({
  searchParams,
}: {
  searchParams: Promise<{ unpaid?: string }>;
}) {
  const { unpaid } = await searchParams;
  return (
    <main className="flex flex-1 flex-col bg-bg">
      <div className="mx-auto w-full max-w-2xl px-4 py-12">
        <AuditLogo className="mb-6" />
        <div className="rounded-xl border border-success/30 bg-success-soft p-6 text-center">
          <h1 className="font-display text-2xl font-bold text-success">
            {unpaid ? "Your request is in!" : "You're booked!"}
          </h1>
          <p className="mt-2 text-sm text-ink-soft">
            {unpaid
              ? "Thanks for requesting an OTC Audit. I'll email you shortly with how to pay and next steps."
              : "Thanks for booking your OTC Audit. Here's what happens next."}
          </p>
        </div>
        <ol className="mt-6 flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 text-sm text-ink">
          {STEPS.map((s, i) => (
            <li key={s} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">
                {i + 1}
              </span>
              <span className="pt-0.5">{s}</span>
            </li>
          ))}
        </ol>
        <div className="mt-6 text-center">
          <Link href="/" className="text-sm font-semibold text-accent">
            &larr; Back to OTC Setup
          </Link>
        </div>
      </div>
      <MarketingFooter />
    </main>
  );
}
