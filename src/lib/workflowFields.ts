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
};

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
  if (field.type === "choice") return Boolean(field.choice_role);
  return true;
}

const TYPES = new Set(FIELD_TYPES.map((t) => t.value));

// Keeps only well-formed picks (used before saving).
export function cleanWorkflowFields(raw: unknown, allowedIds: Set<string>): WorkflowField[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: WorkflowField[] = [];
  for (const item of raw) {
    const f = item as Partial<WorkflowField> | null;
    if (!f || typeof f.id !== "string" || !allowedIds.has(f.id) || seen.has(f.id)) continue;
    seen.add(f.id);
    const type = TYPES.has(f.type as WorkflowFieldType) ? f.type : undefined;
    out.push({
      id: f.id,
      ...(type ? { type } : {}),
      ...(type === "decimal" && (f.decimal_format === "currency" || f.decimal_format === "percentage")
        ? { decimal_format: f.decimal_format }
        : {}),
      ...(type === "choice" && (f.choice_role === "question" || f.choice_role === "option")
        ? { choice_role: f.choice_role }
        : {}),
    });
  }
  return out;
}
