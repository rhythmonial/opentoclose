"use client";

import { useState } from "react";

const inputClass =
  "rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent";

const optionClass =
  "flex cursor-pointer flex-col gap-1 rounded-lg border border-border bg-surface px-3.5 py-3 has-[:checked]:border-accent has-[:checked]:bg-accent-soft";

export function PlanChoice({
  defaultPlan,
  defaultOtcUsername,
  otcPasswordSaved,
  showCheckoutNote,
}: {
  defaultPlan: "diy" | "custom";
  defaultOtcUsername: string;
  otcPasswordSaved: boolean;
  showCheckoutNote: boolean;
}) {
  const [plan, setPlan] = useState(defaultPlan);

  return (
    <div className="mt-2 flex flex-col gap-1.5 sm:col-span-2">
      <span className="text-sm font-medium text-ink">
        How would you like your setup handled?
      </span>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className={optionClass}>
          <span className="flex items-center gap-2 text-sm font-semibold text-ink">
            <input
              type="radio"
              name="engagement_type"
              value="diy"
              checked={plan === "diy"}
              onChange={() => setPlan("diy")}
              className="h-4 w-4"
            />
            DIY ($19)
          </span>
          <span className="text-xs text-ink-soft">
            You complete every step yourself, using our checklist and videos
            as your guide. You can upgrade to Setup later.
          </span>
        </label>
        <label className={optionClass}>
          <span className="flex items-center gap-2 text-sm font-semibold text-ink">
            <input
              type="radio"
              name="engagement_type"
              value="custom"
              checked={plan === "custom"}
              onChange={() => setPlan("custom")}
              className="h-4 w-4"
            />
            Setup ($999)
          </span>
          <span className="text-xs text-ink-soft">
            Our team builds the steps assigned to us. A 10-hour bundle.
          </span>
        </label>
      </div>

      {plan === "custom" && (
        <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">OTC Username</span>
            <input
              name="otc_username"
              required
              autoComplete="off"
              defaultValue={defaultOtcUsername}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">OTC Password</span>
            <input
              name="otc_password"
              type="password"
              required={!otcPasswordSaved}
              autoComplete="new-password"
              className={inputClass}
            />
            {otcPasswordSaved && (
              <span className="text-xs text-ink-soft">
                Saved. Leave blank to keep it.
              </span>
            )}
          </label>
          <span className="text-xs text-ink-soft sm:col-span-2">
            Your Open to Close login lets our team sign in and build your
            setup. Only our team can see it.
          </span>
        </div>
      )}

      {showCheckoutNote && (
        <span className="text-xs text-ink-soft">
          After you submit, you&rsquo;ll go to secure checkout to pay for your
          plan.
        </span>
      )}
    </div>
  );
}
