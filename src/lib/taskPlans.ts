// Plan Your Task Templates: shared types and rules.

// "buyer", "seller", "listing", or the id of a task list the client added.
export type TaskSide = string;
export type TaskTiming = "before" | "after" | "same_day";
export type TaskTimeFrame =
  | "business_days"
  | "calendar_days"
  | "calendar_days_skip_weekend";

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
  // Email templates sent from this task (by title; up to MAX_TASK_EMAILS).
  // OTC sends an email only from a task.
  emails: string[];
  // Documents attached to it (by name; any number).
  documents: string[];
};

export const MAX_TASK_EMAILS = 3;

// Each side's templates are named with its prefix, e.g. "B - General".
export type SideInfo = {
  value: TaskSide;
  label: string;
  prefix: string;
  custom?: boolean;
};

export const SIDES: SideInfo[] = [
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
  {
    value: "calendar_days_skip_weekend",
    label: "Calendar Day(s) - Skip landing weekend day(s)",
  },
];

// The prep sheet's "Task Completed" date field: due from its parent task.
// Now a task has a parent task or a date field, never both.
export const TASK_COMPLETED = "Task Completed";

// What a task still needs (the prep sheet's starred columns).
export function missingFor(t: PlannedTask): string[] {
  const out: string[] = [];
  if (!t.name.trim()) out.push("a name");
  if (!t.timing) out.push("when");
  if (t.timing && t.timing !== "same_day" && t.dueDays === null)
    out.push("days");
  if (!t.dateField.trim() && !t.parentTask.trim())
    out.push("a date field or parent task");
  return out;
}

// A task list the client added, as a side ("D" becomes "D -").
export const customSide = (r: {
  id: string;
  label: string;
  prefix: string;
}): SideInfo => ({
  value: r.id,
  label: r.label,
  prefix: `${r.prefix} -`,
  custom: true,
});

// `sides`: the sides this client can use (the built-in ones and their own).
export function cleanTask(
  raw: Partial<PlannedTask>,
  sides: readonly string[] = SIDES.map((s) => s.value),
) {
  const side =
    typeof raw.side === "string" && sides.includes(raw.side) ? raw.side : null;
  if (!side) return null;
  const text = (v: unknown, max: number) =>
    String(v ?? "")
      .trim()
      .slice(0, max);
  const recurDays =
    typeof raw.recurDays === "number" &&
    Number.isInteger(raw.recurDays) &&
    raw.recurDays >= 1 &&
    raw.recurDays <= 365
      ? raw.recurDays
      : null;
  const parent = text(raw.parentTask, 200);
  const dateField =
    text(raw.dateField, 120) === TASK_COMPLETED ? "" : text(raw.dateField, 120);
  return {
    side,
    template: text(raw.template, 80) || "General",
    name: text(raw.name, 200) || "New task",
    notes: text(raw.notes, 2000),
    critical: raw.critical === true,
    recurring: recurDays !== null,
    recur_days: recurDays,
    due_days:
      typeof raw.dueDays === "number" &&
      Number.isInteger(raw.dueDays) &&
      raw.dueDays >= 0 &&
      raw.dueDays <= 3650
        ? raw.dueDays
        : null,
    time_frame: TASK_TIME_FRAMES.some((t) => t.value === raw.timeFrame)
      ? raw.timeFrame!
      : null,
    timing: TIMINGS.some((t) => t.value === raw.timing) ? raw.timing! : null,
    // A parent task wins over a date field.
    date_field: parent ? "" : dateField,
    parent_task: parent,
    sort_order: Math.trunc(Number(raw.sortOrder) || 0),
    email_templates: names(raw.emails, 200).slice(0, MAX_TASK_EMAILS),
    documents: names(raw.documents, 160).slice(0, 200),
  };
}

// A list of distinct, non-empty names.
function names(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  return [
    ...new Set(
      v
        .map((x) =>
          String(x ?? "")
            .trim()
            .slice(0, max),
        )
        .filter(Boolean),
    ),
  ];
}

// A task row from the database.
export function fromRow(r: {
  id: string;
  side: string;
  template: string;
  name: string;
  notes: string;
  critical: boolean;
  recur_days: number | null;
  due_days: number | null;
  time_frame: string | null;
  timing: string | null;
  date_field: string;
  parent_task: string;
  sort_order: number;
  email_templates: string[];
  documents: string[];
}): PlannedTask {
  return {
    id: r.id,
    side: r.side,
    template: r.template,
    name: r.name,
    notes: r.notes,
    critical: r.critical,
    recurDays: r.recur_days,
    dueDays: r.due_days,
    timeFrame: r.time_frame as PlannedTask["timeFrame"],
    timing: r.timing as PlannedTask["timing"],
    dateField: r.date_field,
    parentTask: r.parent_task,
    sortOrder: r.sort_order,
    emails: r.email_templates ?? [],
    documents: r.documents ?? [],
  };
}

// Which side an email template is for, by its title's prefix letter ("B -
// Request..." is Buyer's), or null when none matches.
export function emailSide(title: string, sides: SideInfo[]): TaskSide | null {
  const t = title.trim();
  for (const s of sides) {
    const letter = s.prefix.replace(/\s*-\s*$/, "").trim();
    if (letter && t.toLowerCase().startsWith(`${letter.toLowerCase()} `))
      return s.value;
  }
  return null;
}

// An email's title without its side prefix ("B - Intro to Lender" ->
// "Intro to Lender"), for naming the task that sends it.
export const withoutSidePrefix = (title: string) =>
  title
    .trim()
    .replace(/^[A-Za-z]{1,6}\s*-\s+/, "")
    .replace(/^[A-Za-z]\s+/, "") || title.trim();
