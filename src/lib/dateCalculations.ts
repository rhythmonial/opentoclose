import { OTC_FIELD_IDS } from "@/lib/otcFields";
import { NEW_OTC_PREFIX } from "@/lib/workflowFields";

// How a date field is worked out, as OTC's Date Calculation asks: so many
// (calendar or business) days before or after another date. The days are a
// set number, or a blank on the contract the agent fills in, recorded as the
// number field it goes in.
export type DateCalc = {
  otc_field: string;
  enabled: boolean;
  days: number | null;
  days_on_contract: boolean;
  number_field: string | null;
  time_frame: "calendar_days" | "business_days" | null;
  direction: "before" | "after" | null;
  relative_to: string | null;
};

export const TIME_FRAMES = [
  { value: "calendar_days", label: "Calendar Days" },
  { value: "business_days", label: "Business Days" },
] as const;

export const DIRECTIONS = [
  { value: "before", label: "Before" },
  { value: "after", label: "After" },
] as const;

export const emptyCalc = (otcField: string): DateCalc => ({
  otc_field: otcField,
  enabled: false,
  days: null,
  days_on_contract: false,
  number_field: null,
  time_frame: null,
  direction: null,
  relative_to: null,
});

// Whether a checked date has everything it needs.
export function calcComplete(c: DateCalc) {
  if (!c.enabled) return true;
  const days = c.days_on_contract ? Boolean(c.number_field) : c.days !== null;
  return days && Boolean(c.time_frame && c.direction && c.relative_to);
}

// An OTC field id we'll store: a built-in one or one the client added.
export const validFieldId = (id: unknown): id is string =>
  typeof id === "string" &&
  id.length <= 80 &&
  (OTC_FIELD_IDS.has(id) || id.startsWith(NEW_OTC_PREFIX));

// Keeps only well-formed values (used before saving).
export function cleanCalc(raw: Partial<DateCalc>): DateCalc | null {
  if (!validFieldId(raw.otc_field)) return null;
  const days =
    typeof raw.days === "number" && Number.isInteger(raw.days) && raw.days >= 0 && raw.days <= 3650
      ? raw.days
      : null;
  return {
    otc_field: raw.otc_field,
    enabled: raw.enabled === true,
    days,
    days_on_contract: raw.days_on_contract === true,
    number_field: validFieldId(raw.number_field) ? raw.number_field : null,
    time_frame:
      raw.time_frame === "calendar_days" || raw.time_frame === "business_days"
        ? raw.time_frame
        : null,
    direction: raw.direction === "before" || raw.direction === "after" ? raw.direction : null,
    relative_to:
      validFieldId(raw.relative_to) && raw.relative_to !== raw.otc_field ? raw.relative_to : null,
  };
}

// The number field that usually holds a date's days, by name: "Inspection
// Period - Days" for "Inspection Period Date", "HOA Due - Days" for "HOA
// Due Date".
export function matchingNumberField<T extends { name: string }>(dateName: string, numbers: T[]) {
  const stem = (s: string) =>
    s
      .toLowerCase()
      .replace(/\b(date|days)\b/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const target = stem(dateName);
  return numbers.find((n) => stem(n.name) === target) ?? null;
}
