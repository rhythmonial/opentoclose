// "free" -> signed up but hasn't paid for either plan yet (full checklist
// browsing/tracking, but lesson content is locked). "custom" -> Setup
// ($999 + $55/mo). "diy" -> DIY ($55/mo).
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

// Lessons our team handles (marked S) that paying clients (DIY or Setup)
// may do themselves or ask our team to set up with their setup hours.
// Either way, the lesson stops holding them up once it's done or requested.
export function isDelegable(completedBy: string, engagement: string | null | undefined) {
  return completedBy === "staff" && (engagement === "diy" || engagement === "custom");
}
