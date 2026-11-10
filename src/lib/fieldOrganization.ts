import {
  CONTACT_ROLES_SECTION,
  OTC_CHOICE_OPTIONS,
  OTC_FIELDS,
  OTC_SECTIONS,
  sectionsWith,
  type CustomField,
  type CustomSection,
  type Kind,
  type OtcField,
} from "@/lib/otcFields";

// Organize Your Fields: the client arranges the fields they use the way
// they'd like them in Open to Close: sections within a field group (or
// moved to another group) and fields within a section (or moved to another
// section), and says which choice options to keep, delete or add.

export type OrgField = {
  id: string;
  name: string;
  // "" for a field the client added without a section (they pick one here).
  sectionId: string;
  kind?: Kind;
  // Added by the client (to be created in OTC).
  isNew?: boolean;
  // A choice field's options Open to Close already has (its own fields).
  defaults?: string[];
  // Options the client wants that it doesn't have yet: ones on their
  // contracts, or that they typed for a field they added.
  options?: string[];
};

// Per choice field, options the client wants deleted (shown red) and ones
// they typed in to add.
export type ChoiceEdits = Record<string, { removed: string[]; added: string[] }>;

export type OrgSection = { id: string; name: string; group: string };

// Field groups in order, each with its sections in order, each with the ids
// of its fields in order.
export type Layout = { group: string; sections: { id: string; fields: string[] }[] }[];

export type Move = {
  at: string;
  kind: "field" | "section";
  id: string;
  // The group (and for a field, its section) and position it moved from and
  // to (0-based).
  from: { group: string; section?: string; index: number };
  to: { group: string; section?: string; index: number };
};

// OTC's field sections (not contact roles), empty ones too, in order.
export const ORG_SECTIONS: OrgSection[] = OTC_SECTIONS.filter(
  (s) => s.id !== CONTACT_ROLES_SECTION,
).map((s) => ({ id: s.id, name: s.name, group: s.group }));

export const ORG_GROUPS = [...new Set(ORG_SECTIONS.map((s) => s.group))];

// OTC's sections with the ones the client added (each at the end of its
// field group, where OTC puts a new section).
export const orgSectionsWith = (custom: CustomSection[]): OrgSection[] =>
  sectionsWith(custom)
    .filter((s) => s.id !== CONTACT_ROLES_SECTION)
    .map((s) => ({ id: s.id, name: s.name, group: s.group }));

const sameText = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const without = (list: string[], drop: string[]) =>
  list.filter((x) => !drop.some((d) => sameText(d, x)));

// The fields the client uses, in OTC's order, then the ones they added.
// `contractOptions` holds the choice options on their contracts, by the
// field they're for.
export function orgFields(
  inUse: Set<string>,
  newFields: OtcField[],
  custom: CustomField[],
  contractOptions: Record<string, string[]> = {},
  sections: OrgSection[] = ORG_SECTIONS,
): OrgField[] {
  return [
    ...OTC_FIELDS.filter((f) => f.sectionId !== CONTACT_ROLES_SECTION && inUse.has(f.id)).map(
      (f): OrgField => {
        if (f.kind !== "choice") return { id: f.id, name: f.name, sectionId: f.sectionId, kind: f.kind };
        const defaults = OTC_CHOICE_OPTIONS[f.id] ?? [];
        const extra = without(contractOptions[f.id] ?? [], defaults);
        return {
          id: f.id,
          name: f.name,
          sectionId: f.sectionId,
          kind: f.kind,
          defaults,
          ...(extra.length ? { options: extra } : {}),
        };
      },
    ),
    ...newFields.map((f) => ({
      id: f.id,
      name: f.name,
      sectionId: sections.some((s) => s.id === f.sectionId) ? f.sectionId : "",
      kind: f.kind,
      isNew: true,
      ...(f.kind === "choice" && contractOptions[f.id]?.length
        ? { options: contractOptions[f.id] }
        : {}),
    })),
    ...custom.map((f) => ({
      id: f.id,
      name: f.name,
      sectionId: sections.some((s) => s.id === f.sectionId) ? f.sectionId : "",
      kind: f.kind,
      isNew: true,
      ...(f.options ? { options: f.options } : {}),
    })),
  ];
}

// How Open to Close lays them out to start (fields they added go at the end
// of their section, where OTC puts a new field).
export function defaultLayout(fields: OrgField[], sections: OrgSection[] = ORG_SECTIONS): Layout {
  return ORG_GROUPS.map((group) => ({
    group,
    sections: sections.filter((s) => s.group === group).map((s) => ({
      id: s.id,
      fields: fields.filter((f) => f.sectionId === s.id).map((f) => f.id),
    })),
  }));
}

// A saved layout, brought up to date with the fields in use now: anything
// unknown is dropped, and sections or fields that weren't in it go where
// Open to Close has them (at the end).
export function reconcileLayout(
  raw: unknown,
  fields: OrgField[],
  sections: OrgSection[] = ORG_SECTIONS,
): Layout {
  const base = defaultLayout(fields, sections);
  if (!Array.isArray(raw)) return base;
  const sectionGroup = new Map(sections.map((s) => [s.id, s.group] as const));
  const fieldSection = new Map(fields.map((f) => [f.id, f.sectionId] as const));
  const seenSections = new Set<string>();
  const seenFields = new Set<string>();
  const out: Layout = ORG_GROUPS.map((group) => ({ group, sections: [] }));
  for (const g of raw as { group?: unknown; sections?: unknown }[]) {
    const target = out.find((x) => x.group === g?.group);
    if (!target || !Array.isArray(g.sections)) continue;
    for (const s of g.sections as { id?: unknown; fields?: unknown }[]) {
      const id = typeof s?.id === "string" ? s.id : "";
      if (!sectionGroup.has(id) || seenSections.has(id)) continue;
      seenSections.add(id);
      const ids = (Array.isArray(s.fields) ? s.fields : []).filter(
        (f): f is string => typeof f === "string" && fieldSection.has(f) && !seenFields.has(f),
      );
      ids.forEach((f) => seenFields.add(f));
      target.sections.push({ id, fields: ids });
    }
  }
  for (const g of base) {
    for (const s of g.sections) {
      const missing = s.fields.filter((f) => !seenFields.has(f));
      if (!seenSections.has(s.id)) {
        out.find((x) => x.group === g.group)!.sections.push({ id: s.id, fields: missing });
      } else if (missing.length > 0) {
        for (const x of out) {
          const at = x.sections.find((y) => y.id === s.id);
          if (at) at.fields.push(...missing);
        }
      }
    }
  }
  return out;
}

// The section a field is in (for a field added without a section, the one
// the client picked), or null.
export function sectionOf(layout: Layout, fieldId: string): string | null {
  for (const g of layout) for (const s of g.sections) if (s.fields.includes(fieldId)) return s.id;
  return null;
}

export function cleanMoves(raw: unknown): Move[] {
  if (!Array.isArray(raw)) return [];
  const place = (p: unknown) => {
    const v = p as { group?: unknown; section?: unknown; index?: unknown } | null;
    if (!v || typeof v.group !== "string" || !Number.isInteger(v.index)) return null;
    return {
      group: v.group.slice(0, 80),
      ...(typeof v.section === "string" ? { section: v.section.slice(0, 80) } : {}),
      index: Math.max(0, Math.min(10000, v.index as number)),
    };
  };
  const out: Move[] = [];
  for (const m of raw.slice(0, 500)) {
    const v = m as Partial<Move> | null;
    const from = place(v?.from);
    const to = place(v?.to);
    if (!v || (v.kind !== "field" && v.kind !== "section") || typeof v.id !== "string" || !from || !to)
      continue;
    out.push({
      at: typeof v.at === "string" ? v.at.slice(0, 40) : new Date().toISOString(),
      kind: v.kind,
      id: v.id.slice(0, 80),
      from,
      to,
    });
  }
  return out;
}

// The fewest drags that turn `start` into `target` (same items): the items
// outside the longest run already in order, each placed after the one
// before it in `target` (null: at the top), worked through top to bottom.
export function reorderSteps(start: string[], target: string[]): { id: string; after: string | null }[] {
  const pos = new Map(start.map((id, i) => [id, i] as const));
  const seq = target.filter((id) => pos.has(id));
  // Longest increasing run of start positions, in target order.
  const tails: number[] = [];
  const prev = new Array<number>(seq.length).fill(-1);
  for (let i = 0; i < seq.length; i++) {
    const v = pos.get(seq[i])!;
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (pos.get(seq[tails[mid]])! < v) lo = mid + 1;
      else hi = mid;
    }
    if (lo > 0) prev[i] = tails[lo - 1];
    tails[lo] = i;
  }
  const keep = new Set<string>();
  for (let i = tails.length ? tails[tails.length - 1] : -1; i >= 0; i = prev[i]) keep.add(seq[i]);
  return seq
    .map((id, i) => ({ id, after: i === 0 ? null : seq[i - 1] }))
    .filter((s) => !keep.has(s.id));
}

export type Instructions = {
  // Sections the client added, created at the end of the group they ended
  // up in (before anything else moves).
  newSections: { section: string; group: string }[];
  // Sections moved to another field group.
  sectionMoves: { section: string; from: string; to: string }[];
  // Open to Close's fields moved to another section (after the section
  // moves; each lands at the end of its new section).
  fieldMoves: { field: string; from: string; to: string }[];
  // Per group, the sections to drag (after the moves above).
  sectionOrder: { group: string; steps: { section: string; after: string | null }[] }[];
  // Per section, the fields to drag.
  fieldOrder: {
    group: string;
    section: string;
    steps: { field: string; after: string | null }[];
  }[];
};

// What to do in Open to Close to get from its layout to the client's:
// sections they added are created at the end of the group they ended up
// in, fields they added are created in the section they ended up in (at
// the end), then sections move to other groups (landing at the end), then
// fields move to other sections (landing at the end), then the drags.
export function instructionsFor(
  layout: Layout,
  fields: OrgField[],
  sections: OrgSection[] = ORG_SECTIONS,
): Instructions {
  const groupOf = (l: Layout, id: string) =>
    l.find((g) => g.sections.some((s) => s.id === id))?.group;
  const sectionName = (id: string) => sections.find((s) => s.id === id)?.name ?? id;
  const isOtc = new Set(ORG_SECTIONS.map((s) => s.id));
  const created = sections
    .filter((s) => !isOtc.has(s.id))
    .map((s) => ({ id: s.id, group: groupOf(layout, s.id) ?? s.group }));
  // OTC's layout once the new sections are made.
  const base = defaultLayout(fields.filter((f) => !f.isNew)).map((g) => ({
    ...g,
    sections: [
      ...g.sections,
      ...created.filter((c) => c.group === g.group).map((c) => ({ id: c.id, fields: [] })),
    ],
  }));
  const fieldName = (id: string) => fields.find((f) => f.id === id)?.name ?? id;

  const sectionMoves: Instructions["sectionMoves"] = [];
  for (const g of base) {
    for (const s of g.sections) {
      const now = groupOf(layout, s.id);
      if (now && now !== g.group) sectionMoves.push({ section: s.id, from: g.group, to: now });
    }
  }

  const sectionOrder: Instructions["sectionOrder"] = [];
  for (const g of layout) {
    const start = [
      ...(base.find((b) => b.group === g.group)?.sections ?? [])
        .map((s) => s.id)
        .filter((id) => groupOf(layout, id) === g.group),
      ...sectionMoves.filter((m) => m.to === g.group).map((m) => m.section),
    ];
    const steps = reorderSteps(
      start,
      g.sections.map((s) => s.id),
    ).map((s) => ({ section: sectionName(s.id), after: s.after ? sectionName(s.after) : null }));
    if (steps.length > 0) sectionOrder.push({ group: g.group, steps });
  }

  const home = new Map(fields.map((f) => [f.id, f.sectionId] as const));
  const fieldMoves: { field: string; from: string; to: string }[] = [];
  for (const g of layout) {
    for (const s of g.sections) {
      for (const id of s.fields) {
        const f = fields.find((x) => x.id === id);
        if (f && !f.isNew && home.get(id) !== s.id) {
          fieldMoves.push({ field: id, from: home.get(id)!, to: s.id });
        }
      }
    }
  }

  const fieldOrder: Instructions["fieldOrder"] = [];
  for (const g of layout) {
    for (const s of g.sections) {
      // OTC's own fields still here, then the ones added here, then the
      // ones moved here, in the order the steps above do them.
      const own = (base.flatMap((b) => b.sections).find((b) => b.id === s.id)?.fields ?? []).filter(
        (id) => s.fields.includes(id),
      );
      const added = fields.filter((f) => f.isNew && s.fields.includes(f.id)).map((f) => f.id);
      const movedIn = fieldMoves.filter((m) => m.to === s.id).map((m) => m.field);
      const start = [...own, ...added, ...movedIn];
      const steps = reorderSteps(start, s.fields).map((x) => ({
        field: fieldName(x.id),
        after: x.after ? fieldName(x.after) : null,
      }));
      if (steps.length > 0) fieldOrder.push({ group: g.group, section: sectionName(s.id), steps });
    }
  }

  return {
    newSections: created.map((c) => ({ section: sectionName(c.id), group: c.group })),
    sectionMoves: sectionMoves.map((m) => ({ ...m, section: sectionName(m.section) })),
    fieldMoves: fieldMoves.map((m) => ({
      field: fieldName(m.field),
      from: sectionName(m.from),
      to: sectionName(m.to),
    })),
    sectionOrder,
    fieldOrder,
  };
}

// Open to Close's fields the client doesn't use, by group and section, to
// archive.
export function fieldsToArchive(inUse: Set<string>) {
  return ORG_GROUPS.map((group) => ({
    group,
    sections: ORG_SECTIONS.filter((s) => s.group === group)
      .map((s) => ({
        section: s.name,
        fields: OTC_FIELDS.filter((f) => f.sectionId === s.id && !inUse.has(f.id)).map((f) => f.name),
      }))
      .filter((s) => s.fields.length > 0),
  })).filter((g) => g.sections.length > 0);
}

export function cleanChoiceEdits(raw: unknown, fields: OrgField[]): ChoiceEdits {
  const out: ChoiceEdits = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  const choice = new Set(fields.filter((f) => f.kind === "choice").map((f) => f.id));
  const list = (v: unknown) => {
    const items: string[] = [];
    for (const x of Array.isArray(v) ? v.slice(0, 200) : []) {
      const t = String(x ?? "").trim().slice(0, 120);
      if (t && !items.some((i) => sameText(i, t))) items.push(t);
    }
    return items;
  };
  for (const [id, edit] of Object.entries(raw as Record<string, { removed?: unknown; added?: unknown }>)) {
    if (!choice.has(id)) continue;
    const removed = list(edit?.removed);
    const added = list(edit?.added);
    if (removed.length || added.length) out[id] = { removed, added };
  }
  return out;
}

// A choice field's options as the client has them: OTC's, the ones from
// their contracts (or that they gave a field they added), and the ones they
// typed in, each marked deleted or not.
export function choiceOptions(f: OrgField, edit?: ChoiceEdits[string]) {
  const all: { title: string; isNew: boolean }[] = [];
  const push = (title: string, isNew: boolean) => {
    if (!all.some((o) => sameText(o.title, title))) all.push({ title, isNew });
  };
  for (const t of f.defaults ?? []) push(t, false);
  for (const t of f.options ?? []) push(t, true);
  for (const t of edit?.added ?? []) push(t, true);
  return all.map((o) => ({ ...o, removed: (edit?.removed ?? []).some((r) => sameText(r, o.title)) }));
}

// For the PDF: per field, the options to delete and to add. A field the
// client added just gets the options it keeps.
export function choiceChanges(fields: OrgField[], edits: ChoiceEdits) {
  return fields
    .filter((f) => f.kind === "choice" && !f.isNew)
    .map((f) => {
      const options = choiceOptions(f, edits[f.id]);
      return {
        field: f,
        remove: options.filter((o) => !o.isNew && o.removed).map((o) => o.title),
        add: options.filter((o) => o.isNew && !o.removed).map((o) => o.title),
      };
    })
    .filter((c) => c.remove.length > 0 || c.add.length > 0);
}

export const keptOptions = (f: OrgField, edits: ChoiceEdits) =>
  choiceOptions(f, edits[f.id])
    .filter((o) => !o.removed)
    .map((o) => o.title);
