"use client";

import { useEffect, useRef, useState } from "react";

// The + button beside "Your team": opens a popup to invite a teammate. It
// opens by itself after an invite is sent or fails, to show the result.
export function InviteTeammateButton({
  action,
  error,
  invited,
}: {
  action: (formData: FormData) => void | Promise<void>;
  error?: string;
  invited?: boolean;
}) {
  const [open, setOpen] = useState(Boolean(error || invited));
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    dialog.current?.querySelector<HTMLInputElement>("input[type=email]")?.focus();
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
        aria-label="Invite a teammate"
        title="Invite a teammate"
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white hover:opacity-90"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
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
            ref={dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="invite-teammate-title"
            className="w-full max-w-md rounded-xl border border-border bg-surface p-5 shadow-xl"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <h3 id="invite-teammate-title" className="text-[15px] font-bold text-ink">
                Invite a teammate
              </h3>
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
            <p className="mb-3.5 text-sm text-ink-soft">
              They&rsquo;ll get an email to set their password and sign in as an admin on your
              account.
            </p>

            {error && (
              <div className="mb-3.5 rounded-lg border border-danger/30 bg-danger/5 px-3.5 py-2.5 text-sm text-danger">
                {error}
              </div>
            )}
            {invited && (
              <div className="mb-3.5 rounded-lg border border-success/30 bg-success-soft px-3.5 py-2.5 text-sm text-success">
                Invite sent.
              </div>
            )}

            <form action={action} className="flex flex-col gap-3">
              <input
                type="email"
                name="email"
                required
                placeholder="teammate@example.com"
                className="rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent"
              />
              <button
                type="submit"
                className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                Send invite
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
