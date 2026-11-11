"use client";

import { useState } from "react";
import { resetFinalizeFields } from "@/app/configurator/select_otc_fields/actions";

// Puts Finalize Your Fields back to how it started, once they confirm.
export function ResetFinalizeButton({ accountId }: { accountId: string | null }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        if (
          !window.confirm(
            "Refresh all fields? This undoes everything you've done here: fields you checked, renames, placeholders, fields you added and groups marked done. Fields on your contracts stay.",
          )
        )
          return;
        setBusy(true);
        const res = await resetFinalizeFields(accountId);
        if (!res.ok) {
          setBusy(false);
          window.alert(res.error ?? "Couldn't refresh your fields.");
          return;
        }
        const url = new URL(window.location.href);
        url.searchParams.delete("group");
        window.location.assign(url);
      }}
      className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-ink-soft hover:border-accent hover:text-accent disabled:opacity-50"
    >
      <span aria-hidden className="text-base leading-none">&#8634;</span>
      {busy ? "Refreshing…" : "Refresh all fields"}
    </button>
  );
}
