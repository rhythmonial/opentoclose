"use client";

import { useEffect, useState } from "react";
import { AskQuestionForm, type LessonChoice } from "@/components/AskQuestionForm";

// "Get support" at the bottom of a lesson: opens the question form with
// this lesson already picked.
export function SupportButton({
  lessons,
  stepId,
}: {
  lessons: LessonChoice[];
  stepId: string;
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
        className="flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-ink hover:border-accent hover:text-accent"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="10" />
          <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01" />
        </svg>
        Get support
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
            aria-labelledby="support-title"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-surface p-5 text-left shadow-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="support-title" className="text-[15px] font-bold text-ink">
                  Get support
                </h2>
                <p className="mt-0.5 text-sm text-ink-soft">
                  Ask Josie&rsquo;s team. We usually respond within 24 hours.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-ink-faint hover:bg-bg hover:text-ink"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden>
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="mt-4">
              <AskQuestionForm
                lessons={lessons}
                defaultStepId={stepId}
                returnTo={`/lesson/${stepId}`}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
