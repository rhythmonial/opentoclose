"use client";

import { useEffect, useState, useTransition } from "react";
import { cancelClientSubscription } from "@/app/dashboard/billing-actions";

export type SubscriptionInfo = {
  status: string;
  cancel_at_period_end: boolean;
  current_period_end: string | null;
} | null;

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

const pill =
  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold font-caption uppercase tracking-wide";

// A client's monthly subscription, for staff: Active (click to cancel, with
// an optional reason), Ends <date> once cancelled, Past due, Cancelled, or
// No subscription.
export function SubscriptionStatus({
  accountId,
  accountName,
  subscription,
  freeUntil = null,
  comped = false,
}: {
  accountId: string;
  accountName: string;
  subscription: SubscriptionInfo;
  // A coupon's free month, running until this date.
  freeUntil?: string | null;
  // Given their plan at no charge.
  comped?: boolean;
}) {
  // Where the cancel popover opens (fixed, so the table's scrolling box
  // doesn't clip it); null when closed.
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const open = at !== null;
  const setOpen = (v: boolean) => {
    if (!v) setAt(null);
  };
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!at) return;
    const close = () => setAt(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [at]);

  const s = subscription;
  const live = s && ["active", "trialing", "past_due"].includes(s.status);

  if (!live && comped) {
    return <span className={`${pill} bg-success-soft text-success`}>No charge</span>;
  }
  if (!live && freeUntil) {
    return (
      <span className={`${pill} bg-accent-soft text-accent`} title="Coupon free month">
        Free month &middot; ends {day(freeUntil)}
      </span>
    );
  }
  if (!s) return <span className={`${pill} bg-border-soft text-ink-faint`}>No subscription</span>;
  if (!live) return <span className={`${pill} bg-border-soft text-ink-soft`}>Cancelled</span>;
  if (s.cancel_at_period_end) {
    return (
      <span className={`${pill} bg-warning-soft text-warning`}>
        Ends {s.current_period_end ? day(s.current_period_end) : "soon"}
      </span>
    );
  }

  const label = s.status === "past_due" ? "Past due" : "Active";
  return (
    <span className="inline-block">
      <button
        type="button"
        onClick={(e) => {
          if (at) return setAt(null);
          const r = e.currentTarget.getBoundingClientRect();
          setAt({ top: r.bottom + 6, left: Math.max(8, Math.min(r.right - 288, window.innerWidth - 296)) });
        }}
        title="Click to cancel this subscription"
        className={`${pill} ${
          s.status === "past_due" ? "bg-danger/10 text-danger" : "bg-success-soft text-success"
        } hover:opacity-80`}
      >
        {label}
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div
          style={{ top: at.top, left: at.left }}
          className="fixed z-50 w-72 rounded-lg border border-border bg-surface p-3 text-left shadow-lg"
        >
          <p className="text-sm font-semibold text-ink">Cancel {accountName}&rsquo;s subscription?</p>
          <p className="mt-0.5 text-xs text-ink-soft">
            They keep access until{" "}
            {s.current_period_end ? day(s.current_period_end) : "the end of the paid month"}, then
            it stops renewing.
          </p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Reason (optional)"
            aria-label="Cancellation reason"
            className="mt-2 w-full rounded-md border border-border bg-bg px-2 py-1.5 text-xs text-ink outline-none focus:border-accent"
          />
          {error && <p className="mt-1 text-xs text-danger">{error}</p>}
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md px-2.5 py-1 text-xs font-semibold text-ink-soft"
            >
              Keep it
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await cancelClientSubscription(accountId, reason);
                  if (result.ok) setOpen(false);
                  else setError(result.error ?? "Couldn't cancel.");
                })
              }
              className="rounded-md bg-danger px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-60"
            >
              {pending ? "Cancelling…" : "Cancel subscription"}
            </button>
          </div>
        </div>
      )}
    </span>
  );
}
