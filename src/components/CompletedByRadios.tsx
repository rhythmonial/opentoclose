"use client";

import { useState } from "react";
import { updateStepCompletedBy } from "@/app/profile/setup-steps-actions";

const OPTIONS = [
  { value: "client", label: "Client" },
  { value: "staff", label: "Staff (Setup only)" },
  { value: "staff_always", label: "Staff (always)" },
];

export function CompletedByRadios({
  stepId,
  value,
}: {
  stepId: string;
  value: string;
}) {
  const [current, setCurrent] = useState(value);
  const [saving, setSaving] = useState(false);

  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1.5"
      onClick={(e) => e.stopPropagation()}
    >
      {OPTIONS.map((opt) => (
        <label
          key={opt.value}
          className="flex items-center gap-1.5 text-xs font-medium text-ink-soft"
        >
          <input
            type="radio"
            name={`completed_by_${stepId}`}
            checked={current === opt.value}
            onChange={async () => {
              setCurrent(opt.value);
              setSaving(true);
              await updateStepCompletedBy(stepId, opt.value);
              setSaving(false);
            }}
            className="h-3.5 w-3.5"
          />
          {opt.label}
        </label>
      ))}
      {saving && <span className="text-xs text-ink-faint">Saving&hellip;</span>}
    </div>
  );
}
