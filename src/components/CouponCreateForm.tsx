"use client";

import { useActionState } from "react";
import { createCoupon, type CouponFormState } from "@/app/dashboard/coupon-actions";

const field =
  "rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent";

// New coupon code: the code, free days (30 by default), and optional max
// uses and last day it can be used.
export function CouponCreateForm() {
  const [state, action, pending] = useActionState<CouponFormState, FormData>(createCoupon, null);

  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink-soft">Code</span>
          <input
            name="code"
            required
            maxLength={40}
            autoComplete="off"
            placeholder="FREEMONTH"
            className={`${field} uppercase placeholder:normal-case`}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink-soft">Free days</span>
          <input name="free_days" type="number" min={1} max={365} defaultValue={30} className={field} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink-soft">Max uses (optional)</span>
          <input name="max_redemptions" type="number" min={1} placeholder="No limit" className={field} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink-soft">Usable until (optional)</span>
          <input name="expires_on" type="date" className={field} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create coupon"}
        </button>
        {state?.error && <span className="text-sm text-danger">{state.error}</span>}
        {state?.created && (
          <span className="text-sm font-semibold text-success">Created {state.created}.</span>
        )}
      </div>
    </form>
  );
}
