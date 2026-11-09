import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/TopNav";
import { cookies } from "next/headers";
import {
  freeDaysLabel,
  freeMonthDay,
  freeMonthStatus,
  INVITE_COOKIE,
  inviteStatus,
} from "@/lib/coupons";
import { claimInvite } from "@/app/invite/actions";
import { startPlanCheckout } from "@/app/checkout/actions";
import { stepClientHref } from "@/lib/stepHref";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSandboxTier, SANDBOX_LABEL } from "@/lib/devSandbox";
import {
  effectiveOwner,
  type EngagementType,
  type PlanType,
} from "@/lib/stepOwnership";


export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ paid?: string; invite_error?: string }>;
}) {
  const { paid, invite_error: inviteError } = await searchParams;
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
        .select("*, client_accounts(name, setup_path, status, hours_purchased)")
        .eq("id", user.id)
        .single();

  // A coupon's free month (ending one that's run out, before the plan is
  // read below).
  const freeMonth = isSandboxing
    ? { activeUntil: null, endedOn: null }
    : await freeMonthStatus(profile?.client_account_id);
  const isOwner = profile?.role === "client_owner";
  // An invite link they opened but haven't claimed yet.
  const heldInvite =
    isSandboxing || freeMonth.activeUntil
      ? null
      : await inviteStatus((await cookies()).get(INVITE_COOKIE)?.value);

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
    // Hours the team has logged for anyone on the account (members only
    // see their own rows, so this reads with the service role).
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
  // Everything finished so far (theirs and our team's), by stage in the
  // checklist's order (the steps come sorted that way).
  const stageOrder = new Map<string, number>();
  for (const s of allSteps ?? []) {
    const stage = s.phase ?? "General";
    if (!stageOrder.has(stage)) stageOrder.set(stage, stageOrder.size);
  }
  const completed = (allSteps ?? [])
    .filter((s) => completedOn.has(s.id))
    .sort(
      (a, b) =>
        (stageOrder.get(a.phase ?? "General") ?? 0) - (stageOrder.get(b.phase ?? "General") ?? 0) ||
        a.sort_order - b.sort_order,
    );

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
  // Anyone who's bought setup hours (the Setup bundle, or hours on their
  // own) sees how many they've used.
  const hoursPurchased = Number(profile?.client_accounts?.hours_purchased ?? 0);
  const showHours = hoursPurchased > 0;
  const fmtHours = (n: number) => String(Number(n.toFixed(1)));

  const businessName = isSandboxing
    ? SANDBOX_LABEL[sandboxTier!]
    : (profile?.client_accounts?.name ?? user.email ?? "Your business");

  // Get Started turns to Continue once they've started (a step begun or the
  // setup form sent).
  const hasStarted =
    (statuses ?? []).some((s) => s.status !== "not_started") ||
    (!isSandboxing && Boolean(initiation));
  const setupButtonLabel = hasStarted ? "Continue" : "Get Started";


  return (
    <main className="flex min-h-screen flex-col bg-bg">
      <TopNav
        businessName={businessName}
        active="dashboard"
        sandboxTier={sandboxTier}
      />

      <div className="px-4 py-7 sm:px-6 sm:py-9 lg:px-12">
{freeMonth.endedOn && (
          <div className="mb-6 flex flex-col gap-2 rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning sm:flex-row sm:items-center sm:justify-between">
            <span className="font-semibold">
              Your free month ended {freeMonthDay(freeMonth.endedOn)}. Subscribe to keep your DIY
              access.
            </span>
            {isOwner ? (
              <form action={startPlanCheckout}>
              <input type="hidden" name="plan" value="diy" />
              <input type="hidden" name="return_to" value="/home" />
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
          <div className="mb-6 rounded-lg border border-accent-soft bg-accent-soft/40 px-4 py-2.5 text-sm text-accent">
            <span className="font-semibold">Free month</span> of DIY until{" "}
            {freeMonthDay(freeMonth.activeUntil)}.{" "}
            <Link href="/profile#billing" className="font-semibold underline">
              Subscribe
            </Link>{" "}
            any time to keep access after.
          </div>
        )}
        {inviteError && (
          <div className="mb-6 rounded-lg border border-danger/30 bg-danger/5 px-4 py-2.5 text-sm text-danger">
            {inviteError}
          </div>
        )}
        {heldInvite && (
          <div className="mb-6 flex flex-col gap-2 rounded-lg border border-success/30 bg-success-soft px-4 py-3 text-sm text-success sm:flex-row sm:items-center sm:justify-between">
            <span className="font-semibold">
              You have a free {freeDaysLabel(heldInvite.freeDays)} of DIY waiting.
            </span>
            <form action={claimInvite}>
              <button
                type="submit"
                className="rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                Start my free {freeDaysLabel(heldInvite.freeDays)}
              </button>
            </form>
          </div>
        )}
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
          {/* Get Started (or Continue once they've begun), for every plan. */}
          <Link
            href="/portal"
            className="self-start rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white"
          >
            {setupButtonLabel} &rarr;
          </Link>
        </div>

        <div
          className={`mt-7 grid grid-cols-1 gap-4 ${
            showHours ? "sm:grid-cols-3" : "sm:grid-cols-2"
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

          {showHours && (
            <Link
              href="/profile#hours"
              className="rounded-xl border border-border bg-surface p-5 hover:border-accent"
            >
              <div className="text-sm text-ink-soft">Setup hours used</div>
              <div
                className={`mt-1 font-display text-xl font-bold ${
                  hoursUsed > hoursPurchased ? "text-danger" : "text-ink"
                }`}
              >
                {fmtHours(hoursUsed)} / {fmtHours(hoursPurchased)} hours
              </div>
              <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-border-soft">
                <div
                  className={`h-full ${hoursUsed >= hoursPurchased ? "bg-danger" : "bg-accent"}`}
                  style={{ width: `${Math.min(100, (hoursUsed / hoursPurchased) * 100)}%` }}
                />
              </div>
              <div
                className={`mt-2 text-xs ${hoursUsed >= hoursPurchased ? "font-semibold text-danger" : "text-ink-faint"}`}
              >
                {hoursUsed >= hoursPurchased
                  ? "No hours left"
                  : `${fmtHours(hoursPurchased - hoursUsed)} hour${hoursPurchased - hoursUsed === 1 ? "" : "s"} left`}
              </div>
            </Link>
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
                    <th className="px-5 py-2 font-semibold">Stage</th>
                    <th className="px-3 py-2 font-semibold">Task</th>
                    <th className="px-3 py-2 font-semibold">Done by</th>
                    <th className="px-5 py-2 text-right font-semibold">Completed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {completed.map((s) => (
                    <tr key={s.id}>
                      <td className="px-5 py-2.5 text-ink-soft">{s.phase ?? "General"}</td>
                      <td className="px-3 py-2.5">
                        <Link href={stepClientHref(s)} className="font-medium text-ink hover:text-accent">
                          {s.title}
                        </Link>
                      </td>
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
      </div>
    </main>
  );
}
