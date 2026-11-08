"use client";

import { useEffect, useState, type ReactNode } from "react";

// A headset icon on a client's page (left of the + button) with a bubble
// for questions waiting on us; opens a popup with their questions and the
// answer boxes (passed in as children).
export function TechSupportButton({
  openCount,
  defaultOpen = false,
  children,
}: {
  openCount: number;
  // Opened from the Tech support list on the Clients page.
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

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
        aria-label={
          openCount > 0
            ? `Tech support, ${openCount} question${openCount === 1 ? "" : "s"} waiting`
            : "Tech support"
        }
        title="Tech support"
        className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-ink hover:border-accent hover:text-accent"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 14v-3a9 9 0 0 1 18 0v3" />
          <path d="M21 15a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2zM3 15a2 2 0 0 0 2 2h1v-6H5a2 2 0 0 0-2 2z" />
          <path d="M18 17v1a3 3 0 0 1-3 3h-3" />
        </svg>
        {openCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 font-caption text-[10px] font-bold text-white">
            {openCount}
          </span>
        )}
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
            aria-labelledby="tech-support-title"
            className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-surface text-left shadow-xl"
          >
            <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
              <h2 id="tech-support-title" className="text-[15px] font-bold text-ink">
                Tech support
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
            <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
          </div>
        </div>
      )}
    </>
  );
}
