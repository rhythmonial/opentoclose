"use client";

import { useState, useTransition } from "react";
import { updateStepType } from "@/app/profile/setup-steps-actions";

// The type tag in a lesson's header, doubling as the picker: a lesson
// (video, resources & links) or a configurator (custom-built page). Saves
// as soon as it changes.
export function LessonTypeSelect({ stepId, value }: { stepId: string; value: string }) {
  const [type, setType] = useState(value === "configurator" ? "configurator" : "lesson");
  const [isPending, startTransition] = useTransition();

  return (
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
      className="ml-1 cursor-pointer appearance-none rounded-full bg-accent-soft py-0.5 pl-2 pr-5 align-middle font-caption text-[10px] font-bold uppercase tracking-wide text-accent outline-none disabled:opacity-60"
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 24 24' fill='none' stroke='%2300275e' stroke-width='3'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 6px center",
      }}
    >
      <option value="lesson">Lesson</option>
      <option value="configurator">Configurator</option>
    </select>
  );
}
