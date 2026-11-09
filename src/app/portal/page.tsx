import { redirect } from "next/navigation";
import Link from "next/link";
import { freeMonthDay, freeMonthStatus } from "@/lib/coupons";
import { startPlanCheckout } from "@/app/checkout/actions";
import { PLAN_PRICES } from "@/lib/pricing";
import { SupportButton } from "@/components/SupportButton";
import { createClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/TopNav";
import {
  effectiveOwner,
  isDelegable,
  type EngagementType,
  type PlanType,
} from "@/lib/stepOwnership";
import { StaffNav } from "@/components/StaffNav";
import { stepClientHref } from "@/lib/stepHref";
import { createAdminClient } from "@/lib/supabase/admin";
import { getHourlyRate } from "@/lib/hourlyRate";
import { BuyHoursButton } from "@/components/BuyHoursButton";
import { getSandboxTier, SANDBOX_LABEL } from "@/lib/devSandbox";


// Every step is required: red until it's done, then the neutral grey row.
function stepRowClass(isApproved: boolean): string {
  return isApproved ? "border-border-soft bg-bg" : "border-danger/30 bg-danger/5";
}

export default async function PortalPage({
  searchParams,
}: {
  searchParams: Promise<{
    paid?: string;
    hours?: string;
    asked?: string;
    coupon?: string;
    locked?: string;
  }>;
}) {
  // Set when Stripe Checkout sends them back after paying for a plan (or
  // for more hours).
  const { paid, hours: hoursBought, asked, coupon, locked } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: realProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isStaff =
    realProfile?.role === "dev" || realProfile?.role === "dev_admin";
  const sandboxTier = isStaff ? await getSandboxTier() : null;
  const isSandboxing = Boolean(sandboxTier);

  const { data: profile } = isStaff
    ? { data: null }
    : await supabase
        .from("profiles")
        .select("*, client_accounts(name, setup_path, hours_purchased)")
        .eq("id", user.id)
        .single();

  if (!isStaff && profile && !profile.first_login_at) {
    await supabase
      .from("profiles")
      .update({ first_login_at: new Date().toISOString() })
      .eq("id", user.id);
  }

  // A coupon's free month (ending one that's run out, before the plan is
  // read below).
  const freeMonth =
    isStaff
      ? { activeUntil: null, endedOn: null }
      : await freeMonthStatus(profile?.client_account_id);
  const isOwner = profile?.role === "client_owner";
  const couponApplied = Boolean(coupon) && !isStaff;

  const setupPath = profile?.client_accounts?.setup_path ?? "custom";

  const [
    { data: allSteps },
    { data: statuses },
    { data: hoursLog },
    { data: initiation },
    { data: setupRequests },
  ] = await Promise.all([
    supabase
      .from("setup_steps")
      .select("*")
      .eq("path", setupPath)
      .order("sort_order"),
    isSandboxing
      ? supabase.from("dev_sandbox_step_status").select("*").eq("tier", sandboxTier!)
      : supabase.from("client_step_status").select("*").eq("client_id", user.id),
    // Hours the team has logged for anyone on the account (read with the
    // service role; members only see their own rows).
    isSandboxing || !profile?.client_account_id
      ? Promise.resolve({ data: [] as { hours: number }[] })
      : createAdminClient()
          .from("profiles")
          .select("id")
          .eq("client_account_id", profile.client_account_id)
          .then(async ({ data: members }) => {
            const ids = (members ?? []).map((m) => m.id);
            return ids.length
              ? await createAdminClient().from("hours_log").select("hours").in("client_id", ids)
              : { data: [] as { hours: number }[] };
          }),
    isSandboxing
      ? Promise.resolve({ data: { engagement_type: sandboxTier! } })
      : supabase
          .from("setup_initiation")
          .select("engagement_type")
          .eq("client_id", user.id)
          .maybeSingle(),
    // Lessons they've asked our team to set up (still open).
    !isSandboxing && profile?.client_account_id
      ? supabase
          .from("setup_requests")
          .select("step_id")
          .eq("client_account_id", profile.client_account_id)
          .is("done_at", null)
      : Promise.resolve({ data: [] as { step_id: string }[] }),
  ]);

  // Plain staff preview (no sandbox active) has no setup_initiation row of
  // its own — defaults to Free, same as a brand new signup would see.
  // Sandboxing uses the sandbox tier directly as the engagement type.
  const engagementType = (
    isStaff && !isSandboxing
      ? "free"
      : (initiation?.engagement_type ?? "free")
  ) as EngagementType;
  // Free accounts follow the DIY checklist until they pick a plan.
  const plan: PlanType = engagementType === "custom" ? "custom" : "diy";

  const statusByStep = new Map(
    (statuses ?? []).map((s) => [s.step_id, s.status]),
  );

  // Every plan sees every step, including the ones our team handles.
  const steps = allSteps ?? [];

  const requestedSteps = new Set((setupRequests ?? []).map((r) => r.step_id));

  // Access: the first pillar (Getting Started) is free to everyone. Once
  // they've sent Initiate Your Setup, every pillar shows its sections and
  // lesson titles, but lessons past the first pillar only open on a paid
  // plan (DIY, Setup, or a free month). Staff previewing see everything.
  const previewAll = isStaff && !isSandboxing;
  const hasInitiation = isSandboxing || Boolean(initiation);
  const hasPaidPlan = engagementType === "diy" || engagementType === "custom";
  const freePhase = steps[0]?.phase ?? "General";

  // Steps unlock in order: one shows once every client step before it is
  // done. Lessons our team handles (which DIY and Setup clients may do or
  // request) never hold them up. Staff previewing (not in a sandbox) see
  // everything.
  const isClientStep = (s: { completed_by: string }) =>
    effectiveOwner(s.completed_by, plan) === "client";
  const unlocked = new Set<string>();
  {
    let blocked = false;
    for (const s of steps) {
      if (blocked && !(isStaff && !isSandboxing)) break;
      unlocked.add(s.id);
      if (isClientStep(s) && statusByStep.get(s.id) !== "approved") blocked = true;
    }
  }

  // Only the section holding the client's next task starts expanded: the
  // first unfinished step after their last completed one (falling back to
  // the earliest unfinished step).
  // (A lesson they've asked our team to set up counts as handled here.)
  const isDone = (s: { id: string }) =>
    statusByStep.get(s.id) === "approved" || requestedSteps.has(s.id);
  const lastDoneIndex = steps.findLastIndex(isDone);
  const nextStep =
    steps.find((s, i) => i > lastDoneIndex && !isDone(s)) ??
    steps.find((s) => !isDone(s));
  const currentPhase = nextStep ? (nextStep.phase ?? "General") : null;
  const currentSection = nextStep?.section ?? null;

  const hoursUsed = (hoursLog ?? []).reduce((sum, h) => sum + Number(h.hours), 0);
  // A sandbox shows what that plan's client sees: Setup comes with the
  // 10-hour bundle.
  const hoursPurchased = isSandboxing
    ? sandboxTier === "custom"
      ? PLAN_PRICES.setup.hours
      : 0
    : Number(profile?.client_accounts?.hours_purchased ?? 0);
  const hourlyRate = isStaff ? 0 : await getHourlyRate();
  const businessName =
    isStaff
      ? isSandboxing
        ? SANDBOX_LABEL[sandboxTier!]
        : "Preview"
      : (profile?.client_accounts?.name ?? user.email ?? "Your business");


  return (
    <main className="flex min-h-screen flex-col bg-bg">
      {isStaff && !isSandboxing ? (
        <StaffNav isDev={realProfile?.role === "dev"} />
      ) : (
        <TopNav
          businessName={businessName}
          active="setup"
          sandboxTier={sandboxTier}
        />
      )}

      {hoursBought === "purchased" && !isStaff && (
        <div className="mx-4 mt-4 rounded-lg border border-success/30 bg-success-soft px-4 py-2.5 text-sm font-semibold text-success sm:mx-6 lg:mx-12">
          Thanks! Your new hours show up as soon as the payment goes through.
        </div>
      )}

      {couponApplied && (
        <div className="mx-4 mt-4 rounded-lg border border-success/30 bg-success-soft px-4 py-2.5 text-sm font-semibold text-success sm:mx-6 lg:mx-12">
          Coupon applied! Your free month of DIY has started.
        </div>
      )}
      {!couponApplied && (freeMonth.endedOn || freeMonth.activeUntil) && (
        <div className="mx-4 mt-4 sm:mx-6 lg:mx-12">
        {freeMonth.endedOn && (
          <div className="flex flex-col gap-2 rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning sm:flex-row sm:items-center sm:justify-between">
            <span className="font-semibold">
              Your free month ended {freeMonthDay(freeMonth.endedOn)}. Subscribe to keep your DIY
              access.
            </span>
            {isOwner ? (
              <form action={startPlanCheckout}>
              <input type="hidden" name="plan" value="diy" />
              <input type="hidden" name="return_to" value="/portal" />
              <button
                type="submit"
                className="rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                Subscribe
              </button>
            </form>
            ) : (
              <span className="text-xs">Ask your account owner to subscribe.</span>
            )}
          </div>
        )}
        {freeMonth.activeUntil && (
          <div className="rounded-lg border border-accent-soft bg-accent-soft/40 px-4 py-2.5 text-sm text-accent">
            <span className="font-semibold">Free month</span> of DIY until{" "}
            {freeMonthDay(freeMonth.activeUntil)}.{" "}
            <Link href="/profile#billing" className="font-semibold underline">
              Subscribe
            </Link>{" "}
            any time to keep access after.
          </div>
        )}
        </div>
      )}

      {/* Sent Initiate Your Setup but no paid plan yet (and not just
          after a free month, which has its own prompt). */}
      {!isStaff &&
        !hasPaidPlan &&
        ((hasInitiation && !freeMonth.endedOn && !paid) || (locked && !hasInitiation)) && (
        <div className="mx-4 mt-4 flex flex-col gap-2 rounded-lg border border-accent-soft bg-accent-soft/40 px-4 py-3 text-sm text-accent sm:mx-6 sm:flex-row sm:items-center sm:justify-between lg:mx-12">
          <span className="font-semibold">
            {!hasInitiation
              ? "Initiate your setup to unlock the rest of your lessons."
              : locked
                ? "Choose a plan to open that lesson."
                : "Getting Started is free. Choose a plan (DIY or Setup) to open the rest of your lessons."}
          </span>
          <Link
            href="/setup"
            className="shrink-0 self-start rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            {hasInitiation ? "Choose a plan" : "Initiate your setup"} &rarr;
          </Link>
        </div>
      )}

      {asked && !isStaff && (
        <div className="mx-4 mt-4 rounded-lg border border-success/30 bg-success-soft px-4 py-2.5 text-sm font-semibold text-success sm:mx-6 lg:mx-12">
          Question sent! We usually respond within 24 hours. You&rsquo;ll see our reply in{" "}
          <Link href="/support" className="underline">
            Support
          </Link>
          .
        </div>
      )}

      {paid && !isStaff && (
        <div className="mx-4 mt-4 rounded-lg border border-success/30 bg-success-soft px-4 py-2.5 text-sm font-semibold text-success sm:mx-6 lg:mx-12">
          Payment received, welcome to {paid === "diy" ? "DIY" : "Setup"}! Your plan updates
          within a minute; refresh if it hasn&rsquo;t yet.
        </div>
      )}

      {isStaff && !isSandboxing && (
        <div className="mx-4 mt-4 rounded-lg border border-accent-soft bg-accent-soft/40 px-4 py-2.5 text-sm font-semibold text-accent sm:mx-6 lg:mx-12">
          Previewing the portal as a {engagementType === "custom" ? "Setup" : engagementType === "diy" ? "DIY" : "Free"} account &mdash; actions are disabled here.
        </div>
      )}

      <div className="px-4 pt-6 sm:px-6 sm:pt-9 lg:px-12">
        {/* Title, with setup hours used and + to buy more on the right
            (clients, and staff sandboxes). */}
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-2xl font-bold text-ink sm:text-[28px]">
            Your OTC Setup
          </h1>
          {(!isStaff || isSandboxing) && (
            <div className="flex shrink-0 items-center gap-2.5">
              {hoursPurchased > 0 && (
                <span
                  className={`text-sm font-semibold ${hoursUsed > hoursPurchased ? "text-danger" : "text-ink-soft"}`}
                  title="Setup hours used"
                >
                  {Number(hoursUsed.toFixed(1))} / {Number(hoursPurchased.toFixed(1))}
                  <span className="hidden sm:inline"> hours used</span>
                </span>
              )}
              <BuyHoursButton
                purchased={hoursPurchased}
                used={hoursUsed}
                hourlyRate={hourlyRate}
                canBuy={isSandboxing || profile?.role === "client_owner"}
                returnTo="/portal"
              />
            </div>
          )}
        </div>
        <p className="mt-1.5 text-sm text-ink-soft">
          {businessName} &middot; here&rsquo;s where things stand with your
          implementation.
        </p>
      </div>

      <div className="flex flex-col gap-6 px-4 pb-10 pt-6 sm:px-6 sm:pt-7 lg:flex-row lg:gap-8 lg:px-12 lg:pb-12">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-medium text-ink-soft">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 -translate-y-0.5 rounded border border-navy bg-danger/5" />
              To do
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 -translate-y-0.5 rounded border border-navy bg-bg" />
              Complete
            </span>
          </div>

          {(() => {
            const all = steps;
            const phaseList = Array.from(
              new Set(all.map((s) => s.phase ?? "General")),
            );

            return phaseList.map((phase) => {
              const phaseSteps = all.filter(
                (s) => (s.phase ?? "General") === phase,
              );
              const visiblePhaseSteps = steps.filter(
                (s) => (s.phase ?? "General") === phase,
              );
              const sections = Array.from(
                new Set(phaseSteps.map((s) => s.section)),
              );
              const requiredPhaseSteps = phaseSteps;
              const completeCount = requiredPhaseSteps.filter(
                (s) => statusByStep.get(s.id) === "approved",
              ).length;
              const isComplete = completeCount === requiredPhaseSteps.length;
              // The free pillar always shows; the rest once they've sent
              // Initiate Your Setup.
              const phaseUnlocked = previewAll || phase === freePhase || hasInitiation;
              const isFreePhase = phase === freePhase;

              if (!phaseUnlocked) {
                return (
                  <div
                    key={phase}
                    className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface p-5 opacity-70"
                    title="Unlocks when you initiate your setup"
                  >
                    <div className="flex items-center gap-2.5">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-ink-faint" aria-hidden>
                        <rect x="4" y="11" width="16" height="10" rx="2" />
                        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                      </svg>
                      <h2 className="font-display text-lg font-bold text-ink">{phase}</h2>
                    </div>
                    <span className="text-xs font-semibold text-ink-faint">
                      {phaseSteps.length} lesson{phaseSteps.length === 1 ? "" : "s"}
                    </span>
                  </div>
                );
              }

              return (
                <details
                  key={phase}
                  open={phase === currentPhase}
                  className="rounded-xl border border-border bg-surface p-5"
                >
                  <summary className="flex cursor-pointer items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5">
                      {isComplete && (
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="text-success"
                        >
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      )}
                      <h2 className="font-display text-lg font-bold text-ink">
                        {phase}
                      </h2>
                    </div>
                    <span className="text-xs font-semibold text-ink-faint">
                      {completeCount} / {requiredPhaseSteps.length} lessons complete
                    </span>
                  </summary>

                  <div className="mt-4 flex flex-col gap-5">
                    {sections.map((section) => {
                      const sectionSteps = phaseSteps.filter(
                        (s) => s.section === section,
                      );
                      const visibleSectionSteps = visiblePhaseSteps.filter(
                        (s) => s.section === section,
                      );
                      const sectionRequired = sectionSteps;
                      const sectionCompleteCount = sectionRequired.filter(
                        (s) => statusByStep.get(s.id) === "approved",
                      ).length;
                      const sectionComplete =
                        sectionCompleteCount === sectionRequired.length;

                      return (
                    <details
                      key={section}
                      open={
                        phase === currentPhase && section === currentSection
                      }
                    >
                      <summary className="flex cursor-pointer items-center justify-between gap-4">
                        <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase font-caption tracking-wide text-ink-faint">
                          {sectionComplete && (
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="text-success"
                            >
                              <path d="M20 6 9 17l-5-5" />
                            </svg>
                          )}
                          {section}
                        </h3>
                        <span className="text-[11px] font-semibold normal-case text-ink-faint">
                          {sectionCompleteCount} / {sectionRequired.length}
                        </span>
                      </summary>
                      <div className="mt-2 flex flex-col gap-2.5">
                        {visibleSectionSteps
                          .map((step) => {
                            const status =
                              statusByStep.get(step.id) ?? "not_started";
                            const href = stepClientHref(step);
                            const isApproved = status === "approved";
                            const isClientManaged =
                              effectiveOwner(step.completed_by, plan) === "client" ||
                              isDelegable(step.completed_by, engagementType);
                            const isRequested =
                              requestedSteps.has(step.id) && !isApproved;

                            const titleBlock = (
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-bold text-ink">
                                  {step.title}
                                  {isStaff && !step.is_published && (
                                    <span className="ml-2 rounded-full bg-ink-faint/15 px-2 py-0.5 font-caption text-[10px] font-bold uppercase tracking-wide text-ink-soft">
                                      Hidden
                                    </span>
                                  )}
                                </div>
                                {step.description && (
                                  <div className="text-xs text-ink-soft">
                                    {step.description}
                                  </div>
                                )}
                              </div>
                            );

                            // Opens when reached in order, and (past the free
                            // pillar) on a paid plan.
                            const needsPlan = !isFreePhase && !hasPaidPlan;
                            const canOpen =
                              previewAll || (!needsPlan && unlocked.has(step.id));
                            if (!canOpen) {
                              return (
                                <div
                                  key={step.id}
                                  title={
                                    needsPlan
                                      ? "Choose a plan to open this lesson"
                                      : "Opens after the lessons before it"
                                  }
                                  className="flex flex-col items-start gap-3 rounded-lg border border-border-soft bg-bg px-4 py-3 opacity-75 sm:flex-row sm:items-center sm:gap-4"
                                >
                                  <div className="w-full min-w-0 sm:w-auto sm:flex-1">
                                    {titleBlock}
                                  </div>
                                  <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-ink-faint">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                      <rect x="4" y="11" width="16" height="10" rx="2" />
                                      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                                    </svg>
                                    {needsPlan ? "Choose a plan to open" : "Locked"}
                                  </span>
                                </div>
                              );
                            }

                            return (
                              <Link
                                key={step.id}
                                href={href}
                                className={`flex flex-col items-start gap-3 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:gap-4 ${stepRowClass(isApproved)}`}
                              >
                                <div className="w-full min-w-0 sm:w-auto sm:flex-1">
                                  {titleBlock}
                                </div>
                                <div className="flex w-full items-center justify-end gap-3 sm:w-auto">
                                  {isRequested ? (
                                    // They asked our team to set it up.
                                    <span className="flex shrink-0 items-center gap-1.5 rounded-lg border border-gold/60 bg-gold/15 px-3 py-2 text-sm font-semibold text-navy">
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-gold" aria-hidden>
                                        <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" />
                                      </svg>
                                      Set up requested
                                    </span>
                                  ) : isClientManaged ? (
                                    <span className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white">
                                      {status === "not_started"
                                        ? "Start"
                                        : status === "approved"
                                          ? "Update"
                                          : "Continue"}
                                    </span>
                                  ) : (
                                    // Our team checks these off; clients can read along.
                                    <span className="shrink-0 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-ink-soft">
                                      {isApproved ? "Done by our team" : "Our team handles this"}
                                    </span>
                                  )}
                                </div>
                              </Link>
                            );
                          })}
                      </div>
                    </details>
                      );
                    })}
                </div>
              </details>
            );
          });
          })()}

          {steps.length === 0 && (
            <p className="text-sm text-ink-soft">
              No setup steps configured yet for this path.
            </p>
          )}
        </div>

        <div className="flex w-full flex-col gap-5 lg:w-[340px] lg:shrink-0">
          <div className="rounded-xl border border-border-soft bg-bg p-5">
            <h3 className="mb-1.5 text-sm font-bold text-ink">Need Help?</h3>
            <p className="mb-3.5 text-sm leading-relaxed text-ink-soft">
              Send Josie&rsquo;s team a question any time &mdash; we usually respond within 24
              hours.
            </p>
            {isStaff ? (
              <span className="text-xs text-ink-faint">Questions are off in previews.</span>
            ) : (
              <SupportButton
                variant="ask"
                returnTo="/portal"
                lessons={(allSteps ?? []).map((st) => ({
                  id: st.id,
                  title: st.title,
                  phase: st.phase ?? "General",
                }))}
              />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
