"use client";

import { useState } from "react";
import { updateStepIsPublished } from "@/app/profile/setup-steps-actions";

export function PublishToggle({
  stepId,
  value,
}: {
  stepId: string;
  value: boolean;
}) {
  const [on, setOn] = useState(value);
  const [saving, setSaving] = useState(false);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={saving}
      title={on ? "Visible to clients. Click to hide." : "Hidden from clients. Click to show."}
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const next = !on;
        setOn(next);
        setSaving(true);
        await updateStepIsPublished(stepId, next);
        setSaving(false);
      }}
      className={`h-7 w-[2.75rem] shrink-0 rounded-lg border font-caption text-[11px] font-bold uppercase tracking-wide disabled:opacity-60 ${
        on
          ? "border-success/50 bg-success-soft text-success"
          : "border-border bg-bg text-ink-faint"
      }`}
    >
      {on ? "On" : "Off"}
    </button>
  );
}
