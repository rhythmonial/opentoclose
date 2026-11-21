// The OTC Audit report: what's filled in on each audit's report form, and
// what it prints as.
export const REPORT_AREAS = [
  { key: "fields", label: "Fields", about: "Field order for intake and workflow efficiency." },
  { key: "dates", label: "Dates", about: "Date calculations and intake trigger functionality." },
  { key: "emails", label: "Emails", about: "Accuracy of your merge fields and templates." },
  { key: "tasks", label: "Tasks", about: "The tasks and templates you need." },
  { key: "forms", label: "Forms", about: "Your intake form setup." },
  { key: "views", label: "Views", about: "The property, contact, and task views you need." },
] as const;

// Each area: what to fix (broken), work on (missing) and improve.
export const REPORT_PARTS = [
  { key: "fix", label: "Fix", hint: "What's broken" },
  { key: "work_on", label: "Work on", hint: "What's missing" },
  { key: "improve", label: "Improve", hint: "What could work harder" },
] as const;

export type AuditReport = {
  summary: string;
  priorities: string;
  areas: Record<string, Record<string, string>>;
  next_steps: string;
};

const text = (v: unknown) => (typeof v === "string" ? v.replace(/\r\n/g, "\n").slice(0, 20000) : "");

export function cleanReport(raw: unknown): AuditReport {
  const o = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const rawAreas = (o.areas && typeof o.areas === "object" ? o.areas : {}) as Record<string, unknown>;
  const areas: AuditReport["areas"] = {};
  for (const a of REPORT_AREAS) {
    const parts = (rawAreas[a.key] && typeof rawAreas[a.key] === "object" ? rawAreas[a.key] : {}) as Record<string, unknown>;
    areas[a.key] = Object.fromEntries(REPORT_PARTS.map((p) => [p.key, text(parts[p.key])]));
  }
  return { summary: text(o.summary), priorities: text(o.priorities), areas, next_steps: text(o.next_steps) };
}
