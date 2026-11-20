"use client";

import { useState } from "react";
import { deleteAuditRequest } from "../actions";

// A trash icon beside Save: the first click asks, and only "Delete" deletes.
export function DeleteAudit({ id, name }: { id: string; name: string }) {
  const [asking, setAsking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  if (!asking) {
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        title="Delete this audit request"
        aria-label={`Delete ${name}'s audit request`}
        className="rounded-lg border border-border p-2.5 text-ink-faint hover:border-danger hover:text-danger"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
        </svg>
      </button>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-ink-soft">Delete this request for good?</span>
      <button
        type="button"
        disabled={deleting}
        onClick={async () => {
          setDeleting(true);
          const res = await deleteAuditRequest(id);
          // On success it goes back to Clients; this only runs if it didn't.
          if (res && !res.ok) {
            setDeleting(false);
            window.alert(res.error ?? "Couldn't delete it.");
          }
        }}
        className="rounded-lg bg-danger px-4 py-2 font-semibold text-white disabled:opacity-50"
      >
        {deleting ? "Deleting…" : "Delete"}
      </button>
      <button type="button" onClick={() => setAsking(false)} className="font-semibold text-ink-soft">
        Cancel
      </button>
    </span>
  );
}
