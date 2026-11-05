// A contract field's type, chosen on its boxes in Upload Your Contracts and
// carried into Assign Your Workflow Fields (where it says which Open to
// Close fields it can fill). The two stay in step: a type set while
// uploading becomes the workflow field's type, and changing the type while
// assigning updates the boxes.
import type { ContractBlank } from "@/lib/contractBlanks";
import type { WorkflowField } from "@/lib/workflowFields";

export type BoxFieldType =
  | "contact"
  | "text"
  | "text_area"
  | "currency"
  | "percentage"
  | "date"
  | "number"
  | "choice_field"
  | "choice_option";

// Each type, as the menus list it, with the help shown while it's hovered
// and the short tag shown on its boxes.
export const FIELD_TYPE_OPTIONS: {
  value: BoxFieldType;
  label: string;
  tag: string;
  help: string;
}[] = [
  {
    value: "contact",
    label: "Contact",
    tag: "Contact",
    help: "This includes contact information for a partner of the transaction.",
  },
  {
    value: "text",
    label: "Text",
    tag: "Text",
    help: "This is a short string of text, but could also be numbers that don't require calculation, like a parcel or MLS number.",
  },
  {
    value: "text_area",
    label: "Text area",
    tag: "Text area",
    help: "This should be text that is typically longer and may need formatting (bold, italic, underline, etc.).",
  },
  {
    value: "currency",
    label: "Decimal: Dollar ($)",
    tag: "$",
    help: "This will appear as a dollar amount. Example: $500,000",
  },
  {
    value: "percentage",
    label: "Decimal: Percentage (%)",
    tag: "%",
    help: "This will appear as a percentage. Example: 30%",
  },
  { value: "date", label: "Date", tag: "Date", help: "This is a typical date field." },
  {
    value: "number",
    label: "Number",
    tag: "#",
    help: "This will appear as a number without commas or dashes and is designed to work with the Date Calculation tool.",
  },
  {
    value: "choice_field",
    label: "Choice field",
    tag: "Choice field",
    help: "This is a field that has multiple items to select from.",
  },
  {
    value: "choice_option",
    label: "Choice option",
    tag: "Option",
    help: "This is an option in a field with multiple selections and belongs under a specific choice field.",
  },
];

const VALUES = new Set(FIELD_TYPE_OPTIONS.map((t) => t.value));
export const isBoxFieldType = (v: unknown): v is BoxFieldType =>
  typeof v === "string" && VALUES.has(v as BoxFieldType);

// The workflow field settings for a type.
export function workflowTypeOf(t: BoxFieldType): Omit<WorkflowField, "id"> {
  if (t === "currency" || t === "percentage") return { type: "decimal", decimal_format: t };
  if (t === "choice_field") return { type: "choice", choice_role: "question" };
  if (t === "choice_option") return { type: "choice", choice_role: "option" };
  return { type: t };
}

// A workflow field's type, as a box type (none until it's complete enough).
export function boxTypeOf(f: Pick<WorkflowField, "type" | "decimal_format" | "choice_role">) {
  if (f.type === "decimal") return f.decimal_format;
  if (f.type === "choice") {
    return f.choice_role === "question"
      ? "choice_field"
      : f.choice_role === "option"
        ? "choice_option"
        : undefined;
  }
  return f.type;
}

// The type set on a field's boxes (a box, or boxes linked as one).
function typesByKey(blanks: ContractBlank[]) {
  const out = new Map<string, BoxFieldType>();
  for (const b of blanks) {
    if (!b.id || !b.fieldType) continue;
    const key = b.group ?? b.id;
    if (!out.has(key)) out.set(key, b.fieldType);
  }
  return out;
}

// Workflow fields after the upload's types: a typed field that isn't in the
// workflow yet is added with that type (still needing its OTC field), and
// one whose type has changed takes the new type (its OTC field goes, since
// it was for the old type). Removed fields stay removed. A field whose type
// was cleared (it had one in `before`) leaves the workflow.
export function withBoxTypes(
  fields: WorkflowField[],
  blanks: ContractBlank[],
  before: ContractBlank[] = [],
): WorkflowField[] {
  const types = typesByKey(blanks);
  const had = typesByKey(before);
  const out = fields.filter((f) => types.has(f.id) || !had.has(f.id)).map((f) => {
    const t = types.get(f.id);
    if (!t || f.removed || boxTypeOf(f) === t) return f;
    return { id: f.id, ...workflowTypeOf(t) };
  });
  const have = new Set(out.map((f) => f.id));
  for (const [key, t] of types) {
    if (!have.has(key)) out.push({ id: key, ...workflowTypeOf(t) });
  }
  return out;
}

// Boxes after the workflow fields' types (a type changed while assigning
// shows on the boxes in Upload Your Contracts too).
export function withWorkflowTypes(
  blanks: ContractBlank[],
  fields: WorkflowField[],
): ContractBlank[] {
  const types = new Map<string, BoxFieldType>();
  for (const f of fields) {
    const t = f.removed ? undefined : boxTypeOf(f);
    if (t) types.set(f.id, t);
  }
  return blanks.map((b) => {
    if (!b.id) return b;
    const t = types.get(b.group ?? b.id);
    return t && b.fieldType !== t ? { ...b, fieldType: t } : b;
  });
}
