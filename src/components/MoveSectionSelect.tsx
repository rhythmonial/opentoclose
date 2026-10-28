"use client";

import { useState, useTransition } from "react";
import { moveSection } from "@/app/profile/setup-steps-actions";
import { MoveConfirm } from "@/components/MoveConfirm";

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
  // The pillar picked in the dropdown, waiting for the Move button.
  const [choice, setChoice] = useState("");
  const targets = phases.filter((p) => p.value !== fromPhase);
  if (targets.length === 0) return null;

  function move() {
    const formData = new FormData();
    formData.set("path", path);
    formData.set("from_phase", fromPhase);
    formData.set("to_phase", choice);
    formData.set("section", section);
    startTransition(async () => {
      await moveSection(formData);
      setChoice("");
    });
  }

  return (
    <>
      <select
        value={choice}
        disabled={isPending}
        aria-label={`Move ${section} to another pillar`}
        title="Move this section to another pillar"
        onChange={(e) => setChoice(e.target.value)}
        className={`h-7 shrink-0 cursor-pointer appearance-none truncate rounded-lg border bg-surface px-1.5 text-center text-xs font-medium outline-none hover:text-ink focus:border-accent disabled:opacity-50 ${
          choice
            ? "max-w-40 border-accent text-ink"
            : "w-[3.75rem] border-border text-ink-soft"
        }`}
      >
        <option value="" disabled>
          Move ▾
        </option>
        {targets.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
      {choice && (
        <MoveConfirm
          pending={isPending}
          onMove={move}
          onCancel={() => setChoice("")}
        />
      )}
    </>
  );
}
