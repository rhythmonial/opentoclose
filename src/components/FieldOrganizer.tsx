"use client";

import { useEffect, useRef, useState } from "react";
import { setUrlParam } from "@/lib/urlState";
import { SortableGroup } from "@/components/dnd/SortableGroup";
import {
  ORG_GROUPS,
  ORG_SECTIONS,
  type Layout,
  type Move,
  type OrgField,
  type OrgSection,
} from "@/lib/fieldOrganization";
import { saveFieldOrganization } from "@/app/configurator/organize_your_fields/actions";

const KIND_LABELS: Record<string, string> = {
  text: "Text",
  text_area: "Text Area",
  currency: "Dollar",
  percentage: "Percentage",
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
  spots = {},
  sections = ORG_SECTIONS,
  initialGroup,
}: {
  // The client account (staff only; clients use their own).
  accountId: string | null;
  // Off in test mode.
  canSave: boolean;
  fields: OrgField[];
  names: Record<string, string>;
  initialLayout: Layout;
  // Where each field first is on the contracts ("Purchase Agreement #134").
  spots?: Record<string, string>;
  // OTC's sections with the ones the client added.
  sections?: OrgSection[];
  // The group to open on (kept in the address so a reload comes back).
  initialGroup?: string;
}) {
  const [layout, setLayout] = useState(initialLayout);
  const [group, setGroupState] = useState(
    initialGroup && ORG_GROUPS.includes(initialGroup) ? initialGroup : ORG_GROUPS[0],
  );
  const setGroup = (g: string) => {
    setGroupState(g);
    setUrlParam("group", g);
  };
  const [status, setStatus] = useState<"saving" | "saved" | "error" | null>(null);
  const pending = useRef<Move[]>([]);
  const timer = useRef<number | null>(null);
  const latest = useRef(layout);

  const fieldById = new Map(fields.map((f) => [f.id, f] as const));
  const sectionName = (id: string) => sections.find((s) => s.id === id)?.name ?? id;

  function change(next: Layout, move: Omit<Move, "at">) {
    setLayout(next);
    latest.current = next;
    pending.current.push({ ...move, at: new Date().toISOString() });
    scheduleSave();
  }

  function scheduleSave() {
    if (!canSave) return;
    setStatus("saving");
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      const moves = pending.current;
      pending.current = [];
      const result = await saveFieldOrganization(
        accountId,
        latest.current,
        moves,
      );
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

  // Moves a field to the end of another section (in any group).
  function moveField(fieldId: string, fromSection: string, toSection: string) {
    const fromGroup = layout.find((g) => g.sections.some((s) => s.id === fromSection))!.group;
    const toGroup = layout.find((g) => g.sections.some((s) => s.id === toSection))!.group;
    const fromIndex = layout
      .flatMap((g) => g.sections)
      .find((s) => s.id === fromSection)!
      .fields.indexOf(fieldId);
    const target = layout.flatMap((g) => g.sections).find((s) => s.id === toSection)!;
    change(
      layout.map((g) => ({
        ...g,
        sections: g.sections.map((s) =>
          s.id === fromSection
            ? { ...s, fields: s.fields.filter((f) => f !== fieldId) }
            : s.id === toSection
              ? { ...s, fields: [...s.fields, fieldId] }
              : s,
        ),
      })),
      {
        kind: "field",
        id: fieldId,
        from: { group: fromGroup, section: fromSection, index: fromIndex },
        to: { group: toGroup, section: toSection, index: target.fields.length },
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

      {/* Field group tabs, like Customize Your Fields'. */}
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
              className={`flex min-w-0 flex-1 items-center justify-center rounded-md border px-1 py-2 text-center text-[11px] font-semibold leading-tight sm:px-3 sm:text-sm ${
                active ? "border-accent bg-accent text-white" : "border-border bg-surface text-ink-soft"
              }`}
            >
              <span className="min-w-0 break-words sm:truncate">
                {g.group}
                <span className={active ? "text-white/80" : "text-ink-faint"}> &middot; {countIn(g)}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-faint">
        <span>
          Drag the handle beside a section or a field to move it. Use &ldquo;Move to&rdquo; to put
          a section in another field group or a field in another section. On choice fields, click
          an option to delete it (red) and type in any you&rsquo;d like to add.
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
                  <MoveMenu
                    label={`Move ${sectionName(s.id)} to another field group`}
                    heading="Move this section to"
                    groups={[
                      {
                        group: "",
                        items: ORG_GROUPS.filter((g) => g !== group).map((g) => ({ value: g, label: g })),
                      },
                    ]}
                    onMove={(to) => moveSection(s.id, to)}
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
                          <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-bg px-3 py-1.5 text-sm">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="flex min-w-0 flex-1 items-center gap-2">
                                <span className="min-w-0 truncate">
                                  <span className="font-medium text-accent">{f?.name ?? id}</span>
                                  {f?.kind && (
                                    <span className="text-ink-soft"> ({KIND_LABELS[f.kind] ?? f.kind})</span>
                                  )}
                                </span>
                                {spots[id] && (
                                  <span className="max-w-[14rem] shrink-0 truncate rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent">
                                    {spots[id]}
                                  </span>
                                )}
                                {names[id] && (
                                  <span className="min-w-0 truncate text-ink-soft">
                                    shown as &ldquo;{names[id]}&rdquo;
                                  </span>
                                )}
                              </span>
                              <MoveMenu
                                label={`Move ${f?.name ?? "this field"} to another section`}
                                heading="Move this field to"
                                groups={layout.map((g) => ({
                                  group: g.group,
                                  items: g.sections
                                    .filter((x) => x.id !== s.id)
                                    .map((x) => ({ value: x.id, label: sectionName(x.id) })),
                                }))}
                                onMove={(to) => moveField(id, s.id, to)}
                              />
                            </div>
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

// "Move to": a menu of places (grouped under headings when given).
function MoveMenu({
  label,
  heading,
  groups,
  onMove,
}: {
  label: string;
  heading: string;
  groups: { group: string; items: { value: string; label: string }[] }[];
  onMove: (value: string) => void;
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
        aria-label={label}
        title={label}
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
          className="absolute right-0 top-full z-30 mt-1 flex max-h-72 w-60 flex-col overflow-y-auto rounded-lg border border-border bg-surface p-1 shadow-lg"
        >
          <span className="px-2.5 py-1 text-[11px] font-semibold text-ink-faint">{heading}</span>
          {groups
            .filter((g) => g.items.length > 0)
            .map((g) => (
              <span key={g.group || "items"} className="flex flex-col">
                {g.group && (
                  <span className="px-2.5 pb-0.5 pt-1.5 text-xs font-bold text-ink">{g.group}</span>
                )}
                {g.items.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setOpen(false);
                      onMove(item.value);
                    }}
                    className={`rounded-md px-2.5 py-1.5 text-left text-sm text-ink hover:bg-accent-soft/50 ${g.group ? "pl-4" : ""}`}
                  >
                    {item.label}
                  </button>
                ))}
              </span>
            ))}
        </span>
      )}
    </span>
  );
}

