"use client";

import { useTransition } from "react";
import { moveSection } from "@/app/profile/setup-steps-actions";

export function MoveSectionSelect({
  path,
  fromPhase,
  section,
  phases,
}: {
  path: string;
  fromPhase: string;
  section: string;
  phases: { value: string; label: string }[];
}) {
  const [isPending, startTransition] = useTransition();
  const targets = phases.filter((p) => p.value !== fromPhase);
  if (targets.length === 0) return null;

  return (
    <select
      value=""
      disabled={isPending}
      aria-label={`Move ${section} to another pillar`}
      title="Move this section to another pillar"
      onChange={(e) => {
        const target = targets.find((p) => p.value === e.target.value);
        if (!target) return;
        if (
          !window.confirm(
            `Move the "${section}" section to the ${target.label} pillar?`,
          )
        ) {
          return;
        }
        const formData = new FormData();
        formData.set("path", path);
        formData.set("from_phase", fromPhase);
        formData.set("to_phase", target.value);
        formData.set("section", section);
        startTransition(() => {
          moveSection(formData);
        });
      }}
      className="h-7 max-w-[160px] rounded-lg border border-border bg-surface px-2 text-xs font-medium text-ink-soft outline-none focus:border-accent disabled:opacity-50"
    >
      <option value="" disabled>
        {isPending ? "Moving…" : "Move to…"}
      </option>
      {targets.map((p) => (
        <option key={p.value} value={p.value}>
          {p.label}
        </option>
      ))}
    </select>
  );
}
