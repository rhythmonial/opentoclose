"use client";

import { useState } from "react";

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
  "DC",
];

export function StatesServicedField({
  defaultStates = [],
  defaultPriorityState = "",
}: {
  defaultStates?: string[];
  defaultPriorityState?: string;
}) {
  const [selected, setSelected] = useState<string[]>(defaultStates);

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-ink">
        What state(s) do you service?
      </span>
      <select
        multiple
        required
        value={selected}
        onChange={(e) =>
          setSelected(Array.from(e.target.selectedOptions, (o) => o.value))
        }
        className="h-32 rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent"
      >
        {US_STATES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <span className="text-xs text-ink-faint">
        Hold Cmd (Mac) or Ctrl (Windows) to select more than one.
      </span>
      <input type="hidden" name="states_serviced" value={selected.join(", ")} />

      {selected.length > 1 && (
        <div className="mt-2 flex flex-col gap-1.5 rounded-lg border border-accent-soft bg-accent-soft/40 p-3.5">
          <span className="text-sm font-medium text-ink">
            Which state will you set up first?
          </span>
          <select
            name="priority_state"
            required
            defaultValue={
              selected.includes(defaultPriorityState) ? defaultPriorityState : ""
            }
            className="rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent"
          >
            <option value="" disabled>
              Select one
            </option>
            {selected.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <p className="text-xs text-ink-soft">
            We recommend starting with your busiest state &mdash; the one
            where you close the most transactions &mdash; then following the
            same steps for each additional state.
          </p>
        </div>
      )}
    </div>
  );
}
