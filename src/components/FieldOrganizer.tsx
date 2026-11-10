"use client";

import { useEffect, useRef, useState } from "react";
import { SortableGroup } from "@/components/dnd/SortableGroup";
import {
  ORG_GROUPS,
  ORG_SECTIONS,
  type Layout,
  type Move,
  type OrgField,
} from "@/lib/fieldOrganization";
import { saveFieldOrganization } from "@/app/configurator/organize_your_fields/actions";

const KIND_LABELS: Record<string, string> = {
  text: "Text",
  text_area: "Text Area",
  currency: "Decimal: Dollar",
  percentage: "Decimal: Percentage",
  date: "Date",
  number: "Number",
  choice: "Choice",
};

// Organize Your Fields: the client's field groups as tabs (like Finalize
// Your Fields), each with its sections and the fields they use. Sections
// drag within their group (or move to another group with the button on
// their heading) and fields drag within their section. Every move is
// recorded and saved as it happens.
export function FieldOrganizer({
  accountId,
  canSave,
  fields,
  names,
  initialLayout,
}: {
  // The client account (staff only; clients use their own).
  accountId: string | null;
  // Off in test mode.
  canSave: boolean;
  fields: OrgField[];
  names: Record<string, string>;
  initialLayout: Layout;
}) {
  const [layout, setLayout] = useState(initialLayout);
  const [group, setGroup] = useState(ORG_GROUPS[0]);
  const [status, setStatus] = useState<"saving" | "saved" | "error" | null>(null);
  const pending = useRef<Move[]>([]);
  const timer = useRef<number | null>(null);
  const latest = useRef(layout);

  const fieldById = new Map(fields.map((f) => [f.id, f] as const));
  const sectionName = (id: string) => ORG_SECTIONS.find((s) => s.id === id)?.name ?? id;

  function change(next: Layout, move: Omit<Move, "at">) {
    setLayout(next);
    latest.current = next;
    pending.current.push({ ...move, at: new Date().toISOString() });
    if (!canSave) return;
    setStatus("saving");
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      const moves = pending.current;
      pending.current = [];
      const result = await saveFieldOrganization(accountId, latest.current, moves);
      if (!result.ok) pending.current = [...moves, ...pending.current];
      setStatus(result.ok ? "saved" : "error");
    }, 600);
  }

  const current = layout.find((g) => g.group === group)!;

  function reorderSections(ids: string[], moved: { id: string; from: number; to: number }) {
    const byId = new Map(current.sections.map((s) => [s.id, s] as const));
    change(
      layout.map((g) => (g.group === group ? { ...g, sections: ids.map((id) => byId.get(id)!) } : g)),
      { kind: "section", id: moved.id, from: { group, index: moved.from }, to: { group, index: moved.to } },
    );
  }

  function reorderFields(sectionId: string, ids: string[], moved: { id: string; from: number; to: number }) {
    change(
      layout.map((g) =>
        g.group === group
          ? { ...g, sections: g.sections.map((s) => (s.id === sectionId ? { ...s, fields: ids } : s)) }
          : g,
      ),
      {
        kind: "field",
        id: moved.id,
        from: { group, section: sectionId, index: moved.from },
        to: { group, section: sectionId, index: moved.to },
      },
    );
  }

  function moveSection(sectionId: string, to: string) {
    const from = current.sections.findIndex((s) => s.id === sectionId);
    const section = current.sections[from];
    const target = layout.find((g) => g.group === to)!;
    change(
      layout.map((g) =>
        g.group === group
          ? { ...g, sections: g.sections.filter((s) => s.id !== sectionId) }
          : g.group === to
            ? { ...g, sections: [...g.sections, section] }
            : g,
      ),
      {
        kind: "section",
        id: sectionId,
        from: { group, index: from },
        to: { group: to, index: target.sections.length },
      },
    );
  }

  const countIn = (g: Layout[number]) => g.sections.reduce((n, s) => n + s.fields.length, 0);

  // Fields they added without a section, until they pick one.
  const placed = new Set(layout.flatMap((g) => g.sections.flatMap((s) => s.fields)));
  const unplaced = fields.filter((f) => !f.sectionId && !placed.has(f.id));

  function place(fieldId: string, sectionId: string) {
    const g = layout.find((x) => x.sections.some((s) => s.id === sectionId))!;
    const section = g.sections.find((s) => s.id === sectionId)!;
    change(
      layout.map((x) =>
        x.group === g.group
          ? {
              ...x,
              sections: x.sections.map((s) =>
                s.id === sectionId ? { ...s, fields: [...s.fields, fieldId] } : s,
              ),
            }
          : x,
      ),
      {
        kind: "field",
        id: fieldId,
        from: { group: "", section: "", index: 0 },
        to: { group: g.group, section: sectionId, index: section.fields.length },
      },
    );
    setGroup(g.group);
  }

  return (
    <div className="flex flex-col gap-4">
      {unplaced.length > 0 && (
        <div className="rounded-xl border border-gold/50 bg-gold/10 p-4 text-sm">
          <p className="font-semibold text-ink">Choose a section for your new fields</p>
          <p className="mt-0.5 text-xs text-ink-soft">
            You added these without a section. Pick where each one goes; you can then drag it into
            place.
          </p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {unplaced.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0">
                  <span className="font-medium text-accent">{f.name}</span>
                  {f.kind && <span className="text-ink-soft"> ({KIND_LABELS[f.kind] ?? f.kind})</span>}
                </span>
                <select
                  value=""
                  onChange={(e) => e.target.value && place(f.id, e.target.value)}
                  aria-label={`Section for ${f.name}`}
                  className="w-64 max-w-full rounded-md border border-border bg-surface px-2 py-1 text-sm text-ink"
                >
                  <option value="">Choose a section&hellip;</option>
                  {layout.map((g) => (
                    <optgroup key={g.group} label={g.group}>
                      {g.sections.map((s) => (
                        <option key={s.id} value={s.id}>
                          {sectionName(s.id)}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Field group tabs, on one row at any width. */}
      <div className="flex gap-1 sm:gap-2" role="tablist" aria-label="Field groups">
        {layout.map((g) => {
          const active = g.group === group;
          return (
            <button
              key={g.group}
              type="button"
              role="tab"
              aria-selected={active}
              title={`${g.group}: ${g.sections.length} sections, ${countIn(g)} fields`}
              onClick={() => setGroup(g.group)}
              className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-x-1 rounded-lg border px-0.5 py-1.5 text-[9px] font-semibold leading-tight transition-colors min-[360px]:text-[10px] sm:flex-row sm:px-3 sm:py-2 sm:text-sm ${
                active
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : "border-border bg-surface text-ink-soft hover:border-emerald-500"
              }`}
            >
              <span className="min-w-0 max-w-full break-words text-center sm:truncate">{g.group}</span>
              <span
                className={`shrink-0 text-[10px] font-normal sm:text-xs ${active ? "text-white/80" : "text-ink-faint"}`}
              >
                {countIn(g)}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-faint">
        <span>
          Drag the handle beside a section or a field to move it. Use &ldquo;Move to&rdquo; on a
          section to put it in another field group.
        </span>
        <span>
          {!canSave && "Test mode: nothing is saved"}
          {status === "saving" && "Saving…"}
          {status === "saved" && "Saved"}
          {status === "error" && <span className="text-danger">Couldn&rsquo;t save. Try again.</span>}
        </span>
      </div>

      <div className="flex items-center gap-2 rounded-lg bg-border/60 px-4 py-2.5">
        <h2 className="text-sm font-bold text-ink">{group}</h2>
      </div>

      {current.sections.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface p-5 text-sm text-ink-soft">
          No sections in this group. Move one here with &ldquo;Move to&rdquo; on its heading.
        </p>
      ) : (
        <SortableGroup
          gapClass="gap-3"
          handleClass="mt-3"
          onReorder={reorderSections}
          items={current.sections.map((s) => ({
            id: s.id,
            node: (
              <section className="flex flex-col gap-1.5 rounded-xl border border-border bg-surface p-2.5">
                <div className="flex items-center justify-between gap-2 rounded-lg bg-border/30 px-3 py-1.5">
                  <h3 className="min-w-0 truncate text-sm font-semibold text-ink">
                    {sectionName(s.id)}
                    <span className="ml-2 text-xs font-normal text-ink-faint">
                      {s.fields.length} field{s.fields.length === 1 ? "" : "s"}
                    </span>
                  </h3>
                  <MoveToGroup
                    current={group}
                    onMove={(to) => moveSection(s.id, to)}
                    label={sectionName(s.id)}
                  />
                </div>
                {s.fields.length === 0 ? (
                  <p className="px-3 py-1 text-xs text-ink-faint">No fields you use in this section.</p>
                ) : (
                  <SortableGroup
                    gapClass="gap-1"
                    handleClass="mt-2"
                    onReorder={(ids, moved) => reorderFields(s.id, ids, moved)}
                    items={s.fields.map((id) => {
                      const f = fieldById.get(id);
                      return {
                        id,
                        node: (
                          <div className="flex min-w-0 items-center gap-2 rounded-lg border border-border bg-bg px-3 py-1.5 text-sm">
                            <span className="min-w-0 truncate">
                              <span className="font-medium text-accent">{f?.name ?? id}</span>
                              {f?.kind && (
                                <span className="text-ink-soft"> ({KIND_LABELS[f.kind] ?? f.kind})</span>
                              )}
                              {names[id] && (
                                <span className="text-ink-soft"> &middot; shown as &ldquo;{names[id]}&rdquo;</span>
                              )}
                            </span>
                            {f?.isNew && (
                              <span className="shrink-0 rounded bg-gold/20 px-1 py-px text-[10px] font-bold uppercase text-ink">
                                New
                              </span>
                            )}
                          </div>
                        ),
                      };
                    })}
                  />
                )}
              </section>
            ),
          }))}
        />
      )}
    </div>
  );
}

// "Move to" on a section's heading: the other field groups.
function MoveToGroup({
  current,
  label,
  onMove,
}: {
  current: string;
  label: string;
  onMove: (group: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <span ref={box} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Move ${label} to another field group`}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-0.5 text-xs font-semibold text-accent hover:border-accent"
      >
        Move to
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <span
          role="menu"
          className="absolute right-0 top-full z-30 mt-1 flex w-52 flex-col rounded-lg border border-border bg-surface p-1 shadow-lg"
        >
          <span className="px-2.5 py-1 text-[11px] font-semibold text-ink-faint">Move this section to</span>
          {ORG_GROUPS.filter((g) => g !== current).map((g) => (
            <button
              key={g}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onMove(g);
              }}
              className="rounded-md px-2.5 py-1.5 text-left text-sm text-ink hover:bg-accent-soft/50"
            >
              {g}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}
