"use client";

import { useState } from "react";
import { updateStepIsFutureBuild } from "@/app/profile/setup-steps-actions";

export function FutureBuildToggle({
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
      className="flex items-center gap-1.5 text-xs font-medium text-ink-soft"
      onClick={(e) => e.stopPropagation()}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={async (e) => {
          const next = e.target.checked;
          setChecked(next);
          setSaving(true);
          await updateStepIsFutureBuild(stepId, next);
          setSaving(false);
        }}
        className="h-3.5 w-3.5"
      />
      Future Build
      {saving && <span className="text-ink-faint">&hellip;</span>}
    </label>
  );
}
