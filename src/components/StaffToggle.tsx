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
      title="Our team handles this step"
      className="ml-1.5 inline-flex items-center gap-1 align-middle text-xs font-medium text-ink-soft"
      onClick={(e) => e.stopPropagation()}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={saving}
        onChange={async (e) => {
          const next = e.target.checked;
          setChecked(next);
          setSaving(true);
          await updateStepIsStaff(stepId, next);
          setSaving(false);
        }}
        className="h-3.5 w-3.5"
      />
      Staff
    </label>
  );
}
