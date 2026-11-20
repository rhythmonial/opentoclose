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
  { value: "add_user", label: "Add me as a user" },
  { value: "share_later", label: "Share login securely later" },
  { value: "not_sure", label: "Not sure yet" },
] as const;
export const accessLabel = (v: string) => ACCESS_METHODS.find((a) => a.value === v)?.label ?? v;

export const TEAM_SIZES = ["Just me", "2–5", "6–10", "11–25", "26+"];

// Stripe's client_reference_id for a request (Payment Links pass it to
// the checkout session; the webhook marks the request paid).
export const AUDIT_REF_PREFIX = "audit_";
