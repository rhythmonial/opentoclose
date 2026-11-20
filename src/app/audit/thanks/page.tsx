import type { Metadata } from "next";
import Link from "next/link";
import { MarketingFooter } from "@/components/MarketingFooter";
import { getStripe } from "@/lib/stripe";
import { markAuditPaid } from "@/lib/auditPayments";
import { AUDIT_TEXT_NUMBER } from "@/lib/audits";
import { AuditLogo } from "../AuditLogo";

export const metadata: Metadata = {
  title: "Thanks for booking your OTC Audit | OTC Setup with Josie",
};

const STEPS = [
  "You'll receive an email within 24 hours with your Audit Date.",
  `If you chose to share your Open to Close login directly, text it to ${AUDIT_TEXT_NUMBER} ("OTC Audit for [your name] at [your team] - username, password").`,
  "Within 5 business days of your Audit Date, you'll get a recorded walkthrough and a written report on what to fix, work on, or improve.",
  "If you'd like us to make the updates, your audit fee is credited toward implementation.",
];

// Where Stripe Checkout sends them after paying: the payment is checked
// (and the request marked paid, in case the webhook hasn't yet).
export default async function AuditThanksPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;
  let paid = true;
  if (session_id && /^cs_[A-Za-z0-9_]+$/.test(session_id)) {
    try {
      const session = await getStripe().checkout.sessions.retrieve(session_id);
      paid = session.payment_status === "paid";
      if (paid) await markAuditPaid(session);
    } catch (err) {
      console.error(`Couldn't check audit checkout ${session_id}:`, err);
    }
  }

  return (
    <main className="flex flex-1 flex-col bg-bg">
      <div className="mx-auto w-full max-w-2xl px-4 py-12">
        <AuditLogo className="mb-6" />
        {paid ? (
          <>
            <div className="rounded-xl border border-success/30 bg-success-soft p-6 text-center">
              <h1 className="font-display text-2xl font-bold text-success">You&rsquo;re booked!</h1>
              <p className="mt-2 text-sm text-ink-soft">Thanks for booking your OTC Audit. Here&rsquo;s what happens next.</p>
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
          </>
        ) : (
          <div className="rounded-xl border border-border bg-surface p-6 text-center">
            <h1 className="font-display text-2xl font-bold text-ink">Your payment didn&rsquo;t go through</h1>
            <p className="mt-2 text-sm text-ink-soft">
              Your audit isn&rsquo;t booked yet. Please try again, or text {AUDIT_TEXT_NUMBER} and we&rsquo;ll help.
            </p>
            <Link href="/audit" className="mt-4 inline-block rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-white">
              Back to the OTC Audit
            </Link>
          </div>
        )}
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
