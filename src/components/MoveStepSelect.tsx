"use client";

import { useState, useTransition } from "react";
import { moveStep } from "@/app/profile/setup-steps-actions";
import { MoveConfirm } from "@/components/MoveConfirm";

export type SectionTarget = {
  phase: string;
  phaseLabel: string;
  section: string;
};

export function MoveStepSelect({
  stepId,
  stepTitle,
  currentPhase,
  currentSection,
  targets,
}: {
  stepId: string;
  stepTitle: string;
  currentPhase: string;
  currentSection: string;
  targets: SectionTarget[];
}) {
  const [isPending, startTransition] = useTransition();
  // Index into options of the section picked, waiting for the Move button.
  const [choice, setChoice] = useState("");
  const options = targets.filter(
    (t) => !(t.phase === currentPhase && t.section === currentSection),
  );
  const pillars = Array.from(new Set(options.map((t) => t.phase)));
  if (options.length === 0) return null;

  function move() {
    const target = options[Number(choice)];
    if (!target) return;
    const formData = new FormData();
    formData.set("step_id", stepId);
    formData.set("to_phase", target.phase);
    formData.set("to_section", target.section);
    startTransition(async () => {
      await moveStep(formData);
      setChoice("");
    });
  }

  return (
    <>
      <select
        value={choice}
        disabled={isPending}
        aria-label={`Move ${stepTitle} to another section`}
        title="Move this lesson to another section"
        onClick={(e) => e.stopPropagation()}
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
        {pillars.map((pillar) => (
          <optgroup
            key={pillar}
            label={options.find((t) => t.phase === pillar)!.phaseLabel}
          >
            {options.map((t, index) =>
              t.phase === pillar ? (
                <option key={`${t.phase}/${t.section}`} value={index}>
                  {t.section}
                </option>
              ) : null,
            )}
          </optgroup>
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
