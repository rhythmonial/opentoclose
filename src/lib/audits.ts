// The $55 OTC Audit: request form options and the statuses it moves through.
export const AUDIT_FEE = 55;

export const AUDIT_STATUSES = [
  { value: "requested", label: "Requested" },
  { value: "paid", label: "Paid" },
  { value: "in_progress", label: "In progress" },
  { value: "delivered", label: "Delivered" },
  { value: "upsold", label: "Upsold" },
  { value: "closed", label: "Closed" },
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
