import { OTC_FIELD_IDS } from "@/lib/otcFields";
import { NEW_OTC_PREFIX } from "@/lib/workflowFields";

// How a date field is worked out, as OTC's Date Calculation asks: so many
// (calendar or business) days after or before another date, or the same day
// as it. The days are a set number, or a blank on the contract the agent
// fills in, recorded as the number field it goes in. Then how weekends and
// federal holidays move it (null is N/A).
export type DateCalc = {
  otc_field: string;
  enabled: boolean;
  days: number | null;
  days_on_contract: boolean;
  number_field: string | null;
  time_frame: TimeFrame | null;
  direction: "before" | "after" | null;
  relative_to: string | null;
  weekend_roll: "back" | "forward" | null;
  holiday_roll: "back" | "forward" | null;
  federal_holidays: "count" | "skip" | null;
  // A date the client added (otc_field starts with NEW_OTC_PREFIX): its name.
  field_name?: string | null;
};

export type TimeFrame =
  | "business_days"
  | "calendar_days"
  | "calendar_days_skip_weekend"
  | "same_day";

// As OTC lists them.
export const TIME_FRAMES = [
  { value: "business_days", label: "Business Day(s)" },
  { value: "calendar_days", label: "Calendar Day(s)" },
  { value: "calendar_days_skip_weekend", label: "Calendar Day(s) - Skip landing weekend day(s)" },
  { value: "same_day", label: "Same Day As" },
] as const;

export const DIRECTIONS = [
  { value: "after", label: "After" },
  { value: "before", label: "Before" },
] as const;

export const ROLLS = [
  { value: "back", label: "Roll Back" },
  { value: "forward", label: "Roll Forward" },
] as const;

export const FEDERAL_HOLIDAYS = [
  { value: "count", label: "Count Federal Holidays" },
  { value: "skip", label: "Skip Federal Holidays" },
] as const;

// "Same Day As" has no days to count or direction to go.
export const isSameDay = (c: Pick<DateCalc, "time_frame">) => c.time_frame === "same_day";

export const emptyCalc = (otcField: string): DateCalc => ({
  otc_field: otcField,
  enabled: false,
  days: null,
  days_on_contract: false,
  number_field: null,
  // Calendar days unless the client picks another time frame.
  time_frame: "calendar_days",
  direction: null,
  relative_to: null,
  weekend_roll: null,
  holiday_roll: null,
  federal_holidays: null,
});

// Whether a checked date has everything it needs.
export function calcComplete(c: DateCalc) {
  if (!c.enabled) return true;
  if (!c.time_frame || !c.relative_to) return false;
  if (isSameDay(c)) return true;
  const days = c.days_on_contract ? Boolean(c.number_field) : c.days !== null;
  return days && Boolean(c.direction);
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
    time_frame: TIME_FRAMES.some((t) => t.value === raw.time_frame)
      ? (raw.time_frame as TimeFrame)
      : null,
    direction: raw.direction === "before" || raw.direction === "after" ? raw.direction : null,
    relative_to:
      validFieldId(raw.relative_to) && raw.relative_to !== raw.otc_field ? raw.relative_to : null,
    weekend_roll: raw.weekend_roll === "back" || raw.weekend_roll === "forward" ? raw.weekend_roll : null,
    holiday_roll: raw.holiday_roll === "back" || raw.holiday_roll === "forward" ? raw.holiday_roll : null,
    federal_holidays:
      raw.federal_holidays === "count" || raw.federal_holidays === "skip" ? raw.federal_holidays : null,
    field_name:
      raw.otc_field.startsWith(NEW_OTC_PREFIX) && typeof raw.field_name === "string"
        ? raw.field_name.trim().slice(0, 120) || null
        : null,
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

// Most dates count from when the contract was accepted.
export const ACCEPTANCE_DATE_ID = "critical-details/acceptance-date";

const stemOf = (s: string) =>
  s
    .toLowerCase()
    .replace(/\b(date|days)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// A number field that holds a count of days ("Inspection Period - Days"),
// as opposed to one like "Year Built".
export const isDaysField = (name: string) => /\bdays?\b/i.test(name);

// The date a days field sets: "Inspection Period Date" for "Inspection
// Period - Days".
export function matchingDateField<T extends { name: string }>(numberName: string, dates: T[]) {
  const target = stemOf(numberName);
  return dates.find((d) => stemOf(d.name) === target) ?? null;
}

// What to call the date for a days field that doesn't have one ("Option
// Period - Days" sets "Option Period - Date").
export const dateNameFor = (numberName: string) =>
  /\bdays\b/i.test(numberName) ? numberName.replace(/\bdays\b/i, "Date") : `${numberName} Date`;
