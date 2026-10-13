import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/TopNav";
import { effectiveOwner, type EngagementType } from "@/lib/stepOwnership";
import { stepClientHref, isExternalStepLink } from "@/lib/stepHref";
import { requestUpgrade } from "./actions";
import { toggleLessonComplete } from "@/app/lesson/actions";

const STATUS_LABEL: Record<string, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  submitted: "Submitted",
  returned: "Needs Changes",
  approved: "Complete",
  locked: "Locked",
};

const HOURS_PER_BUNDLE = 10;

export default async function PortalPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, client_accounts(name, setup_path)")
    .eq("id", user.id)
    .single();

  if (profile && !profile.first_login_at) {
    await supabase
      .from("profiles")
      .update({ first_login_at: new Date().toISOString() })
      .eq("id", user.id);
  }

  const setupPath = profile?.client_accounts?.setup_path ?? "custom";

  const [{ data: allSteps }, { data: statuses }, { data: hoursLog }, { data: initiation }] =
    await Promise.all([
      supabase
        .from("setup_steps")
        .select("*")
        .eq("path", setupPath)
        .order("sort_order"),
      supabase
        .from("client_step_status")
        .select("*")
        .eq("client_id", user.id),
      supabase
        .from("hours_log")
        .select("*")
        .eq("client_id", user.id)
        .order("logged_date", { ascending: false })
        .limit(5),
      supabase
        .from("setup_initiation")
        .select("engagement_type, upgrade_requested_at")
        .eq("client_id", user.id)
        .maybeSingle(),
    ]);

  const engagementType = (initiation?.engagement_type ?? "custom") as EngagementType;

  // The task pipeline only shows what's actually assigned to this client —
  // purely-internal staff steps are tracked on our side and don't show up
  // here. A staff-owned step that's also a clickable link (e.g. a payment
  // link) still needs to be visible, since the client has to act on it even
  // though staff confirms completion.
  const myTasks = (allSteps ?? []).filter(
    (s) => effectiveOwner(s.completed_by, engagementType) === "client",
  );
  const visibleStaffSteps = (allSteps ?? []).filter(
    (s) =>
      effectiveOwner(s.completed_by, engagementType) === "staff" &&
      (s.step_type === "form" || s.step_type === "link") &&
      s.link_url,
  );
  const steps = [...myTasks, ...visibleStaffSteps].sort(
    (a, b) => a.sort_order - b.sort_order,
  );

  const statusByStep = new Map(
    (statuses ?? []).map((s) => [s.step_id, s.status]),
  );

  const hoursUsed = (hoursLog ?? []).reduce((sum, h) => sum + Number(h.hours), 0);
  const businessName =
    profile?.client_accounts?.name ?? user.email ?? "Your business";

  return (
    <main className="flex min-h-screen flex-col bg-bg">
      <TopNav businessName={businessName} active="setup" />

      <div className="flex flex-col items-start gap-3 px-4 pt-6 sm:px-6 sm:pt-9 lg:flex-row lg:items-start lg:justify-between lg:px-12">
        <div>
          <h1 className="font-display text-xl font-bold text-ink sm:text-[25px]">
            Your OTC Setup
          </h1>
          <p className="mt-1.5 text-sm text-ink-soft">
            {businessName} &middot; here&rsquo;s where things stand with your
            implementation.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3 rounded-full border border-accent-soft bg-accent-soft px-3.5 py-2">
          <span className="text-sm font-semibold text-accent">
            {hoursUsed.toFixed(1)} of {HOURS_PER_BUNDLE} hrs used
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-6 px-4 pb-10 pt-6 sm:px-6 sm:pt-7 lg:flex-row lg:gap-8 lg:px-12 lg:pb-12">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-ink-soft">
              {myTasks.length} steps assigned to you &middot;{" "}
              <Link href="/resources" className="font-semibold text-accent">
                View the full Resource Center &rarr;
              </Link>
            </p>
          </div>

          {(() => {
            const all = allSteps ?? [];
            const phaseList = Array.from(
              new Set(all.map((s) => s.phase ?? "General")),
            );
            const phaseComplete = phaseList.map((phase) => {
              const required = all.filter(
                (s) => (s.phase ?? "General") === phase && !s.is_optional,
              );
              return required.every(
                (s) => statusByStep.get(s.id) === "approved",
              );
            });
            const activeIndex = phaseComplete.findIndex((c) => !c);
            const currentPhaseIndex =
              activeIndex === -1 ? phaseList.length - 1 : activeIndex;

            return phaseList.map((phase, phaseIndex) => {
              const phaseSteps = all.filter(
                (s) => (s.phase ?? "General") === phase,
              );
              const visiblePhaseSteps = steps.filter(
                (s) => (s.phase ?? "General") === phase,
              );
              const sections = Array.from(
                new Set(phaseSteps.map((s) => s.section)),
              );
              const completeCount = phaseSteps.filter(
                (s) => statusByStep.get(s.id) === "approved",
              ).length;
              const isComplete = phaseComplete[phaseIndex];
              const isLocked = phaseIndex > currentPhaseIndex;

              if (isLocked) {
                const sections = Array.from(
                  new Set(phaseSteps.map((s) => s.section)),
                );

                return (
                  <details
                    key={phase}
                    className="rounded-xl border border-dashed border-border-soft bg-bg p-5 opacity-80"
                  >
                    <summary className="flex cursor-pointer items-center justify-between gap-4">
                      <div className="flex items-center gap-2.5">
                        <svg
                          width="15"
                          height="15"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="text-ink-faint"
                        >
                          <rect x="3" y="11" width="18" height="11" rx="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                        <h2 className="font-display text-base font-bold text-ink-faint">
                          {phase}
                        </h2>
                      </div>
                      <span className="text-xs font-medium text-ink-faint">
                        Unlocks after {phaseList[phaseIndex - 1]}
                      </span>
                    </summary>

                    <div className="mt-4 flex flex-col gap-4">
                      {sections.map((section) => (
                        <div key={section}>
                          <h3 className="text-xs font-bold uppercase tracking-wide text-ink-faint">
                            {section}
                          </h3>
                          <div className="mt-2 flex flex-col gap-2">
                            {phaseSteps
                              .filter((s) => s.section === section)
                              .map((s) => (
                                <div
                                  key={s.id}
                                  className="rounded-lg border border-border-soft bg-surface px-4 py-2.5 text-sm font-medium text-ink-faint"
                                >
                                  {s.title}
                                  {s.is_optional && (
                                    <span className="ml-2 rounded-full bg-border-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-faint">
                                      Optional
                                    </span>
                                  )}
                                </div>
                              ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                );
              }

              return (
                <details
                  key={phase}
                  open={!isComplete}
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
                      {completeCount} / {phaseSteps.length} complete
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
                      const sectionRequired = sectionSteps.filter(
                        (s) => !s.is_optional,
                      );
                      const sectionComplete = sectionRequired.every(
                        (s) => statusByStep.get(s.id) === "approved",
                      );
                      const sectionCompleteCount = sectionSteps.filter(
                        (s) => statusByStep.get(s.id) === "approved",
                      ).length;

                      return (
                    <details key={section} open={!sectionComplete}>
                      <summary className="flex cursor-pointer items-center justify-between gap-4">
                        <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-faint">
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
                          {sectionCompleteCount} / {sectionSteps.length}
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
                              effectiveOwner(step.completed_by, engagementType) ===
                              "client";

                            const titleBlock = (
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-bold text-ink">
                                  {step.title}
                                  {step.is_optional && (
                                    <span className="ml-2 rounded-full bg-border-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-faint">
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

                            const statusBadge = (
                              <span
                                className={`rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide ${
                                  status === "approved"
                                    ? "bg-success-soft text-success"
                                    : status === "returned"
                                      ? "bg-warning-soft text-warning"
                                      : status === "submitted" ||
                                          status === "in_progress"
                                        ? "bg-accent-soft text-accent"
                                        : "bg-border-soft text-ink-faint"
                                }`}
                              >
                                {STATUS_LABEL[status].toUpperCase()}
                              </span>
                            );

                            if (isExternal) {
                              return (
                                <div
                                  key={step.id}
                                  className="flex flex-col items-start gap-3 rounded-lg border border-border-soft bg-bg px-4 py-3 sm:flex-row sm:items-center sm:gap-4"
                                >
                                  <a
                                    href={href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full min-w-0 sm:w-auto sm:flex-1"
                                  >
                                    {titleBlock}
                                  </a>
                                  <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
                                    {statusBadge}
                                    {isClientManaged ? (
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
                                className="flex flex-col items-start gap-3 rounded-lg border border-border-soft bg-bg px-4 py-3 sm:flex-row sm:items-center sm:gap-4"
                              >
                                <div className="w-full min-w-0 sm:w-auto sm:flex-1">
                                  {titleBlock}
                                </div>
                                <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
                                  {statusBadge}
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
          <div className="rounded-xl border border-border bg-surface p-5">
            <h3 className="mb-3 text-[15px] font-bold text-ink">Hours Used</h3>
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

          {engagementType === "diy" && (
            <div className="rounded-xl border border-accent-soft bg-accent-soft/40 p-5">
              <h3 className="mb-1.5 text-[15px] font-bold text-ink">
                Want us to handle it?
              </h3>
              <p className="mb-3 text-sm text-ink-soft">
                Upgrade to Setup at any point &mdash; it&rsquo;s always a
                flat 10-hour bundle, no matter how far along you are.
              </p>
              {initiation?.upgrade_requested_at ? (
                <p className="text-sm font-semibold text-success">
                  Request sent &mdash; we&rsquo;ll be in touch.
                </p>
              ) : (
                <form action={requestUpgrade}>
                  <button
                    type="submit"
                    className="w-full rounded-lg bg-accent px-2.5 py-2.5 text-sm font-semibold text-white"
                  >
                    Request Setup Upgrade
                  </button>
                </form>
              )}
            </div>
          )}

          <div className="rounded-xl border border-border bg-surface p-5">
            <h3 className="mb-3.5 text-[15px] font-bold text-ink">Work Log</h3>
            <div className="flex flex-col gap-3.5">
              {(hoursLog ?? []).length === 0 && (
                <p className="text-sm text-ink-soft">
                  No work logged yet &mdash; entries will appear here once your
                  setup specialist starts on your account.
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
                  <div className="text-sm text-ink">{entry.description}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border-soft bg-bg p-5">
            <h3 className="mb-1.5 text-sm font-bold text-ink">Need Help?</h3>
            <p className="mb-3 text-sm leading-relaxed text-ink-soft">
              Reply to your setup email thread any time &mdash; we usually
              respond within a few hours.
            </p>
            <a href="#" className="text-sm font-semibold text-accent">
              Contact your setup team &rarr;
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
