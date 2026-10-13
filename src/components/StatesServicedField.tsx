"use client";

import { useState } from "react";

const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado",
  "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho",
  "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine",
  "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi",
  "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey",
  "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio",
  "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina",
  "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia",
  "Washington", "West Virginia", "Wisconsin", "Wyoming",
  "District of Columbia",
];

const ABBREVIATION_TO_FULL: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas",
  CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware",
  FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
  ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan",
  MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
  NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota",
  OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota",
  TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia",
  WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
  DC: "District of Columbia",
};

export function normalizeStateName(value: string): string {
  return ABBREVIATION_TO_FULL[value.toUpperCase()] ?? value;
}

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
        className="h-40 rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent"
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
