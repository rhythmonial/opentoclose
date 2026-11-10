import {
  CONTACT_ROLES_SECTION,
  OTC_FIELDS,
  OTC_SECTIONS,
  type CustomField,
  type Kind,
  type OtcField,
} from "@/lib/otcFields";

// Organize Your Fields: the client arranges the fields they use the way
// they'd like them in Open to Close: sections within a field group (or
// moved to another group) and fields within their section.

export type OrgField = {
  id: string;
  name: string;
  // "" for a field the client added without a section (they pick one here).
  sectionId: string;
  kind?: Kind;
  // Added by the client (to be created in OTC), with a choice field's
  // options when they gave them.
  isNew?: boolean;
  options?: string[];
};

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

// The fields the client uses, in OTC's order, then the ones they added.
export function orgFields(
  inUse: Set<string>,
  newFields: OtcField[],
  custom: CustomField[],
): OrgField[] {
  return [
    ...OTC_FIELDS.filter((f) => f.sectionId !== CONTACT_ROLES_SECTION && inUse.has(f.id)).map(
      (f) => ({ id: f.id, name: f.name, sectionId: f.sectionId, kind: f.kind }),
    ),
    ...newFields.map((f) => ({
      id: f.id,
      name: f.name,
      sectionId: ORG_SECTIONS.some((s) => s.id === f.sectionId) ? f.sectionId : "",
      kind: f.kind,
      isNew: true,
    })),
    ...custom.map((f) => ({
      id: f.id,
      name: f.name,
      sectionId: f.sectionId,
      kind: f.kind,
      isNew: true,
      ...(f.options ? { options: f.options } : {}),
    })),
  ];
}

// How Open to Close lays them out to start (fields they added go at the end
// of their section, where OTC puts a new field).
export function defaultLayout(fields: OrgField[]): Layout {
  return ORG_GROUPS.map((group) => ({
    group,
    sections: ORG_SECTIONS.filter((s) => s.group === group).map((s) => ({
      id: s.id,
      fields: fields.filter((f) => f.sectionId === s.id).map((f) => f.id),
    })),
  }));
}

// A saved layout, brought up to date with the fields in use now: anything
// unknown is dropped, a field stays in its own section, and sections or
// fields that weren't in it go where Open to Close has them (at the end).
export function reconcileLayout(raw: unknown, fields: OrgField[]): Layout {
  const base = defaultLayout(fields);
  if (!Array.isArray(raw)) return base;
  const sectionGroup = new Map(ORG_SECTIONS.map((s) => [s.id, s.group] as const));
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
      // A field stays in its own section; one without a section goes in
      // the section the client picked for it.
      const ids = (Array.isArray(s.fields) ? s.fields : []).filter(
        (f): f is string =>
          typeof f === "string" &&
          (fieldSection.get(f) === id || fieldSection.get(f) === "") &&
          !seenFields.has(f),
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
  // Sections moved to another field group.
  sectionMoves: { section: string; from: string; to: string }[];
  // Per group, the sections to drag (after the moves above).
  sectionOrder: { group: string; steps: { section: string; after: string | null }[] }[];
  // Per section, the fields to drag.
  fieldOrder: {
    group: string;
    section: string;
    steps: { field: string; after: string | null }[];
  }[];
};

// What to do in Open to Close to get from its layout to the client's.
// Sections moved to another group land at the end of it there.
export function instructionsFor(layout: Layout, fields: OrgField[]): Instructions {
  const base = defaultLayout(fields);
  const groupOf = (l: Layout, id: string) =>
    l.find((g) => g.sections.some((s) => s.id === id))?.group;
  const sectionName = (id: string) => ORG_SECTIONS.find((s) => s.id === id)?.name ?? id;
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

  const fieldOrder: Instructions["fieldOrder"] = [];
  for (const g of layout) {
    for (const s of g.sections) {
      // Fields added without a section go at the end of the one picked.
      const own = base.flatMap((b) => b.sections).find((b) => b.id === s.id)?.fields ?? [];
      const start = [...own, ...s.fields.filter((id) => !own.includes(id))];
      const steps = reorderSteps(start, s.fields).map((x) => ({
        field: fieldName(x.id),
        after: x.after ? fieldName(x.after) : null,
      }));
      if (steps.length > 0) fieldOrder.push({ group: g.group, section: sectionName(s.id), steps });
    }
  }

  return {
    sectionMoves: sectionMoves.map((m) => ({ ...m, section: sectionName(m.section) })),
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
