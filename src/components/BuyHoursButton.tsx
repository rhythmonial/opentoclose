"use client";

import { useEffect, useState } from "react";
import { BuyHoursOptions, HourStats } from "@/components/HoursSection";

// A + button that opens the setup hours popup (the same one as Request a
// Set Up on a lesson): their hours, and the 10-hour bundle and by-the-hour
// boxes to buy more. Stripe brings them back to `returnTo`.
export function BuyHoursButton({
  purchased,
  used,
  hourlyRate,
  canBuy,
  returnTo,
}: {
  purchased: number;
  used: number;
  hourlyRate: number;
  // Only the account owner buys hours.
  canBuy: boolean;
  returnTo: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Buy more setup hours"
        title="Buy more setup hours"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent text-white hover:opacity-90"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" aria-hidden>
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="buy-hours-title"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-surface p-5 text-left shadow-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 id="buy-hours-title" className="text-[15px] font-bold text-ink">
                Setup hours
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-faint hover:bg-bg hover:text-ink"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden>
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="mt-1 text-sm text-ink-soft">
              Hours our team uses to set things up for you. Buy more any time.
            </p>
            <HourStats purchased={purchased} used={used} />
            {canBuy ? (
              <BuyHoursOptions hourlyRate={hourlyRate} returnTo={returnTo} />
            ) : (
              <p className="mt-4 text-xs text-ink-faint">
                Ask your account owner to buy more setup hours.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
