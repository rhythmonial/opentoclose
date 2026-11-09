"use client";

import { useActionState, useState } from "react";
import { createInvite, type InviteFormState } from "@/app/dashboard/coupon-actions";
import { CopyLinkButton } from "@/components/CopyLinkButton";

const field =
  "rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent";

// New invite link: a one-time link for one person, or a group link for a
// mass email (anyone with it, once per account, optionally capped). Shows
// the link to copy once it's made.
export function InviteCreateForm() {
  const [state, action, pending] = useActionState<InviteFormState, FormData>(createInvite, null);
  const [kind, setKind] = useState<"one" | "group">("one");
  const group = kind === "group";

  return (
    <div className="flex flex-col gap-3">
      <form action={action} className="flex flex-col gap-3">
        <div role="radiogroup" aria-label="Kind of invite" className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2 font-medium text-ink">
            <input
              type="radio"
              name="kind"
              value="one"
              checked={!group}
              onChange={() => setKind("one")}
              className="h-4 w-4 accent-accent"
            />
            One person (works once)
          </label>
          <label className="flex items-center gap-2 font-medium text-ink">
            <input
              type="radio"
              name="kind"
              value="group"
              checked={group}
              onChange={() => setKind("group")}
              className="h-4 w-4 accent-accent"
            />
            Group link for an email (once per account)
          </label>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-[14rem] flex-1 flex-col gap-1.5">
            <span className="text-xs font-medium text-ink-soft">
              {group ? "Label" : "For (name or email)"}
            </span>
            <input
              name="note"
              required
              maxLength={120}
              autoComplete="off"
              placeholder={group ? "Past clients email" : undefined}
              className={field}
            />
          </label>
          <label className="flex w-28 flex-col gap-1.5">
            <span className="text-xs font-medium text-ink-soft">Free days</span>
            <input name="free_days" type="number" min={1} max={365} defaultValue={30} className={field} />
          </label>
          {group && (
            <>
              <label className="flex w-36 flex-col gap-1.5">
                <span className="text-xs font-medium text-ink-soft">Max uses (optional)</span>
                <input name="max_redemptions" type="number" min={1} placeholder="No limit" className={field} />
              </label>
              <label className="flex w-44 flex-col gap-1.5">
                <span className="text-xs font-medium text-ink-soft">Last day (optional)</span>
                <input name="expires_on" type="date" className={field} />
              </label>
            </>
          )}
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {pending ? "Creating…" : "Create invite link"}
          </button>
        </div>
      </form>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      {state?.link && (
        <div className="flex flex-col gap-2 rounded-lg border border-success/30 bg-success-soft px-3.5 py-3 text-sm sm:flex-row sm:items-center">
          <span className="shrink-0 font-semibold text-success">
            {state.group ? `Group link (${state.note}):` : `Link for ${state.note}:`}
          </span>
          <code className="min-w-0 flex-1 truncate text-ink">{state.link}</code>
          <CopyLinkButton link={state.link} />
        </div>
      )}
    </div>
  );
}
