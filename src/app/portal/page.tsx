import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/TopNav";

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

  const [{ data: steps }, { data: statuses }, { data: hoursLog }] =
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
    ]);

  const statusByStep = new Map(
    (statuses ?? []).map((s) => [s.step_id, s.status]),
  );

  const hoursUsed = (hoursLog ?? []).reduce((sum, h) => sum + Number(h.hours), 0);
  const businessName =
    profile?.client_accounts?.name ?? user.email ?? "Your business";
  const initials = businessName
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <main className="flex min-h-screen flex-col bg-bg">
      <TopNav businessName={businessName} initials={initials} active="setup" />

      <div className="flex items-start justify-between px-12 pt-9">
        <div>
          <h1 className="font-display text-[25px] font-bold text-ink">
            Your OTC Setup
          </h1>
          <p className="mt-1.5 text-sm text-ink-soft">
            {businessName} &middot; here&rsquo;s where things stand with your
            implementation.
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-full border border-accent-soft bg-accent-soft px-3.5 py-2">
          <span className="text-sm font-semibold text-accent">
            {hoursUsed.toFixed(1)} of {HOURS_PER_BUNDLE} hrs used
          </span>
        </div>
      </div>

      <div className="flex gap-8 px-12 pb-12 pt-7">
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          {(steps ?? []).map((step) => {
            const status = statusByStep.get(step.id) ?? "not_started";
            const href =
              step.key === "setup_initiation"
                ? "/setup"
                : step.step_type === "configurator"
                  ? `/configurator/${step.key}`
                  : undefined;
            const isClickable = Boolean(href);

            const Wrapper = href ? Link : "div";

            return (
              <Wrapper
                key={step.id}
                href={href as never}
                className="flex items-center gap-4 rounded-xl border border-border bg-surface px-5 py-[18px]"
              >
                <div className="flex-1">
                  <div className="text-[15px] font-bold text-ink">
                    {step.title}
                  </div>
                  <div className="text-sm text-ink-soft">
                    {step.description}
                  </div>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide ${
                    status === "approved"
                      ? "bg-success-soft text-success"
                      : status === "returned"
                        ? "bg-warning-soft text-warning"
                        : status === "submitted" || status === "in_progress"
                          ? "bg-accent-soft text-accent"
                          : "bg-border-soft text-ink-faint"
                  }`}
                >
                  {STATUS_LABEL[status].toUpperCase()}
                </span>
                {isClickable && (
                  <span className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white">
                    {status === "not_started"
                      ? "Start"
                      : status === "approved"
                        ? "Update"
                        : "Continue"}
                  </span>
                )}
              </Wrapper>
            );
          })}

          {(steps ?? []).length === 0 && (
            <p className="text-sm text-ink-soft">
              No setup steps configured yet for this path.
            </p>
          )}
        </div>

        <div className="flex w-[340px] shrink-0 flex-col gap-5">
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
