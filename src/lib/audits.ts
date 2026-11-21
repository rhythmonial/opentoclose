// The $55 OTC Audit: request form options and the statuses it moves through.
export const AUDIT_FEE = 55;

// The offer closes on New Year's Day (Eastern); the form stops taking
// requests then.
export const AUDIT_CLOSES_AT = new Date("2027-01-01T00:00:00-05:00");
export const auditClosed = () => Date.now() >= AUDIT_CLOSES_AT.getTime();

export const AUDIT_STATUSES = [
  // Requested (paid or not: paid_at tells which).
  { value: "received", label: "Received" },
  { value: "in_progress", label: "In progress" },
  { value: "delivered", label: "Delivered" },
  { value: "upsold", label: "Upsold" },
  { value: "lost", label: "Lost" },
] as const;
export type AuditStatus = (typeof AUDIT_STATUSES)[number]["value"];
export const isAuditStatus = (v: string): v is AuditStatus => AUDIT_STATUSES.some((s) => s.value === v);
export const statusLabel = (v: string) => AUDIT_STATUSES.find((s) => s.value === v)?.label ?? v;

export const ACCESS_METHODS = [
  { value: "provide_below", label: "I'll provide them below" },
  { value: "share_directly", label: "I'll share them directly" },
] as const;
// Earlier requests' access answers too.
const OLD_ACCESS: Record<string, string> = {
  add_user: "Add me as a user",
  share_later: "Share login securely later",
  not_sure: "Not sure yet",
};
export const accessLabel = (v: string) => ACCESS_METHODS.find((a) => a.value === v)?.label ?? OLD_ACCESS[v] ?? v;

// Where they text their login when they share it directly.
export const AUDIT_TEXT_NUMBER = "813-906-6019";

// Stripe's client_reference_id for a request (Payment Links pass it to
// the checkout session; the webhook marks the request paid).
export const AUDIT_REF_PREFIX = "audit_";

// Times are shown in Eastern (where Josie works).
export const AUDIT_TZ = "America/New_York";
export const easternDateTime = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-US", {
        timeZone: AUDIT_TZ,
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      })
    : "—";
export const easternDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { timeZone: AUDIT_TZ, month: "short", day: "numeric", year: "numeric" });
// A timestamp's Eastern date as YYYY-MM-DD (for date inputs).
export const easternYmd = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-CA", { timeZone: AUDIT_TZ }) : "";
// A picked date (YYYY-MM-DD) saved as noon Eastern.
export const ymdToTimestamp = (ymd: string) => `${ymd}T12:00:00-05:00`;
export const isYmd = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T12:00:00Z`));

// The report is due 5 business days (Monday to Friday) after the audit date.
export const REPORT_BUSINESS_DAYS = 5;
export function reportDue(auditDate: string | null): string | null {
  if (!auditDate || !isYmd(auditDate)) return null;
  const d = new Date(`${auditDate}T12:00:00Z`);
  let added = 0;
  while (added < REPORT_BUSINESS_DAYS) {
    d.setUTCDate(d.getUTCDate() + 1);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) added++;
  }
  return d.toISOString().slice(0, 10);
}
// "Mon, Dec 8, 2026" for a YYYY-MM-DD date.
export const formatYmd = (ymd: string | null) =>
  ymd
    ? new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-US", {
        timeZone: "UTC",
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

// Moving to in progress (or later) stamps the paid date if it isn't set;
// delivered or upsold, the delivered date.
export const PAID_OR_LATER = ["in_progress", "delivered", "upsold"];
export const DELIVERED_OR_LATER = ["delivered", "upsold"];

// The upsell is billed hourly, less the audit fee (it's credited toward
// the work).
export const UPSELL_HOURLY_RATE = 125;
export const upsellAmount = (hours: number | null) =>
  hours && hours > 0 ? Math.max(0, hours * UPSELL_HOURLY_RATE - AUDIT_FEE) : null;
