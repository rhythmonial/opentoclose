"use client";

import { useState } from "react";

// Asks why a lead or founding application was lost before it's marked lost.
export function LostReasonDialog({
  name,
  onCancel,
  onSave,
}: {
  name: string;
  onCancel: () => void;
  onSave: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="lost-reason-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
      }}
    >
      <form
        className="w-full max-w-md rounded-xl border border-border bg-surface p-5 text-left shadow-xl"
        onSubmit={(e) => {
          e.preventDefault();
          if (reason.trim()) onSave(reason.trim());
        }}
      >
        <h2 id="lost-reason-title" className="font-display text-lg font-bold text-ink">
          Why was {name} lost?
        </h2>
        <textarea
          autoFocus
          required
          rows={3}
          maxLength={1000}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason lost"
          className="mt-3 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm font-normal normal-case text-ink outline-none focus:border-accent"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-ink-soft hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!reason.trim()}
            className="rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Mark lost
          </button>
        </div>
      </form>
    </div>
  );
}
