// Prep Your Intake Form: per field, the document and task templates it
// brings in, and the answers that bring them in. A field can have more
// than one ("FHA, VA or Conventional" brings in the loan templates;
// "Cash" the cash ones).
export type IntakeTrigger = { templates: string[]; options: string[] };
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
export type IntakeCondition = { fields: string[]; options: string[] };
export type IntakeConditions = Record<string, IntakeCondition[]>;

function cleanRules<K extends string>(raw: unknown, key: K): Record<string, ({ options: string[] } & Record<K, string[]>)[]> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, ({ options: string[] } & Record<K, string[]>)[]> = {};
  for (const [id, list] of Object.entries(raw as Record<string, unknown>).slice(0, 1000)) {
    if (id.length > 120 || !Array.isArray(list)) continue;
    const rules = list
      .slice(0, 20)
      .map((r) => {
        const o = (r && typeof r === "object" ? r : {}) as Record<string, unknown>;
        return { [key]: texts(o[key]), options: texts(o.options) } as { options: string[] } & Record<K, string[]>;
      })
      // A rule without templates (or fields) does nothing.
      .filter((r) => r[key].length > 0);
    if (rules.length) out[id] = rules;
  }
  return out;
}

export const cleanIntakeTriggers = (raw: unknown): IntakeTriggers => cleanRules(raw, "templates");
export const cleanIntakeConditions = (raw: unknown): IntakeConditions => cleanRules(raw, "fields");

export const cleanIds = (v: unknown) =>
  Array.isArray(v)
    ? [...new Set(v.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length <= 120))].slice(0, 1000)
    : [];
