"use client";

import { useState } from "react";
import { ACCESS_METHODS, AUDIT_FEE, AUDIT_TEXT_NUMBER } from "@/lib/audits";
import { submitAuditRequest } from "./actions";

const INPUT =
  "w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent";

// The audit request form. Their OTC login is typed in below, or texted
// (with the message filled in with their name and team).
export function AuditForm() {
  const [name, setName] = useState("");
  const [team, setTeam] = useState("");
  const [access, setAccess] = useState("");
  const message = `OTC Audit for ${name.trim() || "{{Name}}"} at ${team.trim() || "{{Team or Brokerage Name}}"} - (add username), (add password)`;

  return (
    <form action={submitAuditRequest} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink">Name</span>
        <input
          name="name"
          required
          maxLength={120}
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={INPUT}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink">Email</span>
        <input name="email" type="email" required maxLength={200} autoComplete="email" className={INPUT} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink">Phone</span>
        <input name="phone" type="tel" required maxLength={40} autoComplete="tel" className={INPUT} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink">Team or Brokerage Name</span>
        <input
          name="team_name"
          required
          maxLength={200}
          autoComplete="organization"
          value={team}
          onChange={(e) => setTeam(e.target.value)}
          className={INPUT}
        />
      </label>
      <label className="flex flex-col gap-1.5 sm:col-span-2">
        <span className="text-sm font-medium text-ink">
          What&rsquo;s frustrating you about your OTC setup?
        </span>
        <textarea name="frustrations" required rows={4} maxLength={4000} className={INPUT} />
      </label>
      <label className="flex flex-col gap-1.5 sm:col-span-2">
        <span className="text-sm font-medium text-ink">Your Open to Close login</span>
        <select
          name="access_method"
          required
          value={access}
          onChange={(e) => setAccess(e.target.value)}
          className={INPUT}
        >
          <option value="" disabled>
            Select one
          </option>
          {ACCESS_METHODS.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
      </label>
      {access === "provide_below" && (
        <>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">OTC Username</span>
            <input name="otc_username" required maxLength={200} autoComplete="off" className={INPUT} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">OTC Password</span>
            <input
              name="otc_password"
              type="password"
              required
              maxLength={200}
              autoComplete="new-password"
              className={INPUT}
            />
          </label>
          <p className="-mt-1 text-xs text-ink-faint sm:col-span-2">
            Your password is encrypted when it&rsquo;s saved and only used for your audit.
          </p>
        </>
      )}
      {access === "share_directly" && (
        <div className="rounded-lg border border-accent-soft bg-accent-soft/40 px-4 py-3 text-sm text-ink sm:col-span-2">
          Please text{" "}
          <a href={`sms:${AUDIT_TEXT_NUMBER.replace(/-/g, "")}`} className="font-semibold text-accent underline">
            {AUDIT_TEXT_NUMBER}
          </a>{" "}
          the following:
          <p className="mt-2 rounded-md bg-surface px-3 py-2 font-medium">&ldquo;{message}&rdquo;</p>
        </div>
      )}

      <div className="mt-2 flex flex-col items-center gap-2 sm:col-span-2">
        <button type="submit" className="w-full rounded-lg bg-accent px-8 py-3 text-sm font-semibold text-white sm:w-auto">
          Continue to payment (${AUDIT_FEE})
        </button>
        <span className="text-center text-xs text-ink-faint">
          You&rsquo;ll pay securely through Stripe. Every submission is reviewed, and we&rsquo;ll email
          you your delivery date.
        </span>
      </div>
    </form>
  );
}
