// Plan Your Task Templates: shared types and rules.

export type TaskSide = "buyer" | "seller" | "listing";
export type TaskTiming = "before" | "after" | "same_day";
export type TaskTimeFrame = "business_days" | "calendar_days" | "calendar_days_skip_weekend";

export type PlannedTask = {
  id: string | null;
  side: TaskSide;
  template: string;
  name: string;
  notes: string;
  critical: boolean;
  // Repeats every so many days; null when it doesn't recur.
  recurDays: number | null;
  dueDays: number | null;
  timeFrame: TaskTimeFrame | null;
  timing: TaskTiming | null;
  dateField: string;
  parentTask: string;
  sortOrder: number;
};

// Each side's templates are named with its prefix, e.g. "B - General".
export const SIDES: { value: TaskSide; label: string; prefix: string }[] = [
  { value: "buyer", label: "Buyer", prefix: "B -" },
  { value: "seller", label: "Seller", prefix: "S -" },
  { value: "listing", label: "Listing", prefix: "L -" },
];

export const TIMINGS: { value: TaskTiming; label: string }[] = [
  { value: "before", label: "Before" },
  { value: "after", label: "After" },
  { value: "same_day", label: "Same Day As" },
];

export const TASK_TIME_FRAMES: { value: TaskTimeFrame; label: string }[] = [
  { value: "business_days", label: "Business Day(s)" },
  { value: "calendar_days", label: "Calendar Day(s)" },
  { value: "calendar_days_skip_weekend", label: "Calendar Day(s) - Skip landing weekend day(s)" },
];

// The prep sheet's "Task Completed" date field: due from its parent task.
// Now a task has a parent task or a date field, never both.
export const TASK_COMPLETED = "Task Completed";

// What a task still needs (the prep sheet's starred columns).
export function missingFor(t: PlannedTask): string[] {
  const out: string[] = [];
  if (!t.name.trim()) out.push("a name");
  if (!t.timing) out.push("when");
  if (t.timing && t.timing !== "same_day" && t.dueDays === null) out.push("days");
  if (!t.dateField.trim() && !t.parentTask.trim()) out.push("a date field or parent task");
  return out;
}

export function cleanTask(raw: Partial<PlannedTask>) {
  const side = SIDES.some((s) => s.value === raw.side) ? (raw.side as TaskSide) : null;
  if (!side) return null;
  const text = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
  const recurDays =
    typeof raw.recurDays === "number" && Number.isInteger(raw.recurDays) && raw.recurDays >= 1 && raw.recurDays <= 365
      ? raw.recurDays
      : null;
  const parent = text(raw.parentTask, 200);
  const dateField = text(raw.dateField, 120) === TASK_COMPLETED ? "" : text(raw.dateField, 120);
  return {
    side,
    template: text(raw.template, 80) || "General",
    name: text(raw.name, 200) || "New task",
    notes: text(raw.notes, 2000),
    critical: raw.critical === true,
    recurring: recurDays !== null,
    recur_days: recurDays,
    due_days:
      typeof raw.dueDays === "number" && Number.isInteger(raw.dueDays) && raw.dueDays >= 0 && raw.dueDays <= 3650
        ? raw.dueDays
        : null,
    time_frame: TASK_TIME_FRAMES.some((t) => t.value === raw.timeFrame) ? raw.timeFrame! : null,
    timing: TIMINGS.some((t) => t.value === raw.timing) ? raw.timing! : null,
    // A parent task wins over a date field.
    date_field: parent ? "" : dateField,
    parent_task: parent,
    sort_order: Math.trunc(Number(raw.sortOrder) || 0),
  };
}
