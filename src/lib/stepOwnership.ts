// "free" -> signed up but hasn't paid for either plan yet (full checklist
// browsing/tracking, but lesson content is locked). "custom" -> Setup
// ($999 + $33/mo). "diy" -> DIY ($33/mo).
export type EngagementType = "free" | "custom" | "diy";

// The two real, paid plans. A "free" account is resolved to "diy" before
// calling effectiveOwner.
export type PlanType = "custom" | "diy";

// Every step is shown to every plan. "staff" steps are ones our team
// handles; everything else ("both", and older "diy"/"setup" values) the
// client completes.
export type CompletedBy = "both" | "staff";

export type EffectiveOwner = "client" | "staff";

// Who checks the step off.
export function effectiveOwner(
  completedBy: string,
  // Kept so call sites stay plan-aware if ownership ever diverges by plan.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  plan: PlanType,
): EffectiveOwner {
  return completedBy === "staff" ? "staff" : "client";
}
