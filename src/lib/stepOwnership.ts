// "free" -> signed up but hasn't paid for either plan yet (full checklist
// browsing/tracking, but lesson content is locked). "custom" -> Setup
// ($999). "diy" -> DIY ($19).
export type EngagementType = "free" | "custom" | "diy";

// The two real, paid plans. Ownership/visibility only ever differ between
// these two — a "free" account is resolved to one of these (almost always
// "diy", since nobody's paying staff to do anything for them yet) before
// calling effectiveOwner/isClientVisible, so those functions never see
// "free" directly.
export type PlanType = "custom" | "diy";

export type CompletedBy = "diy" | "setup" | "both" | "staff";

export type EffectiveOwner = "client" | "staff";

// Who actually does the step, regardless of whether it's shown to the
// client at all (see isClientVisible for that).
// "staff" -> always staff (ops-only, e.g. payment, intake approval).
// "setup" -> staff for full-Setup clients, but flips to the client for DIY
// clients who haven't paid for us to handle it.
// "diy" / "both" -> always the client, whenever it's relevant to them.
export function effectiveOwner(
  completedBy: string,
  plan: PlanType,
): EffectiveOwner {
  if (completedBy === "staff") return "staff";
  if (completedBy === "setup") return plan === "diy" ? "client" : "staff";
  return "client";
}

// Whether the client-facing portal should show this step at all under the
// given plan.
// "staff" -> never (ops-only, not client-facing).
// "diy" -> only under the DIY plan — it's a self-serve how-to that doesn't
// apply once staff is handling the equivalent work for a Setup client.
// "setup" / "both" -> always shown (as a staff-handled line or a client
// task, respectively).
export function isClientVisible(completedBy: string, plan: PlanType): boolean {
  if (completedBy === "staff") return false;
  if (completedBy === "diy") return plan === "diy";
  return true;
}
