"use client";

import { useEffect, useRef, useState } from "react";
import { US_STATES } from "@/lib/usStates";

const controlClass =
  "rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent";

export function StatesServicedField({
  defaultStates = [],
  defaultPriorityState = "",
}: {
  defaultStates?: string[];
  defaultPriorityState?: string;
}) {
  const [selected, setSelected] = useState<string[]>(defaultStates);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function toggle(state: string) {
    setSelected((prev) =>
      prev.includes(state)
        ? prev.filter((s) => s !== state)
        : US_STATES.filter((s) => s === state || prev.includes(s)),
    );
  }

  const matches = US_STATES.filter((s) =>
    s.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const summary =
    selected.length === 0
      ? "Select state(s)"
      : selected.length <= 3
        ? selected.join(", ")
        : `${selected.slice(0, 3).join(", ")} +${selected.length - 3} more`;

  return (
    <>
      <div ref={wrapperRef} className="relative flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink">
          What state(s) do you service?
        </span>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className={`${controlClass} flex items-center justify-between gap-2 text-left ${
            selected.length === 0 ? "text-ink-faint" : ""
          }`}
        >
          <span className="truncate">{summary}</span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0 text-ink-soft"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        {/* Carries the value and blocks submit until a state is picked. */}
        <input
          tabIndex={-1}
          aria-hidden
          required
          name="states_serviced"
          value={selected.join(", ")}
          onChange={() => {}}
          className="pointer-events-none absolute bottom-0 left-4 h-px w-px opacity-0"
        />

        {open && (
          <div className="absolute top-full z-20 mt-1 w-full rounded-lg border border-border bg-surface p-2 shadow-lg">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search states"
              className="mb-2 w-full rounded-md border border-border bg-bg px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent"
            />
            <div className="max-h-56 overflow-y-auto">
              {matches.map((state) => (
                <label
                  key={state}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-ink hover:bg-bg"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(state)}
                    onChange={() => toggle(state)}
                    className="h-4 w-4"
                  />
                  {state}
                </label>
              ))}
              {matches.length === 0 && (
                <p className="px-2 py-1.5 text-sm text-ink-faint">
                  No matching states.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {selected.length > 1 ? (
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">
            Which state will you set up first?
          </span>
          <select
            name="priority_state"
            required
            defaultValue={
              selected.includes(defaultPriorityState) ? defaultPriorityState : ""
            }
            className={controlClass}
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
          <span className="text-xs text-ink-soft">
            We recommend your busiest state, then repeating the same steps
            for each additional state.
          </span>
        </label>
      ) : (
        <div className="hidden sm:block" />
      )}
    </>
  );
}
