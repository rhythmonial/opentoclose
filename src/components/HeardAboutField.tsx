"use client";

import { useState } from "react";

const OPTIONS = ["OTC FB Group", "YouTube", "OTC Staff", "Referral", "Other"];

export function HeardAboutField() {
  const [value, setValue] = useState("");
  const showDetail = value === "Referral" || value === "Other";

  return (
    <>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink">
          How did you hear about us?
        </span>
        <select
          name="heard_about"
          required
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent"
        >
          <option value="" disabled>
            Select one
          </option>
          {OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      {showDetail && (
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">
            {value === "Referral" ? "Who referred you?" : "Please specify"}
          </span>
          <input
            name="heard_about_detail"
            required
            className="rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent"
          />
        </label>
      )}
    </>
  );
}
