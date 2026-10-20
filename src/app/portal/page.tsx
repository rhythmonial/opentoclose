import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/TopNav";
import {
  effectiveOwner,
  isClientVisible,
  type EngagementType,
  type PlanType,
} from "@/lib/stepOwnership";
import { StaffNav } from "@/components/StaffNav";
import { stepClientHref, isExternalStepLink } from "@/lib/stepHref";
import { toggleLessonComplete } from "@/app/lesson/actions";
import { getSandboxTier, SANDBOX_LABEL } from "@/lib/devSandbox";

const HOURS_PER_BUNDLE = 10;

function isRequiredStep(step: {
  is_optional: boolean;
  is_future_build: boolean;
}): boolean {
  return !step.is_optional && !step.is_future_build;
}

// Required -> red, optional -> yellow, future build -> green; anything
// complete falls back to the neutral grey row.
function stepRowClass(
  step: { is_optional: boolean; is_future_build: boolean },
  isApproved: boolean,
): string {
  if (isApproved) return "border-border-soft bg-bg";
  if (step.is_future_build) return "border-success/40 bg-success-soft";
  if (step.is_optional) return "border-warning/50 bg-warning-soft";
  return "border-danger/30 bg-danger/5";
}

export default async function PortalPage() {
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
        .select("*, client_accounts(name, setup_path)")
        .eq("id", user.id)
        .single();

  if (!isStaff && profile && !profile.first_login_at) {
    await supabase
      .from("profiles")
      .update({ first_login_at: new Date().toISOString() })
      .eq("id", user.id);
  }

  const setupPath = profile?.client_accounts?.setup_path ?? "custom";

  const [
    { data: allSteps },
    { data: statuses },
    { data: hoursLog },
    { data: initiation },
  ] = await Promise.all([
    supabase
      .from("setup_steps")
      .select("*")
      .eq("path", setupPath)
      .order("sort_order"),
    isSandboxing
      ? supabase.from("dev_sandbox_step_status").select("*").eq("tier", sandboxTier!)
      : supabase.from("client_step_status").select("*").eq("client_id", user.id),
    isSandboxing
      ? Promise.resolve({ data: [] as { id: string; hours: number; logged_date: string; description: string }[] })
      : supabase
          .from("hours_log")
          .select("*")
          .eq("client_id", user.id)
          .order("logged_date", { ascending: false })
          .limit(5),
    isSandboxing
      ? Promise.resolve({ data: { engagement_type: sandboxTier! } })
      : supabase
          .from("setup_initiation")
          .select("engagement_type")
          .eq("client_id", user.id)
          .maybeSingle(),
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

  // Work completed on the client's own steps, used as the DIY work log —
  // DIY clients do everything themselves, so there's no staff hours_log to
  // show them, just a record of what they've finished and when.
  const completedStepLog = (allSteps ?? [])
    .filter((s) => statusByStep.get(s.id) === "approved")
    .map((s) => ({
      id: s.id,
      title: s.title,
      completedAt: (statuses ?? []).find((st) => st.step_id === s.id)
        ?.updated_at,
    }))
    .filter((e): e is { id: string; title: string; completedAt: string } =>
      Boolean(e.completedAt),
    )
    .sort(
      (a, b) =>
        new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
    )
    .slice(0, 8);

  // Setup clients see Setup + Both steps; DIY and Free see DIY + Both.
  // Staff-only steps never show here.
  const visibleSteps = (allSteps ?? []).filter((s) =>
    isClientVisible(s.completed_by, plan),
  );
  const steps = visibleSteps;

  // Only the section holding the client's next task starts expanded: the
  // first unfinished required step after their last completed one (falling
  // back to the earliest unfinished required step, then any unfinished step).
  const isDone = (s: { id: string }) => statusByStep.get(s.id) === "approved";
  const lastDoneIndex = steps.findLastIndex(isDone);
  const nextStep =
    steps.find((s, i) => i > lastDoneIndex && isRequiredStep(s) && !isDone(s)) ??
    steps.find((s) => isRequiredStep(s) && !isDone(s)) ??
    steps.find((s) => !isDone(s));
  const currentPhase = nextStep ? (nextStep.phase ?? "General") : null;
  const currentSection = nextStep?.section ?? null;

  const hoursUsed = (hoursLog ?? []).reduce((sum, h) => sum + Number(h.hours), 0);
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

      {isStaff && !isSandboxing && (
        <div className="mx-4 mt-4 rounded-lg border border-accent-soft bg-accent-soft/40 px-4 py-2.5 text-sm font-semibold text-accent sm:mx-6 lg:mx-12">
          Previewing the portal as a {engagementType === "custom" ? "Setup" : engagementType === "diy" ? "DIY" : "Free"} account &mdash; actions are disabled here.
        </div>
      )}

      <div className="flex flex-col items-start gap-3 px-4 pt-6 sm:px-6 sm:pt-9 lg:flex-row lg:items-start lg:justify-between lg:px-12">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink sm:text-[28px]">
            Your OTC Setup
          </h1>
          <p className="mt-1.5 text-sm text-ink-soft">
            {businessName} &middot; here&rsquo;s where things stand with your
            implementation.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2.5">
          {!isStaff && engagementType === "free" && (
            <Link
              href="/setup?plan=diy"
              className="rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-semibold text-ink"
            >
              Sign Up for DIY &rarr;
            </Link>
          )}
          {!isStaff && engagementType !== "custom" && (
            <Link
              href="/setup?plan=setup"
              className="rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-white"
            >
              Sign Up for Setup &rarr;
            </Link>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-6 px-4 pb-10 pt-6 sm:px-6 sm:pt-7 lg:flex-row lg:gap-8 lg:px-12 lg:pb-12">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-medium text-ink-soft">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 -translate-y-0.5 rounded border border-navy bg-danger/5" />
              Required
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 -translate-y-0.5 rounded border border-navy bg-warning-soft" />
              Optional
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 -translate-y-0.5 rounded border border-navy bg-success-soft" />
              Future build
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 -translate-y-0.5 rounded border border-navy bg-bg" />
              Complete
            </span>
          </div>

          {(() => {
            const all = visibleSteps;
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
              const requiredPhaseSteps = phaseSteps.filter(isRequiredStep);
              const completeCount = requiredPhaseSteps.filter(
                (s) => statusByStep.get(s.id) === "approved",
              ).length;
              const isComplete = completeCount === requiredPhaseSteps.length;

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
                      {completeCount} / {requiredPhaseSteps.length} complete
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
                      const sectionRequired =
                        sectionSteps.filter(isRequiredStep);
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
                            const isExternal = isExternalStepLink(step);
                            const isApproved = status === "approved";
                            const isClientManaged =
                              effectiveOwner(
                                step.completed_by,
                                plan,
                              ) === "client";

                            const titleBlock = (
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-bold text-ink">
                                  {step.title}
                                  {step.is_optional && (
                                    <span className="ml-2 rounded-full bg-border-soft px-2 py-0.5 text-[10px] font-bold uppercase font-caption tracking-wide text-ink-faint">
                                      Optional
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

                            if (isExternal) {
                              return (
                                <div
                                  key={step.id}
                                  className={`flex flex-col items-start gap-3 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:gap-4 ${stepRowClass(step, isApproved)}`}
                                >
                                  <a
                                    href={href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full min-w-0 sm:w-auto sm:flex-1"
                                  >
                                    {titleBlock}
                                  </a>
                                  <div className="flex w-full items-center justify-end gap-3 sm:w-auto">
                                    {isClientManaged ? (
                                      isStaff && !isSandboxing ? (
                                        <button
                                          type="button"
                                          disabled
                                          title="Actions are disabled while viewing/previewing"
                                          className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold opacity-50 ${
                                            isApproved
                                              ? "border border-border text-ink"
                                              : "bg-accent text-white"
                                          }`}
                                        >
                                          {isApproved ? "Undo" : "Mark Complete"}
                                        </button>
                                      ) : (
                                        <form action={toggleLessonComplete}>
                                          <input
                                            type="hidden"
                                            name="step_id"
                                            value={step.id}
                                          />
                                          <input
                                            type="hidden"
                                            name="currently_approved"
                                            value={String(isApproved)}
                                          />
                                          <button
                                            type="submit"
                                            className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold ${
                                              isApproved
                                                ? "border border-border text-ink"
                                                : "bg-accent text-white"
                                            }`}
                                          >
                                            {isApproved ? "Undo" : "Mark Complete"}
                                          </button>
                                        </form>
                                      )
                                    ) : (
                                      <span className="shrink-0 text-xs font-medium text-ink-faint">
                                        Handled by our team
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <Link
                                key={step.id}
                                href={href}
                                className={`flex flex-col items-start gap-3 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:gap-4 ${stepRowClass(step, isApproved)}`}
                              >
                                <div className="w-full min-w-0 sm:w-auto sm:flex-1">
                                  {titleBlock}
                                </div>
                                <div className="flex w-full items-center justify-end gap-3 sm:w-auto">
                                  <span className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white">
                                    {status === "not_started"
                                      ? "Start"
                                      : status === "approved"
                                        ? "Update"
                                        : "Continue"}
                                  </span>
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
          {engagementType !== "custom" ? (
            <>
              <div className="rounded-xl border border-border-soft bg-bg p-5">
                <h3 className="mb-1.5 text-sm font-bold text-ink">
                  Need Help?
                </h3>
                <p className="mb-3 text-sm leading-relaxed text-ink-soft">
                  Send Josie’s team a question any time &mdash; we
                  usually respond within a few hours.
                </p>
                <Link href="/support" className="text-sm font-semibold text-accent">
                  Ask a question &rarr;
                </Link>
              </div>

              <div className="rounded-xl border border-border bg-surface p-5">
                <h3 className="mb-3.5 text-[15px] font-bold text-ink">
                  Work Log
                </h3>
                <div className="flex flex-col gap-3.5">
                  {completedStepLog.length === 0 && (
                    <p className="text-sm text-ink-soft">
                      No steps completed yet &mdash; they&rsquo;ll show up
                      here as you work through your checklist.
                    </p>
                  )}
                  {completedStepLog.map((entry) => (
                    <div key={entry.id}>
                      <div className="mb-0.5 text-xs text-ink-soft">
                        {new Date(entry.completedAt).toLocaleDateString(
                          "en-US",
                          { month: "short", day: "numeric" },
                        )}
                      </div>
                      <div className="text-sm text-ink">{entry.title}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-xl border border-border bg-surface p-5">
                <h3 className="mb-3 text-[15px] font-bold text-ink">
                  Hours Used
                </h3>
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="font-display text-xl font-bold text-ink">
                    {hoursUsed.toFixed(1)}
                  </span>
                  <span className="text-sm text-ink-soft">
                    of {HOURS_PER_BUNDLE} hrs
                  </span>
                </div>
                <div className="mb-3.5 h-2 overflow-hidden rounded-full bg-border-soft">
                  <div
                    className="h-full bg-accent"
                    style={{
                      width: `${Math.min(
                        100,
                        (hoursUsed / HOURS_PER_BUNDLE) * 100,
                      )}%`,
                    }}
                  />
                </div>
                <button className="w-full rounded-lg border border-border px-2.5 py-2.5 text-sm font-semibold text-ink">
                  Request Additional Bundle
                </button>
              </div>

              <div className="rounded-xl border border-border bg-surface p-5">
                <h3 className="mb-3.5 text-[15px] font-bold text-ink">
                  Work Log
                </h3>
                <div className="flex flex-col gap-3.5">
                  {(hoursLog ?? []).length === 0 && (
                    <p className="text-sm text-ink-soft">
                      No work logged yet &mdash; entries will appear here
                      once your setup specialist starts on your account.
                    </p>
                  )}
                  {(hoursLog ?? []).map((entry) => (
                    <div key={entry.id}>
                      <div className="mb-0.5 flex justify-between text-xs text-ink-soft">
                        <span>
                          {new Date(entry.logged_date).toLocaleDateString(
                            "en-US",
                            { month: "short", day: "numeric" },
                          )}
                        </span>
                        <span>{Number(entry.hours).toFixed(1)} hrs</span>
                      </div>
                      <div className="text-sm text-ink">
                        {entry.description}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-border-soft bg-bg p-5">
                <h3 className="mb-1.5 text-sm font-bold text-ink">
                  Need Help?
                </h3>
                <p className="mb-3 text-sm leading-relaxed text-ink-soft">
                  Send Josie’s team a question any time &mdash; we
                  usually respond within a few hours.
                </p>
                <Link href="/support" className="text-sm font-semibold text-accent">
                  Ask a question &rarr;
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
