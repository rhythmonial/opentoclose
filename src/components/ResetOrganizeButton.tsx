"use client";

import { useState } from "react";
import { resetFieldOrganization } from "@/app/configurator/organize_your_fields/actions";

// Puts the field groups back in Open to Close's layout, once they confirm.
export function ResetOrganizeButton({ accountId }: { accountId: string | null }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        if (
          !window.confirm(
            "Refresh all groups? This puts every section and field back where Open to Close has them and clears the moves you've made.",
          )
        )
          return;
        setBusy(true);
        const res = await resetFieldOrganization(accountId);
        if (!res.ok) {
          setBusy(false);
          window.alert(res.error ?? "Couldn't refresh your groups.");
          return;
        }
        window.location.reload();
      }}
      className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-ink-soft hover:border-accent hover:text-accent disabled:opacity-50"
    >
      <span aria-hidden className="text-base leading-none">&#8634;</span>
      {busy ? "Refreshing…" : "Refresh all groups"}
    </button>
  );
}
