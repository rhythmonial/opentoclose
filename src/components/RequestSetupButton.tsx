"use client";

import { useEffect, useState } from "react";
import { BuyHoursOptions, HourStats } from "@/components/HoursSection";
import { requestStepSetup } from "@/app/support/actions";

// "Request a Set Up" on a step our team handles, for DIY clients: a popup
// with their setup hours. With hours left they send the request; without,
// they can buy the 10-hour bundle or hours by the hour first.
export function RequestSetupButton({
  stepId,
  stepTitle,
  purchased,
  used,
  hourlyRate,
  canBuy,
  requested,
  disabled,
}: {
  stepId: string;
  stepTitle: string;
  purchased: number;
  used: number;
  hourlyRate: number;
  // Only the account owner buys hours.
  canBuy: boolean;
  // Already requested (and not closed yet).
  requested: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const left = purchased - used;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (requested) {
    return (
      <p className="rounded-xl border border-success/30 bg-success-soft px-4 py-3 text-sm font-medium text-success">
        Set up requested. Our team will be in touch to get it done.
      </p>
    );
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        Request a Set Up
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
            aria-labelledby="request-setup-title"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-surface p-5 shadow-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 id="request-setup-title" className="text-[15px] font-bold text-ink">
                Request a Set Up
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
              Our team will set up &ldquo;{stepTitle}&rdquo; for you using your setup hours.
            </p>

            <h3 className="mt-4 text-xs font-bold uppercase tracking-wide text-ink-faint">
              Your setup hours
            </h3>
            <HourStats purchased={purchased} used={used} />

            {left > 0 ? (
              <form action={requestStepSetup} className="mt-4">
                <input type="hidden" name="step_id" value={stepId} />
                <button
                  type="submit"
                  className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
                >
                  Request
                </button>
              </form>
            ) : (
              <>
                <p className="mt-4 text-sm text-ink">
                  You don&rsquo;t have any setup hours left. Get more hours to request this set up.
                </p>
                {canBuy ? (
                  <BuyHoursOptions hourlyRate={hourlyRate} returnTo={`/lesson/${stepId}`} />
                ) : (
                  <p className="mt-2 text-xs text-ink-faint">
                    Ask your account owner to buy more setup hours.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
