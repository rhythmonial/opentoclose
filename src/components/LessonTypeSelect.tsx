"use client";

import { useState, useTransition } from "react";
import { updateStepType } from "@/app/profile/setup-steps-actions";

// The type tag in a lesson's header, doubling as the picker: a lesson
// (video, resources & links) or a configurator (custom-built page). Saves
// as soon as it changes.
export function LessonTypeSelect({ stepId, value }: { stepId: string; value: string }) {
  const [type, setType] = useState(value === "configurator" ? "configurator" : "lesson");
  const [isPending, startTransition] = useTransition();

  // A plain select is as wide as its longest option, so the pill shows the
  // current type and an invisible select laid over it does the picking.
  return (
    <span
      className={`relative ml-1 inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 align-middle font-caption text-[10px] font-bold uppercase tracking-wide text-accent focus-within:ring-2 focus-within:ring-accent/40 ${
        isPending ? "opacity-60" : ""
      }`}
    >
      {type === "configurator" ? "Configurator" : "Lesson"}
      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
        <path d="m6 9 6 6 6-6" />
      </svg>
      <select
        value={type}
        disabled={isPending}
        aria-label="Lesson type"
        title="Lesson type"
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          const next = e.target.value;
          setType(next);
          startTransition(() => updateStepType(stepId, next));
        }}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        <option value="lesson">Lesson</option>
        <option value="configurator">Configurator</option>
      </select>
    </span>
  );
}
