import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ClientStatusSelect } from "@/components/ClientStatusSelect";
import { StepOwnerIcon } from "@/components/StepOwnerIcon";
import { effectiveOwner, type EngagementType } from "@/lib/stepOwnership";
import {
  approveSubmission,
  returnSubmission,
  markStaffStepComplete,
  markUpgraded,
} from "../../actions";
import { logHours } from "./actions";

const ENGAGEMENT_LABEL: Record<string, string> = {
  custom: "Setup ($999)",
  diy: "DIY ($19)",
};

const STEP_STATUS_LABEL: Record<string, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  submitted: "Submitted",
  returned: "Needs Changes",
  approved: "Complete",
  locked: "Locked",
};

const ROLE_LABEL: Record<string, string> = {
  client_owner: "Owner",
  client_admin: "Admin",
};

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: account } = await supabase
    .from("client_accounts")
    .select("*")
    .eq("id", id)
    .single();

  if (!account) {
    notFound();
  }

  const [{ data: members }, { data: steps }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, role, email, first_login_at")
      .eq("client_account_id", id)
      .order("created_at"),
    supabase
      .from("setup_steps")
      .select("*")
      .eq("path", account.setup_path ?? "custom")
      .order("sort_order"),
  ]);

  const owner = (members ?? []).find((m) => m.role === "client_owner") ?? members?.[0];
  const memberIds = (members ?? []).map((m) => m.id);

  const [{ data: statuses }, { data: submissions }, { data: hoursLog }, { data: initiation }] =
    await Promise.all([
      owner
        ? supabase
            .from("client_step_status")
            .select("step_id, status, updated_at")
            .eq("client_id", owner.id)
        : Promise.resolve({ data: [] }),
      owner
        ? supabase
            .from("submissions")
            .select("*")
            .eq("client_id", owner.id)
            .order("submitted_at", { ascending: false })
        : Promise.resolve({ data: [] }),
      memberIds.length > 0
        ? supabase
            .from("hours_log")
            .select("*")
            .in("client_id", memberIds)
            .order("logged_date", { ascending: false })
        : Promise.resolve({ data: [] }),
      owner
        ? supabase
            .from("setup_initiation")
            .select("engagement_type, upgrade_requested_at")
            .eq("client_id", owner.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const statusByStepId = new Map((statuses ?? []).map((s) => [s.step_id, s.status]));
  const latestSubmissionByStep = new Map(
    (submissions ?? []).map((s) => [s.step_id, s]),
  );

  const hoursUsed = (hoursLog ?? []).reduce((sum, h) => sum + Number(h.hours), 0);
  const engagementType = (initiation?.engagement_type ?? "custom") as EngagementType;

  return (
    <main className="px-4 py-7 sm:px-6 sm:py-9 lg:px-12">
      <Link href="/dashboard#clients" className="text-sm font-medium text-accent">
        &larr; Back to clients
      </Link>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-ink sm:text-[25px]">
            {account.name}
          </h1>
          <p className="mt-1.5 flex items-center gap-2 text-sm text-ink-soft">
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                engagementType === "diy"
                  ? "bg-warning-soft text-warning"
                  : "bg-accent-soft text-accent"
              }`}
            >
              {ENGAGEMENT_LABEL[engagementType]}
            </span>
          </p>
        </div>
        <ClientStatusSelect accountId={account.id} status={account.status} />
      </div>

      {initiation?.upgrade_requested_at && owner && (
        <div className="mt-5 flex flex-col items-start gap-3 rounded-xl border border-accent-soft bg-accent-soft/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div>
            <div className="text-sm font-bold text-ink">
              Wants to upgrade to Setup
            </div>
            <div className="text-xs text-ink-soft">
              Requested{" "}
              {new Date(initiation.upgrade_requested_at).toLocaleDateString(
                "en-US",
                { month: "short", day: "numeric", year: "numeric" },
              )}
            </div>
          </div>
          <form action={markUpgraded}>
            <input type="hidden" name="client_id" value={owner.id} />
            <button
              type="submit"
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white"
            >
              Mark as Upgraded
            </button>
          </form>
        </div>
      )}

      <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="text-sm text-ink-soft">Hours</div>
          <div className="mt-1 font-display text-xl font-bold text-ink">
            {hoursUsed.toFixed(1)} / {Number(account.hours_purchased).toFixed(1)}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="text-sm text-ink-soft">Team size</div>
          <div className="mt-1 font-display text-xl font-bold text-ink">
            {members?.length ?? 0}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="text-sm text-ink-soft">Steps complete</div>
          <div className="mt-1 font-display text-xl font-bold text-ink">
            {(steps ?? []).filter((s) => statusByStepId.get(s.id) === "approved").length}
            {" / "}
            {(steps ?? []).length}
          </div>
        </div>
      </div>

      <section className="mt-9">
        <h2 className="font-display text-lg font-bold text-ink">Team</h2>
        <div className="mt-3 flex flex-col gap-2.5">
          {(members ?? []).map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-4 rounded-xl border border-border bg-surface px-5 py-[14px]"
            >
              <div className="flex-1">
                <div className="text-[15px] font-bold text-ink">
                  {member.email ?? "Pending"}
                </div>
                <div className="text-sm text-ink-soft">
                  {ROLE_LABEL[member.role] ?? member.role}
                </div>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide ${
                  member.first_login_at
                    ? "bg-success-soft text-success"
                    : "bg-accent-soft text-accent"
                }`}
              >
                {(member.first_login_at ? "active" : "invited").toUpperCase()}
              </span>
            </div>
          ))}
          {(members ?? []).length === 0 && (
            <p className="text-sm text-ink-soft">No team members yet.</p>
          )}
        </div>
      </section>

      <section className="mt-9">
        <h2 className="font-display text-lg font-bold text-ink">
          Setup Steps
        </h2>
        <div className="mt-3 flex flex-col gap-3">
          {Array.from(new Set((steps ?? []).map((s) => s.phase ?? "General"))).map(
            (phase) => {
              const phaseSteps = (steps ?? []).filter(
                (s) => (s.phase ?? "General") === phase,
              );
              const sections = Array.from(
                new Set(phaseSteps.map((s) => s.section)),
              );
              const completeCount = phaseSteps.filter(
                (s) => statusByStepId.get(s.id) === "approved",
              ).length;

              return (
                <details
                  key={phase}
                  className="rounded-xl border border-border bg-surface p-5"
                >
                  <summary className="flex cursor-pointer items-center justify-between gap-4">
                    <h3 className="font-display text-base font-bold text-ink">
                      {phase}
                    </h3>
                    <span className="text-xs font-semibold text-ink-faint">
                      {completeCount} / {phaseSteps.length} complete
                    </span>
                  </summary>

                  <div className="mt-4 flex flex-col gap-4">
                    {sections.map((section) => (
                      <div key={section}>
                        <h4 className="text-xs font-bold uppercase tracking-wide text-ink-faint">
                          {section}
                        </h4>
                        <div className="mt-2 flex flex-col gap-2.5">
                          {phaseSteps
                            .filter((s) => s.section === section)
                            .map((step) => {
                              const status =
                                statusByStepId.get(step.id) ?? "not_started";
                              const submission = latestSubmissionByStep.get(
                                step.id,
                              );

                              return (
                                <div
                                  key={step.id}
                                  className="rounded-lg border border-border-soft bg-bg p-4"
                                >
                                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                                    <div className="flex items-center gap-2.5">
                                      <StepOwnerIcon
                                        completedBy={step.completed_by}
                                      />
                                      <div>
                                        <div className="text-sm font-bold text-ink">
                                          {step.title}
                                          {step.is_optional && (
                                            <span className="ml-2 rounded-full bg-border-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-faint">
                                              Optional
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    <span
                                      className={`self-start rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide sm:self-auto ${
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
                                      {STEP_STATUS_LABEL[status].toUpperCase()}
                                    </span>
                                  </div>

                                  {submission?.specialist_feedback && (
                                    <p className="mt-2.5 rounded-lg bg-surface px-3 py-2 text-sm text-ink-soft">
                                      &ldquo;{submission.specialist_feedback}
                                      &rdquo;
                                    </p>
                                  )}

                                  {effectiveOwner(step.completed_by, engagementType) ===
                                    "staff" &&
                                    status !== "approved" &&
                                    owner && (
                                      <form
                                        action={markStaffStepComplete}
                                        className="mt-3"
                                      >
                                        <input
                                          type="hidden"
                                          name="client_id"
                                          value={owner.id}
                                        />
                                        <input
                                          type="hidden"
                                          name="step_id"
                                          value={step.id}
                                        />
                                        <button
                                          type="submit"
                                          className="rounded-lg bg-success px-4 py-2 text-sm font-semibold text-white"
                                        >
                                          Mark Complete
                                        </button>
                                      </form>
                                    )}

                                  {status === "submitted" &&
                                    submission &&
                                    owner && (
                                      <>
                                        <form
                                          action={approveSubmission}
                                          className="mt-3 inline-block"
                                        >
                                          <input
                                            type="hidden"
                                            name="submission_id"
                                            value={submission.id}
                                          />
                                          <input
                                            type="hidden"
                                            name="client_id"
                                            value={owner.id}
                                          />
                                          <input
                                            type="hidden"
                                            name="step_id"
                                            value={step.id}
                                          />
                                          <button
                                            type="submit"
                                            className="rounded-lg bg-success px-4 py-2 text-sm font-semibold text-white"
                                          >
                                            Approve
                                          </button>
                                        </form>

                                        <form
                                          action={returnSubmission}
                                          className="mt-3 flex flex-col items-stretch gap-3 border-t border-border-soft pt-3 sm:flex-row sm:items-end"
                                        >
                                          <input
                                            type="hidden"
                                            name="submission_id"
                                            value={submission.id}
                                          />
                                          <input
                                            type="hidden"
                                            name="client_id"
                                            value={owner.id}
                                          />
                                          <input
                                            type="hidden"
                                            name="step_id"
                                            value={step.id}
                                          />
                                          <label className="flex flex-1 flex-col gap-1.5">
                                            <span className="text-xs font-medium text-ink-soft">
                                              Return with feedback
                                            </span>
                                            <textarea
                                              name="feedback"
                                              rows={2}
                                              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                                            />
                                          </label>
                                          <button
                                            type="submit"
                                            className="shrink-0 rounded-lg border border-warning/40 bg-warning-soft px-4 py-2 text-sm font-semibold text-warning"
                                          >
                                            Return
                                          </button>
                                        </form>
                                      </>
                                    )}
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              );
            },
          )}
        </div>
      </section>

      <section className="mt-9">
        <h2 className="font-display text-lg font-bold text-ink">Work log</h2>

        <div className="mt-3 flex flex-col gap-6 lg:flex-row lg:gap-8">
          <div className="min-w-0 flex-1 overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-border-soft bg-bg text-xs font-bold uppercase tracking-wide text-ink-faint">
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Hours</th>
                  <th className="px-5 py-3">Description</th>
                </tr>
              </thead>
              <tbody>
                {(hoursLog ?? []).map((entry) => (
                  <tr key={entry.id} className="border-b border-border-soft last:border-0">
                    <td className="px-5 py-3 text-ink-soft">
                      {new Date(entry.logged_date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-5 py-3 text-ink-soft">
                      {Number(entry.hours).toFixed(1)}
                    </td>
                    <td className="px-5 py-3 text-ink">{entry.description}</td>
                  </tr>
                ))}
                {(hoursLog ?? []).length === 0 && (
                  <tr>
                    <td className="px-5 py-6 text-sm text-ink-soft" colSpan={3}>
                      No hours logged yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {owner && (
            <div className="w-full shrink-0 rounded-xl border border-border bg-surface p-5 lg:w-[300px]">
              <h3 className="text-[15px] font-bold text-ink">Log hours</h3>
              <form action={logHours} className="mt-3 flex flex-col gap-3">
                <input type="hidden" name="account_id" value={account.id} />
                <input type="hidden" name="client_id" value={owner.id} />
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-ink-soft">Date</span>
                  <input
                    type="date"
                    name="logged_date"
                    defaultValue={new Date().toISOString().slice(0, 10)}
                    className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-ink-soft">Hours</span>
                  <input
                    type="number"
                    step="0.25"
                    name="hours"
                    required
                    className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-ink-soft">
                    Description
                  </span>
                  <textarea
                    name="description"
                    rows={2}
                    required
                    className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                  />
                </label>
                <button
                  type="submit"
                  className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white"
                >
                  Log hours
                </button>
              </form>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
