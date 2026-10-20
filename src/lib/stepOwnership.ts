// "free" -> signed up but hasn't paid for either plan yet (full checklist
// browsing/tracking, but lesson content is locked). "custom" -> Setup
// ($999). "diy" -> DIY ($19).
export type EngagementType = "free" | "custom" | "diy";

// The two real, paid plans. A "free" account is resolved to "diy" before
// calling effectiveOwner/isClientVisible, so those functions never see
// "free" directly.
export type PlanType = "custom" | "diy";

export type CompletedBy = "diy" | "setup" | "both" | "staff";

export type EffectiveOwner = "client" | "staff";

// Who checks the step off. Every step a client can see is theirs to
// complete; only "staff" steps are internal ops work.
export function effectiveOwner(
  completedBy: string,
  // Kept so call sites stay plan-aware if ownership ever diverges by plan.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  plan: PlanType,
): EffectiveOwner {
  return completedBy === "staff" ? "staff" : "client";
}

// Which steps the client portal shows under a plan.
// "diy" -> DIY (and Free) clients only. "setup" -> Setup clients only.
// "both" -> everyone. "staff" -> nobody (ops-only).
export function isClientVisible(completedBy: string, plan: PlanType): boolean {
  if (completedBy === "staff") return false;
  if (completedBy === "diy") return plan === "diy";
  if (completedBy === "setup") return plan === "custom";
  return true;
}
