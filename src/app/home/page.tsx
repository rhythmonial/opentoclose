import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/TopNav";
import { getImpersonatedClientId } from "@/lib/impersonation";
import {
  effectiveOwner,
  isClientVisible,
  type EngagementType,
  type PlanType,
} from "@/lib/stepOwnership";

const ENGAGEMENT_LABEL: Record<string, string> = {
  free: "Free",
  custom: "Setup ($999)",
  diy: "DIY ($19)",
};

const HOURS_PER_BUNDLE = 10;

export default async function HomePage() {
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
  const impersonatedId = isStaff ? await getImpersonatedClientId() : null;
  const isImpersonating = Boolean(impersonatedId);
  const effectiveUserId = impersonatedId ?? user.id;

  if (isStaff && !isImpersonating) {
    redirect("/dashboard");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, client_accounts(name, setup_path, status)")
    .eq("id", effectiveUserId)
    .single();

  const setupPath = profile?.client_accounts?.setup_path ?? "custom";

  const [
    { data: allSteps },
    { data: statuses },
    { data: initiation },
    { data: hoursLog },
    { data: teammates },
  ] = await Promise.all([
    supabase
      .from("setup_steps")
      .select("*")
      .eq("path", setupPath)
      .order("sort_order"),
    supabase
      .from("client_step_status")
      .select("*")
      .eq("client_id", effectiveUserId),
    supabase
      .from("setup_initiation")
      .select("engagement_type")
      .eq("client_id", effectiveUserId)
      .maybeSingle(),
    supabase
      .from("hours_log")
      .select("hours")
      .eq("client_id", effectiveUserId),
    profile?.client_account_id
      ? supabase
          .from("profiles")
          .select("id")
          .eq("client_account_id", profile.client_account_id)
      : Promise.resolve({ data: [] }),
  ]);

  const engagementType = (initiation?.engagement_type ?? "free") as EngagementType;
  // Free accounts haven't paid for staff to handle anything yet, so their
  // own required-task count is computed the same way DIY's is.
  const plan: PlanType = engagementType === "custom" ? "custom" : "diy";

  const statusByStep = new Map(
    (statuses ?? []).map((s) => [s.step_id, s.status]),
  );

  const requiredTasks = (allSteps ?? []).filter(
    (s) =>
      isClientVisible(s.completed_by, plan) &&
      effectiveOwner(s.completed_by, plan) === "client" &&
      !s.is_optional &&
      !s.is_future_build,
  );
  const completedCount = requiredTasks.filter(
    (s) => statusByStep.get(s.id) === "approved",
  ).length;
  const totalCount = requiredTasks.length;
  const percentComplete =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const sortedRequired = requiredTasks
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order);
  const nextTask = sortedRequired.find(
    (s) => statusByStep.get(s.id) !== "approved",
  );
  const currentStage = nextTask
    ? (nextTask.phase ?? "General")
    : totalCount > 0
      ? "Complete"
      : "—";

  const hoursUsed = (hoursLog ?? []).reduce(
    (sum, h) => sum + Number(h.hours),
    0,
  );

  const businessName =
    profile?.client_accounts?.name ?? user.email ?? "Your business";

  const setupButtonLabel =
    engagementType === "custom"
      ? "Go to Setup"
      : engagementType === "diy"
        ? "Go to DIY"
        : "Get Started";

  const upgradeTargets: { label: string; plan: string }[] =
    engagementType === "custom"
      ? []
      : engagementType === "diy"
        ? [{ label: "Upgrade to Setup", plan: "setup" }]
        : [
            { label: "Upgrade to DIY", plan: "diy" },
            { label: "Upgrade to Setup", plan: "setup" },
          ];

  return (
    <main className="flex min-h-screen flex-col bg-bg">
      <TopNav
        businessName={businessName}
        active="dashboard"
        isImpersonating={isImpersonating}
      />

      {isImpersonating && (
        <div className="mx-4 mt-4 rounded-lg border border-danger/30 bg-danger/5 px-4 py-2.5 text-sm font-semibold text-danger sm:mx-6 lg:mx-12">
          Viewing as {businessName} &mdash; this is their real data. Click the
          eye icon next to your profile to return to the dev dashboard.
        </div>
      )}

      <div className="px-4 py-7 sm:px-6 sm:py-9 lg:px-12">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-display text-xl font-bold text-ink sm:text-[25px]">
              Welcome back
            </h1>
            <p className="mt-1.5 text-sm text-ink-soft">
              {businessName} &middot; here&rsquo;s where things stand.
            </p>
          </div>
          <span
            className={`self-start rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
              engagementType === "diy"
                ? "bg-warning-soft text-warning"
                : engagementType === "free"
                  ? "bg-border-soft text-ink-faint"
                  : "bg-accent-soft text-accent"
            }`}
          >
            {ENGAGEMENT_LABEL[engagementType]}
          </span>
        </div>

        <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-surface p-5">
            <div className="text-sm text-ink-soft">Overall progress</div>
            <div className="mt-1 font-display text-xl font-bold text-ink">
              {percentComplete}%
            </div>
            <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-border-soft">
              <div
                className="h-full bg-accent"
                style={{ width: `${percentComplete}%` }}
              />
            </div>
            <div className="mt-2 text-xs text-ink-faint">
              {completedCount} of {totalCount} required tasks
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface p-5">
            <div className="text-sm text-ink-soft">Current stage</div>
            <div className="mt-1 font-display text-xl font-bold text-ink">
              {currentStage}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface p-5">
            <div className="text-sm text-ink-soft">
              {engagementType === "custom" ? "Hours used" : "Team size"}
            </div>
            <div className="mt-1 font-display text-xl font-bold text-ink">
              {engagementType === "custom"
                ? `${hoursUsed.toFixed(1)} / ${HOURS_PER_BUNDLE}`
                : (teammates ?? []).length}
            </div>
          </div>
        </div>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Link
            href="/portal"
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white"
          >
            {setupButtonLabel} &rarr;
          </Link>
          {upgradeTargets.map((t) => (
            <Link
              key={t.plan}
              href={`/setup?plan=${t.plan}`}
              className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-ink"
            >
              {t.label}
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
