"use client";

import { useTransition } from "react";
import { moveStep } from "@/app/profile/setup-steps-actions";

export type SectionTarget = { phase: string; phaseLabel: string; section: string };

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
  const options = targets.filter(
    (t) => !(t.phase === currentPhase && t.section === currentSection),
  );
  const pillars = Array.from(new Set(options.map((t) => t.phase)));
  if (options.length === 0) return null;

  return (
    <select
      value=""
      disabled={isPending}
      aria-label={`Move ${stepTitle} to another section`}
      title="Move this lesson to another section"
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        const target = options[Number(e.target.value)];
        if (!target) return;
        if (
          !window.confirm(
            `Move "${stepTitle}" to ${target.phaseLabel} › ${target.section}?`,
          )
        ) {
          return;
        }
        const formData = new FormData();
        formData.set("step_id", stepId);
        formData.set("to_phase", target.phase);
        formData.set("to_section", target.section);
        startTransition(() => {
          moveStep(formData);
        });
      }}
      className="h-7 max-w-[150px] rounded-lg border border-border bg-surface px-2 text-xs font-medium text-ink-soft outline-none focus:border-accent disabled:opacity-50"
    >
      <option value="" disabled>
        {isPending ? "Moving…" : "Move to…"}
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
  );
}
