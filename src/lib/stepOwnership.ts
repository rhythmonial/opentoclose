export type EngagementType = "custom" | "diy";

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
  engagementType: EngagementType,
): EffectiveOwner {
  if (completedBy === "staff") return "staff";
  if (completedBy === "setup")
    return engagementType === "diy" ? "client" : "staff";
  return "client";
}

// Whether the client-facing portal should show this step at all under the
// given engagement type.
// "staff" -> never (ops-only, not client-facing).
// "diy" -> only under the DIY engagement — it's a self-serve how-to that
// doesn't apply once staff is handling the equivalent work for a Setup
// client.
// "setup" / "both" -> always shown (as a staff-handled line or a client
// task, respectively).
export function isClientVisible(
  completedBy: string,
  engagementType: EngagementType,
): boolean {
  if (completedBy === "staff") return false;
  if (completedBy === "diy") return engagementType === "diy";
  return true;
}
