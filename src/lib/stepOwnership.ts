export type EngagementType = "custom" | "diy";

export type EffectiveOwner = "client" | "staff";

// "client" -> always the client. "staff_always" -> always staff (ops-only,
// e.g. payment, intake approval), regardless of engagement type. "staff" ->
// staff for full-Setup clients, but flips to the client for DIY clients who
// haven't paid for us to handle it.
export function effectiveOwner(
  completedBy: string,
  engagementType: EngagementType,
): EffectiveOwner {
  if (completedBy === "staff_always") return "staff";
  if (completedBy === "staff") return engagementType === "diy" ? "client" : "staff";
  return "client";
}
