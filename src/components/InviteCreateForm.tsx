"use client";

import { useActionState } from "react";
import { createInvite, type InviteFormState } from "@/app/dashboard/coupon-actions";
import { CopyLinkButton } from "@/components/CopyLinkButton";

const field =
  "rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent";

// New invite link: who it's for and how many free days (30 by default).
// Shows the link to copy and send once it's made.
export function InviteCreateForm() {
  const [state, action, pending] = useActionState<InviteFormState, FormData>(createInvite, null);

  return (
    <div className="flex flex-col gap-3">
      <form action={action} className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[14rem] flex-1 flex-col gap-1.5">
          <span className="text-xs font-medium text-ink-soft">For (name or email)</span>
          <input name="note" required maxLength={120} autoComplete="off" className={field} />
        </label>
        <label className="flex w-28 flex-col gap-1.5">
          <span className="text-xs font-medium text-ink-soft">Free days</span>
          <input name="free_days" type="number" min={1} max={365} defaultValue={30} className={field} />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create invite link"}
        </button>
      </form>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      {state?.link && (
        <div className="flex flex-col gap-2 rounded-lg border border-success/30 bg-success-soft px-3.5 py-3 text-sm sm:flex-row sm:items-center">
          <span className="shrink-0 font-semibold text-success">Link for {state.note}:</span>
          <code className="min-w-0 flex-1 truncate text-ink">{state.link}</code>
          <CopyLinkButton link={state.link} />
        </div>
      )}
    </div>
  );
}
