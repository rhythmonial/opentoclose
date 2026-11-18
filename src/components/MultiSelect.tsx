"use client";

import { useEffect, useRef, useState } from "react";

// Chips for what's chosen, and a searchable checklist to choose more.
export function MultiSelect({
  label,
  options,
  value,
  onChange,
  emptyText = "Nothing to choose from yet.",
  compact = false,
  invalid = false,
  addLabel = "+ Add",
  defaultOpen = false,
}: {
  label: string;
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
  emptyText?: string;
  // In a table cell: no label above (it's the column's), tighter box.
  compact?: boolean;
  // Red until something's chosen.
  invalid?: boolean;
  addLabel?: string;
  // Opens its checklist as soon as it shows.
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const q = query.trim().toLowerCase();
  // Choices saved earlier that aren't options any more still show, so they
  // can be taken off.
  const all = [...new Set([...options, ...value])];
  const shown = all.filter((o) => !q || o.toLowerCase().includes(q));
  const toggle = (o: string) =>
    onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o]);

  return (
    <div ref={ref} className="relative flex flex-col gap-1">
      {!compact && <span className="text-xs font-semibold text-ink-soft">{label}</span>}
      <div
        className={`flex flex-wrap items-center gap-1 rounded-lg border px-2 ${
          compact ? "min-h-[2rem] py-1" : "min-h-[2.4rem] py-1.5"
        } ${invalid ? "border-danger/40 bg-danger/5" : "border-border bg-bg"}`}
      >
        {value.map((v) => (
          <span
            key={v}
            className="flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-px text-xs text-ink"
          >
            {v}
            <button type="button" aria-label={`Remove ${v}`} onClick={() => toggle(v)} className="text-ink-faint hover:text-ink">
              &times;
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label={`${addLabel} ${label}`}
          className={`text-xs font-semibold ${invalid ? "text-danger" : "text-accent"}`}
        >
          {addLabel}
        </button>
      </div>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 flex w-full min-w-60 flex-col gap-1 rounded-lg border border-border bg-surface p-2 shadow-lg">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            aria-label={`Search ${label}`}
            className="rounded-md border border-border bg-bg px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent"
          />
          <div className="max-h-56 overflow-y-auto">
            {shown.map((o) => (
              <label
                key={o}
                className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm text-ink hover:bg-accent-soft/40"
              >
                <input type="checkbox" checked={value.includes(o)} onChange={() => toggle(o)} />
                {o}
              </label>
            ))}
            {all.length === 0 ? (
              <p className="px-1.5 py-1 text-xs text-ink-faint">{emptyText}</p>
            ) : (
              shown.length === 0 && <p className="px-1.5 py-1 text-xs text-ink-faint">No matches.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
