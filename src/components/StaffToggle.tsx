"use client";

import { useState } from "react";
import { updateStepIsStaff } from "@/app/profile/setup-steps-actions";

// Whether our team handles this step. Every plan sees every step; staff
// steps are checked off by us instead of the client.
export function StaffToggle({
  stepId,
  value,
}: {
  stepId: string;
  value: boolean;
}) {
  const [checked, setChecked] = useState(value);
  const [saving, setSaving] = useState(false);

  return (
    <label
      title={checked ? "Our team handles this step" : "Mark as a step our team handles"}
      className="ml-1.5 inline-flex cursor-pointer items-center align-middle"
      onClick={(e) => e.stopPropagation()}
    >
      {/* The real checkbox stays for keyboards and screen readers; the
          square beside it shows an S when checked. */}
      <input
        type="checkbox"
        aria-label="Staff: our team handles this step"
        checked={checked}
        disabled={saving}
        onChange={async (e) => {
          const next = e.target.checked;
          setChecked(next);
          setSaving(true);
          await updateStepIsStaff(stepId, next);
          setSaving(false);
        }}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={`flex h-4 w-4 items-center justify-center rounded border text-[10px] font-bold leading-none peer-focus-visible:ring-2 peer-focus-visible:ring-accent/40 ${
          checked ? "border-accent bg-accent text-white" : "border-ink-faint bg-surface"
        } ${saving ? "opacity-60" : ""}`}
      >
        {checked ? "S" : ""}
      </span>
    </label>
  );
}
