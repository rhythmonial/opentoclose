"use client";

import { useState } from "react";
import {
  CONTACT_ROLES_SECTION,
  isSystemRequired,
  OTC_SECTIONS,
  requiredRank,
  sectionById,
  SYSTEM_REQUIRED_LABEL,
  type OtcField,
} from "@/lib/otcFields";

export const itemClass =
  "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-ink hover:bg-accent-soft/50 focus-visible:bg-accent-soft/50 focus:outline-none";

export function Check({ on }: { on: boolean }) {
  return (
    <span aria-hidden className="w-3.5 shrink-0 text-accent">
      {on ? "✓" : ""}
    </span>
  );
}

export const TYPE_NAMES: Record<string, string> = {
  contact: "contact",
  text: "text",
  text_area: "text area",
  currency: "dollar",
  percentage: "percentage",
  date: "date",
  number: "number",
  choice: "choice",
};

// Which Open to Close field a workflow field fills: the ones that match its
// type first, a search, and a way to add a new one.
export function OtcFieldList({
  title,
  backLabel,
  pool,
  suggested = [],
  suggestedLabel,
  recent = [],
  selectedId,
  searchPlaceholder,
  emptyText,
  addLabel,
  onPick,
  onAddNew,
  onBack,
}: {
  title: string;
  backLabel: string;
  // Everything that can be picked.
  pool: OtcField[];
  // Shown first, with a way to show the whole pool.
  suggested?: OtcField[];
  suggestedLabel?: string;
  // Used recently; listed at the top.
  recent?: OtcField[];
  selectedId?: string;
  searchPlaceholder: string;
  emptyText: string;
  addLabel: string;
  onPick: (field: OtcField) => void;
  // Gets what was typed in the search box, to name the new one.
  onAddNew: (query: string) => void;
  onBack: () => void;
}) {
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const q = query.trim().toLowerCase();
  const sectionName = (f: OtcField) =>
    sectionById(f.sectionId)?.name ?? "Your new fields";
  const list = q
    ? pool.filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          sectionName(f).toLowerCase().includes(q),
      )
    : showAll || suggested.length === 0
      ? pool
      : suggested;

  // System required fields lead, then recently used ones (when not
  // searching), then the rest grouped by section in the order OTC shows
  // them; new fields without a section come last.
  const order = new Map(OTC_SECTIONS.map((s, i) => [s.id, i] as const));
  const sections = new Map<string, OtcField[]>();
  const required = list
    .filter((f) => isSystemRequired(f.id))
    .sort((a, b) => requiredRank(a.id) - requiredRank(b.id));
  if (required.length > 0) sections.set(SYSTEM_REQUIRED_LABEL, required);
  const recentRest = recent.filter((f) => !isSystemRequired(f.id));
  if (!q && recentRest.length > 0) sections.set("Recently used", recentRest);
  for (const f of [...list].sort(
    (a, b) => (order.get(a.sectionId) ?? 999) - (order.get(b.sectionId) ?? 999),
  )) {
    if (isSystemRequired(f.id)) continue;
    const key = sectionName(f);
    sections.set(key, [...(sections.get(key) ?? []), f]);
  }

  return (
    <>
      <button
        type="button"
        role="menuitem"
        data-menu-item
        onClick={onBack}
        className={`${itemClass} text-xs font-semibold text-ink-soft`}
      >
        &lsaquo; {backLabel}
      </button>
      <p className="px-2.5 pb-1.5 pt-1 text-xs font-medium text-ink-soft">{title}</p>
      <div className="px-1.5 pb-1.5">
        <input
          data-autofocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="w-full rounded-md border border-border bg-bg px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent"
        />
      </div>
      {!q && suggested.length > 0 && (
        <p className="px-2.5 pb-1 text-[11px] text-ink-faint">
          {showAll ? "All OTC fields" : suggestedLabel}
        </p>
      )}
      <div className="max-h-60 overflow-y-auto">
        {[...sections].map(([section, items]) => (
          <div key={section} role="group" aria-label={section}>
            <p className="sticky top-0 bg-surface px-2.5 pb-0.5 pt-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-faint">
              {section}
            </p>
            {items.map((f) => {
              const on = selectedId === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={on}
                  data-menu-item
                  onClick={() => onPick(f)}
                  className={itemClass}
                >
                  <Check on={on} />
                  <span className="min-w-0 flex-1">{f.name}</span>
                </button>
              );
            })}
          </div>
        ))}
        {list.length === 0 && (
          <p className="px-2.5 py-1.5 text-xs text-ink-faint">{emptyText}</p>
        )}
      </div>
      {!q && suggested.length > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          className="px-2.5 py-1.5 text-left text-xs font-semibold text-accent"
        >
          {showAll ? "Show suggested fields only" : "Show all OTC fields"}
        </button>
      )}
      <div className="my-1 border-t border-border" />
      <button
        type="button"
        role="menuitem"
        data-menu-item
        onClick={() => onAddNew(query.trim())}
        className={`${itemClass} font-semibold text-accent`}
      >
        <span aria-hidden className="w-3.5 shrink-0">
          +
        </span>
        {query.trim() ? `${addLabel}: “${query.trim()}”` : addLabel}
      </button>
    </>
  );
}

// Adds a field the client wants in Open to Close that isn't one of the
// built-in ones.
export function NewOtcFieldForm({
  defaultName,
  kind,
  onAdd,
  onBack,
}: {
  defaultName: string;
  // A contact role (which has no section to choose), a choice field, or
  // any other field.
  kind: "contact" | "choice" | "field";
  onAdd: (name: string, sectionId: string) => void;
  onBack: () => void;
}) {
  const [name, setName] = useState(defaultName);
  const [sectionId, setSectionId] = useState(
    kind === "contact" ? CONTACT_ROLES_SECTION : "",
  );
  const sections = OTC_SECTIONS.filter((s) => s.id !== CONTACT_ROLES_SECTION);
  const groups = [...new Set(sections.map((s) => s.group))];
  const ready = name.trim() && sectionId;

  return (
    <form
      className="flex flex-col gap-2.5 p-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) onAdd(name.trim(), sectionId);
      }}
    >
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-ink-soft">
          {kind === "contact"
            ? "New contact role"
            : kind === "choice"
              ? "New choice field name"
              : "New OTC field name"}
        </span>
        <input
          data-autofocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          placeholder={
            kind === "contact"
              ? "e.g. Surveyor"
              : kind === "choice"
                ? "e.g. Survey Required"
                : "e.g. Home Warranty Company"
          }
          className="rounded-md border border-border bg-bg px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent"
        />
      </label>
      {kind !== "contact" && (
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-ink-soft">
            Section it goes in
          </span>
          <select
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
            className="rounded-md border border-border bg-bg px-2 py-1.5 text-sm text-ink outline-none focus:border-accent"
          >
            <option value="">Choose a section&hellip;</option>
            {groups.map((g) => (
              <optgroup key={g} label={g}>
                {sections
                  .filter((s) => s.group === g)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>
      )}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="text-xs font-semibold text-ink-soft"
        >
          &lsaquo; Back
        </button>
        <button
          type="submit"
          disabled={!ready}
          className="rounded-md bg-accent px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
        >
          {kind === "contact" ? "Add role" : "Add field"}
        </button>
      </div>
    </form>
  );
}
