"use client";

import { useState } from "react";

export function PhaseSectionPicker({
  phases,
  sectionsByPhase,
  defaultPhase = "",
  defaultSection = "",
}: {
  phases: string[];
  sectionsByPhase: Record<string, string[]>;
  defaultPhase?: string;
  defaultSection?: string;
}) {
  const [phase, setPhase] = useState(defaultPhase);
  const [isNewPhase, setIsNewPhase] = useState(
    defaultPhase !== "" && !phases.includes(defaultPhase),
  );
  const [section, setSection] = useState(defaultSection);
  const [isNewSection, setIsNewSection] = useState(
    defaultSection !== "" &&
      !(sectionsByPhase[defaultPhase] ?? []).includes(defaultSection),
  );

  const sectionOptions = sectionsByPhase[phase] ?? [];

  return (
    <>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-ink-soft">Phase</span>
        {isNewPhase ? (
          <input
            name="phase"
            defaultValue={defaultPhase}
            onChange={(e) => setPhase(e.target.value)}
            placeholder="New phase name"
            className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          />
        ) : (
          <select
            name="phase"
            value={phase}
            onChange={(e) => {
              if (e.target.value === "__new__") {
                setIsNewPhase(true);
                setPhase("");
              } else {
                setPhase(e.target.value);
                setSection("");
                setIsNewSection(false);
              }
            }}
            className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          >
            <option value="" disabled>
              Select a phase
            </option>
            {phases.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
            <option value="__new__">+ Add new phase</option>
          </select>
        )}
        {isNewPhase && (
          <button
            type="button"
            onClick={() => {
              setIsNewPhase(false);
              setPhase("");
            }}
            className="self-start text-xs font-medium text-accent"
          >
            Choose existing instead
          </button>
        )}
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-ink-soft">Section</span>
        {isNewSection ? (
          <input
            name="section"
            defaultValue={defaultSection}
            onChange={(e) => setSection(e.target.value)}
            placeholder="New section name"
            className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          />
        ) : (
          <select
            name="section"
            value={section}
            onChange={(e) => {
              if (e.target.value === "__new__") {
                setIsNewSection(true);
                setSection("");
              } else {
                setSection(e.target.value);
              }
            }}
            className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          >
            <option value="" disabled>
              Select a section
            </option>
            {sectionOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
            <option value="__new__">+ Add new section</option>
          </select>
        )}
        {isNewSection && (
          <button
            type="button"
            onClick={() => {
              setIsNewSection(false);
              setSection("");
            }}
            className="self-start text-xs font-medium text-accent"
          >
            Choose existing instead
          </button>
        )}
      </label>
    </>
  );
}
