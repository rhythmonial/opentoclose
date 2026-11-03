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
  // The contract field's id (see ContractBlank.id).
  id: string;
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
};

export const NEW_QUESTION_PREFIX = "new:";

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
      ? "Choice Q"
      : field.choice_role === "option"
        ? "Option"
        : "Choice";
  }
  return FIELD_TYPES.find((t) => t.value === field.type)?.tag ?? "?";
}

// Whether every question for this field has been answered.
export function isComplete(field: WorkflowField): boolean {
  if (!field.type) return false;
  if (field.type === "decimal") return Boolean(field.decimal_format);
  if (field.type === "choice") {
    return field.choice_role === "question" || (field.choice_role === "option" && Boolean(field.question_id));
  }
  return true;
}

const TYPES = new Set(FIELD_TYPES.map((t) => t.value));

// Keeps only well-formed picks (used before saving). A choice option loses
// its question when that question is no longer picked.
export function cleanWorkflowFields(raw: unknown, allowedIds: Set<string>): WorkflowField[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: WorkflowField[] = [];
  for (const item of raw) {
    const f = item as Partial<WorkflowField> | null;
    if (!f || typeof f.id !== "string" || !allowedIds.has(f.id) || seen.has(f.id)) continue;
    seen.add(f.id);
    const type = TYPES.has(f.type as WorkflowFieldType) ? f.type : undefined;
    const clean: WorkflowField = { id: f.id, ...(type ? { type } : {}) };
    if (type === "decimal" && (f.decimal_format === "currency" || f.decimal_format === "percentage")) {
      clean.decimal_format = f.decimal_format;
    }
    if (type === "choice" && (f.choice_role === "question" || f.choice_role === "option")) {
      clean.choice_role = f.choice_role;
      if (f.choice_role === "option" && typeof f.question_id === "string") {
        clean.question_id = f.question_id.slice(0, 80);
        if (f.question_id.startsWith(NEW_QUESTION_PREFIX) && typeof f.question_text === "string") {
          clean.question_text = f.question_text.trim().slice(0, 200);
        }
      }
    }
    out.push(clean);
  }
  const questions = new Set(out.filter((f) => f.choice_role === "question").map((f) => f.id));
  for (const f of out) {
    if (!f.question_id) continue;
    const ok = f.question_id.startsWith(NEW_QUESTION_PREFIX)
      ? Boolean(f.question_text)
      : questions.has(f.question_id);
    if (!ok) {
      delete f.question_id;
      delete f.question_text;
    }
  }
  return out;
}
