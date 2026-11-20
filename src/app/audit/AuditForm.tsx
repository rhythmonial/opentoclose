"use client";

import { useState } from "react";
import { ACCESS_METHODS, AUDIT_FEE, AUDIT_TEXT_NUMBER } from "@/lib/audits";
import { CopyIcon } from "@/components/CopyButton";
import { submitAuditRequest } from "./actions";

const INPUT =
  "w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent";

// The audit request form. Their OTC login is typed in below, or texted
// (with the message filled in with their name and team).
export function AuditForm() {
  const [name, setName] = useState("");
  const [team, setTeam] = useState("");
  const [phone, setPhone] = useState("");
  const [access, setAccess] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  // The text to send: shown with where their login goes; copied without
  // that, so they paste it and add their username and password.
  const opening = `OTC Audit for ${name.trim() || "{{Name}}"} at ${team.trim() || "{{Team or Brokerage Name}}"} - `;

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
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink">Email</span>
        <input name="email" type="email" required maxLength={200} autoComplete="email" className={INPUT} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink">Phone</span>
        <input
          name="phone"
          type="tel"
          inputMode="numeric"
          required
          autoComplete="tel"
          placeholder="xxx-xxx-xxxx"
          pattern="\d{3}-\d{3}-\d{4}"
          title="A 10-digit phone number: xxx-xxx-xxxx"
          value={phone}
          onChange={(e) => setPhone(formatPhone(e.target.value))}
          className={INPUT}
        />
      </label>
      <label className="flex flex-col gap-1.5 sm:col-span-2">
        <span className="text-sm font-medium text-ink">
          Tell us about your setup (how long you&rsquo;ve been in OTC and your frustrations)
        </span>
        <textarea name="frustrations" required rows={4} maxLength={4000} className={INPUT} />
      </label>
      <label className="flex flex-col gap-1.5 sm:col-span-2">
        <span className="text-sm font-medium text-ink">Your OTC Login Credentials</span>
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
            <span className="relative">
              <input
                name="otc_password"
                type={showPassword ? "text" : "password"}
                required
                maxLength={200}
                autoComplete="new-password"
                className={`${INPUT} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-ink-faint hover:text-accent"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
                  <circle cx="12" cy="12" r="3" />
                  {showPassword && <path d="M3 3l18 18" />}
                </svg>
              </button>
            </span>
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
          <p className="mt-2 flex items-start gap-2 rounded-md bg-surface px-3 py-2 font-medium">
            <CopyIcon text={opening} />
            <span>
              {opening}(add username), (add password)
            </span>
          </p>
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

// xxx-xxx-xxxx as they type (a leading 1 is dropped).
function formatPhone(raw: string) {
  const d = raw.replace(/\D/g, "").replace(/^1(?=\d{10})/, "").slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
}
