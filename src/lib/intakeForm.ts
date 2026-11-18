// Prep Your Intake Form: per field, the document and task templates it
// brings in, and the answers that bring them in. A field can have more
// than one ("FHA, VA or Conventional" brings in the loan templates;
// "Cash" the cash ones).
// op: "is" (the answer is one of the options) or "not" (it isn't).
export const INTAKE_OPS = [
  { value: "has_value", label: "has a value" },
  { value: "is_blank", label: "is blank" },
  { value: "is", label: "is equal to" },
  { value: "not", label: "is not equal to" },
  { value: "gte", label: "is greater than or equals" },
  { value: "lte", label: "is less than or equals" },
  { value: "gt", label: "is greater than" },
  { value: "lt", label: "is less than" },
] as const;
export type IntakeOp = (typeof INTAKE_OPS)[number]["value"];
const OP_VALUES = new Set<string>(INTAKE_OPS.map((o) => o.value));
// Has a value and is blank need no answer; the rest need one (or, for a
// choice field's is / is not, one or more of its options).
export const needsAnswer = (op: string) => op !== "has_value" && op !== "is_blank";
// Comparisons are for numbers, dollars, percentages and dates.
export const COMPARE_OPS = new Set(["gte", "lte", "gt", "lt"]);
export type IntakeTrigger = { op: IntakeOp; options: string[]; templates: string[] };
export type IntakeTriggers = Record<string, IntakeTrigger[]>;

// How templates are listed (and saved) in the templates column.
export const taskTemplateLabel = (name: string) => `Tasks: ${name}`;
export const docTemplateLabel = (name: string) => `Docs: ${name}`;

const text = (v: unknown, max = 160) =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";
const texts = (v: unknown, max = 50) =>
  Array.isArray(v) ? [...new Set(v.map((x) => text(x)).filter(Boolean))].slice(0, max) : [];

// Per field, the other fields it shows on the form and on which answers
// (Financing Type = FHA, VA or Conventional shows the loan fields).
export type IntakeCondition = { op: "is"; options: string[]; fields: string[] };
export type IntakeConditions = Record<string, IntakeCondition[]>;

type CleanRule<K extends string> = { op: IntakeOp; options: string[] } & Record<K, string[]>;

// Rules are picked in order: is / isn't, the answers, then the templates
// (or fields), so one with only its first parts is kept to finish.
function cleanRules<K extends string>(raw: unknown, key: K): Record<string, CleanRule<K>[]> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, CleanRule<K>[]> = {};
  for (const [id, list] of Object.entries(raw as Record<string, unknown>).slice(0, 1000)) {
    if (id.length > 120 || !Array.isArray(list)) continue;
    const rules = list.slice(0, 20).flatMap((r) => {
      if (!r || typeof r !== "object") return [];
      const o = r as Record<string, unknown>;
      // Saved before the operator was picked first: "not: true", else "is".
      let op: IntakeOp | null =
        typeof o.op === "string" && OP_VALUES.has(o.op)
          ? (o.op as IntakeOp)
          : o.not === true
            ? "not"
            : Array.isArray(o[key])
              ? "is"
              : null;
      if (!op) return [];
      let options = texts(o.options);
      // "Has a value" / "Is blank" were answers before they were operators.
      if (op === "is" && options.length === 1 && (options[0] === "Has a value" || options[0] === "Is blank")) {
        op = options[0] === "Has a value" ? "has_value" : "is_blank";
        options = [];
      }
      if (!needsAnswer(op)) options = [];
      return [{ op, options, [key]: texts(o[key]) } as CleanRule<K>];
    });
    if (rules.length) out[id] = rules;
  }
  return out;
}

export const cleanIntakeTriggers = (raw: unknown): IntakeTriggers => cleanRules(raw, "templates");
// Conditions only show fields when the answer IS one of the options.
export const cleanIntakeConditions = (raw: unknown): IntakeConditions =>
  Object.fromEntries(
    Object.entries(cleanRules(raw, "fields")).map(([id, list]) => [
      id,
      list.filter((r) => r.op === "is").map((r) => ({ op: "is" as const, options: r.options, fields: r.fields })),
    ]),
  );

export const cleanIds = (v: unknown) =>
  Array.isArray(v)
    ? [...new Set(v.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length <= 120))].slice(0, 1000)
    : [];
