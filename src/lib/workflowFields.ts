import { OTC_FIELD_IDS, OTC_SECTION_IDS, type OtcField } from "@/lib/otcFields";

// A contract field the client picked for their transaction workflow, with
// the kind of workflow field it becomes in Open to Close.
export type WorkflowFieldType =
  | "contact"
  | "text"
  | "text_area"
  | "decimal"
  | "date"
  | "number"
  | "choice";

export type WorkflowField = {
  // The contract field's key: its box id, or its link id when the client
  // linked several boxes as one answer (see workflowKeys).
  id: string;
  // Taken out of the workflow (shown grayed out). Its answers are kept so
  // restoring it brings them back.
  removed?: boolean;
  type?: WorkflowFieldType;
  // Decimals are money or a percentage.
  decimal_format?: "currency" | "percentage";
  // A choice field is the question being asked, or one of its options.
  choice_role?: "question" | "option";
  // For a choice option, the question it answers: a picked choice-question
  // field's id, or a NEW_QUESTION_PREFIX id for one the client typed in
  // (with its wording in question_text).
  question_id?: string;
  question_text?: string;
  // For an option whose choice field the client is adding to OTC (a
  // NEW_OTC_PREFIX question_id): the section it goes in.
  question_section?: string;
  // A choice option's title, as it should read in the choice field's list
  // of selections (e.g. "Conventional").
  option_title?: string;
  // The Open to Close field it fills: a built-in one (see otcFields), or a
  // NEW_OTC_PREFIX id for one the client is adding, with its name and the
  // section it goes in.
  otc_field?: string;
  otc_field_name?: string;
  otc_section?: string;
};

export const NEW_QUESTION_PREFIX = "new:";
export const NEW_OTC_PREFIX = "new-otc:";

// Every type gets an OTC field except a choice option, which belongs to its
// choice field.
export const needsOtcField = (field: WorkflowField) =>
  Boolean(field.type) && !(field.type === "choice" && field.choice_role === "option");

export const FIELD_TYPES: { value: WorkflowFieldType; label: string; tag: string }[] = [
  { value: "contact", label: "Contact", tag: "Contact" },
  { value: "text", label: "Text", tag: "Text" },
  { value: "text_area", label: "Text area", tag: "Text area" },
  { value: "decimal", label: "Decimal", tag: "Decimal" },
  { value: "date", label: "Date", tag: "Date" },
  { value: "number", label: "Number", tag: "#" },
  { value: "choice", label: "Choice", tag: "Choice" },
];

// The short tag shown on a picked field, e.g. "Date", "$", "%", "Q", "Opt".
export function fieldTag(field: WorkflowField): string {
  if (field.type === "decimal") {
    return field.decimal_format === "currency"
      ? "$"
      : field.decimal_format === "percentage"
        ? "%"
        : "Decimal";
  }
  if (field.type === "choice") {
    return field.choice_role === "question"
      ? "Choice field"
      : field.choice_role === "option"
        ? "Option"
        : "Choice";
  }
  return FIELD_TYPES.find((t) => t.value === field.type)?.tag ?? "?";
}

// Whether every question for this field has been answered. A removed field
// has nothing left to answer.
export function isComplete(field: WorkflowField): boolean {
  if (field.removed) return true;
  if (!field.type) return false;
  if (needsOtcField(field) && !field.otc_field) return false;
  if (field.type === "decimal") return Boolean(field.decimal_format);
  if (field.type === "choice") {
    return (
      field.choice_role === "question" ||
      (field.choice_role === "option" && Boolean(field.question_id) && Boolean(field.option_title))
    );
  }
  return true;
}

// A field the workflow tracks (picked and not removed).
export const isActive = (field: WorkflowField) => !field.removed;

// Maps each box id, and each link id, to the key its workflow field is
// saved under: linked boxes share their link's key.
export function workflowKeys(blanks: { id?: string; group?: string }[]): Map<string, string> {
  const keys = new Map<string, string>();
  for (const b of blanks) {
    if (!b.id) continue;
    const key = b.group ?? b.id;
    keys.set(b.id, key);
    keys.set(key, key);
  }
  return keys;
}

const TYPES = new Set(FIELD_TYPES.map((t) => t.value));

// Keeps only well-formed picks (used before saving, and on load), saved
// under their current key (see workflowKeys), so a box that has since been
// linked carries its answers over. A choice option loses its question when
// that question is no longer picked.
export function cleanWorkflowFields(raw: unknown, keys: Map<string, string>): WorkflowField[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: WorkflowField[] = [];
  for (const item of raw) {
    const f = item as Partial<WorkflowField> | null;
    const key = f && typeof f.id === "string" ? keys.get(f.id) : undefined;
    if (!f || !key || seen.has(key)) continue;
    seen.add(key);
    const type = TYPES.has(f.type as WorkflowFieldType) ? f.type : undefined;
    const clean: WorkflowField = {
      id: key,
      ...(f.removed === true ? { removed: true } : {}),
      ...(type ? { type } : {}),
    };
    if (type === "decimal" && (f.decimal_format === "currency" || f.decimal_format === "percentage")) {
      clean.decimal_format = f.decimal_format;
    }
    if (type === "choice" && (f.choice_role === "question" || f.choice_role === "option")) {
      clean.choice_role = f.choice_role;
      if (f.choice_role === "option" && typeof f.question_id === "string") {
        // An OTC choice field, one the client is adding, or (saved before
        // options were tied to OTC fields) a choice field picked on the
        // contract or a question typed in.
        const isNew =
          f.question_id.startsWith(NEW_QUESTION_PREFIX) || f.question_id.startsWith(NEW_OTC_PREFIX);
        clean.question_id =
          isNew || OTC_FIELD_IDS.has(f.question_id)
            ? f.question_id.slice(0, 80)
            : (keys.get(f.question_id) ?? f.question_id);
        if (isNew && typeof f.question_text === "string") {
          clean.question_text = f.question_text.trim().slice(0, 200);
        }
        if (typeof f.option_title === "string" && f.option_title.trim()) {
          clean.option_title = f.option_title.trim().slice(0, 120);
        }
        if (
          f.question_id.startsWith(NEW_OTC_PREFIX) &&
          typeof f.question_section === "string" &&
          OTC_SECTION_IDS.has(f.question_section)
        ) {
          clean.question_section = f.question_section;
        }
      }
    }
    if (needsOtcField(clean) && typeof f.otc_field === "string") {
      if (OTC_FIELD_IDS.has(f.otc_field)) {
        clean.otc_field = f.otc_field;
      } else if (
        f.otc_field.startsWith(NEW_OTC_PREFIX) &&
        typeof f.otc_field_name === "string" &&
        f.otc_field_name.trim()
      ) {
        clean.otc_field = f.otc_field.slice(0, 80);
        clean.otc_field_name = f.otc_field_name.trim().slice(0, 120);
        if (typeof f.otc_section === "string" && OTC_SECTION_IDS.has(f.otc_section)) {
          clean.otc_section = f.otc_section;
        }
      }
    }
    out.push(clean);
  }
  const questions = new Set(
    out.filter((f) => isActive(f) && f.choice_role === "question").map((f) => f.id),
  );
  for (const f of out) {
    if (!f.question_id) continue;
    const ok =
      f.question_id.startsWith(NEW_QUESTION_PREFIX) || f.question_id.startsWith(NEW_OTC_PREFIX)
        ? Boolean(f.question_text)
        : OTC_FIELD_IDS.has(f.question_id) || questions.has(f.question_id);
    if (!ok) {
      delete f.question_id;
      delete f.question_text;
      delete f.question_section;
    }
  }
  return out;
}

// The OTC fields a client has added (on any of their contracts), so they
// can be picked again for other fields.
export function newOtcFieldsFrom(fields: WorkflowField[]): OtcField[] {
  const out = new Map<string, OtcField>();
  for (const f of fields) {
    // A choice field added from one of its options.
    if (
      f.question_id?.startsWith(NEW_OTC_PREFIX) &&
      f.question_text &&
      !out.has(f.question_id)
    ) {
      out.set(f.question_id, {
        id: f.question_id,
        name: f.question_text,
        sectionId: f.question_section ?? "",
        kind: "choice",
        isNew: true,
      });
    }
    if (!f.otc_field?.startsWith(NEW_OTC_PREFIX) || !f.otc_field_name || out.has(f.otc_field)) {
      continue;
    }
    out.set(f.otc_field, {
      id: f.otc_field,
      name: f.otc_field_name,
      sectionId: f.otc_section ?? "",
      kind: f.type === "decimal" ? f.decimal_format : f.type,
      isNew: true,
    });
  }
  return [...out.values()];
}

// What a workflow field is assigned to in OTC: a choice option's choice
// field, or anything else's OTC field (or contact role).
export const otcTargetOf = (f: WorkflowField) =>
  f.type === "choice" && f.choice_role === "option" ? f.question_id : f.otc_field;

// Points a workflow field at an OTC field (`to`). A built-in OTC field also
// sets its type, so a field always matches the one it fills; a new field
// keeps the type it has. A choice option moves to `to` as its choice field.
export function reassignTo(f: WorkflowField, to: OtcField): WorkflowField {
  const next: WorkflowField = { ...f };
  delete next.removed;
  if (f.type === "choice" && f.choice_role === "option") {
    next.question_id = to.id;
    delete next.question_text;
    delete next.question_section;
    if (to.isNew) {
      next.question_text = to.name;
      if (to.sectionId) next.question_section = to.sectionId;
    }
    return next;
  }
  next.otc_field = to.id;
  delete next.otc_field_name;
  delete next.otc_section;
  if (to.isNew) {
    if (!next.type && to.kind) Object.assign(next, typeFor(to.kind));
    next.otc_field_name = to.name;
    if (to.sectionId) next.otc_section = to.sectionId;
    return next;
  }
  delete next.decimal_format;
  delete next.choice_role;
  if (to.kind) Object.assign(next, typeFor(to.kind));
  return next;
}

// The workflow field type that fills an OTC field of this kind.
function typeFor(kind: NonNullable<OtcField["kind"]>): Partial<WorkflowField> {
  if (kind === "currency" || kind === "percentage") return { type: "decimal", decimal_format: kind };
  if (kind === "choice") return { type: "choice", choice_role: "question" };
  return { type: kind };
}

// Assigns the contract field `key` (a box, or boxes linked as one) to an
// OTC field, picking it for the workflow if it wasn't yet.
export function assignContractField(
  fields: WorkflowField[],
  key: string,
  to: OtcField,
): WorkflowField[] {
  const existing = fields.find((f) => f.id === key);
  if (existing) return fields.map((f) => (f.id === key ? reassignTo(f, to) : f));
  return [...fields, reassignTo({ id: key }, to)];
}
