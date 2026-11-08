import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/TopNav";
import { stepClientHref } from "@/lib/stepHref";
import { getSandboxTier, SANDBOX_LABEL } from "@/lib/devSandbox";
import {
  effectiveOwner,
  type EngagementType,
  type PlanType,
} from "@/lib/stepOwnership";

const ENGAGEMENT_LABEL: Record<string, string> = {
  free: "Free",
  custom: "Setup ($999 + $33/mo)",
  diy: "DIY ($33/mo)",
};

const HOURS_PER_BUNDLE = 10;

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ paid?: string }>;
}) {
  const { paid } = await searchParams;
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

  if (isStaff && !isSandboxing) {
    redirect("/dashboard");
  }

  const { data: profile } = isSandboxing
    ? { data: null }
    : await supabase
        .from("profiles")
        .select("*, client_accounts(name, setup_path, status)")
        .eq("id", user.id)
        .single();

  const setupPath = profile?.client_accounts?.setup_path ?? "custom";

  const [
    { data: allSteps },
    { data: statuses },
    { data: initiation },
    { data: hoursLog },
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
      ? Promise.resolve({ data: { engagement_type: sandboxTier! } })
      : supabase
          .from("setup_initiation")
          .select("engagement_type")
          .eq("client_id", user.id)
          .maybeSingle(),
    isSandboxing
      ? Promise.resolve({ data: [] as { hours: number }[] })
      : supabase.from("hours_log").select("hours").eq("client_id", user.id),
  ]);

  const engagementType = (initiation?.engagement_type ?? "free") as EngagementType;
  // Free accounts follow the DIY checklist.
  const plan: PlanType = engagementType === "custom" ? "custom" : "diy";

  const statusByStep = new Map(
    (statuses ?? []).map((s) => [s.step_id, s.status]),
  );
  const completedOn = new Map(
    (statuses ?? [])
      .filter((s) => s.status === "approved")
      .map((s) => [s.step_id, s.updated_at]),
  );
  // Everything finished so far (theirs and our team's), latest first.
  const completed = (allSteps ?? [])
    .filter((s) => completedOn.has(s.id))
    .sort((a, b) => (completedOn.get(b.id) ?? "").localeCompare(completedOn.get(a.id) ?? ""));

  // The client's own tasks; the ones our team handles aren't theirs to do.
  const requiredTasks = (allSteps ?? []).filter(
    (s) => effectiveOwner(s.completed_by, plan) === "client",
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

  const businessName = isSandboxing
    ? SANDBOX_LABEL[sandboxTier!]
    : (profile?.client_accounts?.name ?? user.email ?? "Your business");

  const setupButtonLabel =
    engagementType === "custom"
      ? "Go to Setup"
      : engagementType === "diy"
        ? "Go to DIY"
        : "Get Started";


  return (
    <main className="flex min-h-screen flex-col bg-bg">
      <TopNav
        businessName={businessName}
        active="dashboard"
        sandboxTier={sandboxTier}
      />

      <div className="px-4 py-7 sm:px-6 sm:py-9 lg:px-12">
        {paid && (
          <div className="mb-6 rounded-lg border border-success/30 bg-success-soft px-4 py-2.5 text-sm font-semibold text-success">
            Payment received, welcome to {paid === "diy" ? "DIY" : "Setup"}!
            Your plan updates within a minute; refresh if it hasn&rsquo;t
            yet.
          </div>
        )}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-ink sm:text-[28px]">
              Welcome {businessName}
            </h1>
            <p className="mt-1.5 text-sm text-ink-soft">
              Here&rsquo;s where things stand.
            </p>
          </div>
          {/* A new (free) account gets Get Started here; a paid one shows
              its plan. */}
          {engagementType === "free" ? (
            <Link
              href="/portal"
              className="self-start rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white"
            >
              {setupButtonLabel} &rarr;
            </Link>
          ) : (
            <span
              className={`self-start rounded-full px-2.5 py-1 text-[11px] font-bold uppercase font-caption tracking-wide ${
                engagementType === "diy"
                  ? "bg-warning-soft text-warning"
                  : "bg-accent-soft text-accent"
              }`}
            >
              {ENGAGEMENT_LABEL[engagementType]}
            </span>
          )}
        </div>

        <div
          className={`mt-7 grid grid-cols-1 gap-4 ${
            engagementType === "custom" ? "sm:grid-cols-3" : "sm:grid-cols-2"
          }`}
        >
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

          {engagementType === "custom" && (
            <div className="rounded-xl border border-border bg-surface p-5">
              <div className="text-sm text-ink-soft">Hours used</div>
              <div className="mt-1 font-display text-xl font-bold text-ink">
                {hoursUsed.toFixed(1)} / {HOURS_PER_BUNDLE}
              </div>
            </div>
          )}
        </div>

        <section className="mt-7 rounded-xl border border-border bg-surface">
          <div className="flex items-baseline justify-between gap-3 border-b border-border px-5 py-3.5">
            <h2 className="text-[15px] font-bold text-ink">Completed</h2>
            <span className="text-xs text-ink-faint">
              {completed.length} task{completed.length === 1 ? "" : "s"}
            </span>
          </div>
          {completed.length === 0 ? (
            <p className="px-5 py-4 text-sm text-ink-soft">
              Nothing completed yet. Tasks show up here as they&rsquo;re finished.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] text-left text-sm">
                <thead className="bg-bg text-xs text-ink-soft">
                  <tr>
                    <th className="px-5 py-2 font-semibold">Task</th>
                    <th className="px-3 py-2 font-semibold">Stage</th>
                    <th className="px-3 py-2 font-semibold">Done by</th>
                    <th className="px-5 py-2 text-right font-semibold">Completed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {completed.map((s) => (
                    <tr key={s.id}>
                      <td className="px-5 py-2.5">
                        <Link href={stepClientHref(s)} className="font-medium text-ink hover:text-accent">
                          {s.title}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-ink-soft">{s.phase ?? "General"}</td>
                      <td className="px-3 py-2.5 text-ink-soft">
                        {effectiveOwner(s.completed_by, plan) === "client" ? "You" : "Our team"}
                      </td>
                      <td className="whitespace-nowrap px-5 py-2.5 text-right text-ink-soft">
                        {new Date(completedOn.get(s.id)!).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {engagementType !== "free" && (
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              href="/portal"
              className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white"
            >
              {setupButtonLabel} &rarr;
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
