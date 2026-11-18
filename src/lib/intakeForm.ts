// Prep Your Intake Form: per field, the document and task templates it
// brings in, and the answers that bring them in. A field can have more
// than one ("FHA, VA or Conventional" brings in the loan templates;
// "Cash" the cash ones).
// op: "is" (the answer is one of the options) or "not" (it isn't).
export type IntakeOp = "is" | "not";
export type IntakeTrigger = { op: IntakeOp; options: string[]; templates: string[] };
export type IntakeTriggers = Record<string, IntakeTrigger[]>;

// What a field that isn't a choice field can trigger on.
export const HAS_VALUE = "Has a value";
export const IS_BLANK = "Is blank";
export const VALUE_OPTIONS = [HAS_VALUE, IS_BLANK];

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
      // Saved before is / isn't was picked first: "not: true", else "is".
      const op: IntakeOp | null =
        o.op === "is" || o.op === "not" ? o.op : o.not === true ? "not" : Array.isArray(o[key]) ? "is" : null;
      if (!op) return [];
      return [{ op, options: texts(o.options), [key]: texts(o[key]) } as CleanRule<K>];
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
      list.map((r) => ({ op: "is" as const, options: r.options, fields: r.fields })),
    ]),
  );

export const cleanIds = (v: unknown) =>
  Array.isArray(v)
    ? [...new Set(v.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length <= 120))].slice(0, 1000)
    : [];
