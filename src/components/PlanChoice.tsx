"use client";

import { useState } from "react";

const inputClass =
  "rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent";

const optionClass =
  "flex w-44 cursor-pointer flex-col gap-1 rounded-lg border border-border bg-surface px-3.5 py-3 has-[:checked]:border-accent has-[:checked]:bg-accent-soft";

export function PlanChoice({
  defaultPlan,
  defaultOtcUsername,
  otcPasswordSaved,
}: {
  defaultPlan: "diy" | "custom";
  defaultOtcUsername: string;
  otcPasswordSaved: boolean;
}) {
  const [plan, setPlan] = useState(defaultPlan);

  return (
    <div className="flex flex-col gap-1.5 sm:col-span-2">
      <div
        role="radiogroup"
        aria-label="How would you like your setup handled?"
        className="flex flex-wrap justify-center gap-3"
      >
        <label className={optionClass}>
          <span className="flex items-center justify-center gap-2 text-sm font-semibold text-ink">
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
        </label>
        <label className={optionClass}>
          <span className="flex items-center justify-center gap-2 text-sm font-semibold text-ink">
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
        </label>
      </div>
      <p className="mt-1 text-center text-sm text-ink-soft">
        {plan === "diy" ? (
          <>
            For the DIY setup, you complete every step yourself, using our
            checklist and videos as your guide.
            <br />
            You can upgrade to a setup if you decide you&rsquo;d like our help
            later.
          </>
        ) : (
          "The Setup is a 10-hour bundle which covers both your 1-on-1 Zoom sessions and behind-the-scenes implementation work. Unlike flat-fee services, our approach is transparent and flexible — you’re only billed for actual hours worked. We believe this is the fairest way to deliver a setup that’s truly customized to your business, without overcharging for unused hours or vague deliverables."
        )}
      </p>

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
          <span className="text-center text-xs text-ink-soft sm:col-span-2">
            Your Open to Close login lets our team sign in and build your
            setup. Only our team can see it.
          </span>
        </div>
      )}
    </div>
  );
}
