"use client";

import { useState } from "react";

// One of the application's multiple-choice questions, with the note for
// the answer picked (if it has one) below it.
export function ChoiceQuestion({
  name,
  label,
  options,
  notes = {},
  required,
}: {
  name: string;
  label: string;
  options: string[];
  notes?: Record<string, string>;
  required?: boolean;
}) {
  const [picked, setPicked] = useState("");
  const note = notes[picked];
  return (
    <fieldset className="flex flex-col gap-2 sm:col-span-2">
      <legend className="mb-1 text-sm font-medium text-ink">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label
            key={o}
            className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink has-[:checked]:border-accent has-[:checked]:bg-accent-soft"
          >
            <input
              type="radio"
              name={name}
              value={o}
              required={required}
              onChange={() => setPicked(o)}
              className="h-4 w-4"
            />
            {o}
          </label>
        ))}
      </div>
      {note && (
        <p role="status" className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-ink">
          {note}
        </p>
      )}
    </fieldset>
  );
}
