import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ClientStatusSelect } from "@/components/ClientStatusSelect";
import { approveSubmission, returnSubmission } from "../../actions";
import { logHours } from "./actions";

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

  const [{ data: statuses }, { data: submissions }, { data: hoursLog }] =
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
    ]);

  const statusByStepId = new Map((statuses ?? []).map((s) => [s.step_id, s.status]));
  const latestSubmissionByStep = new Map(
    (submissions ?? []).map((s) => [s.step_id, s]),
  );

  const hoursUsed = (hoursLog ?? []).reduce((sum, h) => sum + Number(h.hours), 0);

  return (
    <main className="px-12 py-9">
      <Link href="/dashboard#clients" className="text-sm font-medium text-accent">
        &larr; Back to clients
      </Link>

      <div className="mt-3 flex items-start justify-between">
        <div>
          <h1 className="font-display text-[25px] font-bold text-ink">
            {account.name}
          </h1>
          <p className="mt-1.5 text-sm capitalize text-ink-soft">
            {account.setup_path ?? "custom"} path
          </p>
        </div>
        <ClientStatusSelect accountId={account.id} status={account.status} />
      </div>

      <div className="mt-7 grid grid-cols-3 gap-4">
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
        <div className="mt-3 flex flex-col gap-2.5">
          {(steps ?? []).map((step) => {
            const status = statusByStepId.get(step.id) ?? "not_started";
            const submission = latestSubmissionByStep.get(step.id);

            return (
              <div
                key={step.id}
                className="rounded-xl border border-border bg-surface p-5"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-[15px] font-bold text-ink">
                      {step.title}
                    </div>
                    <div className="text-xs text-ink-faint">{step.section}</div>
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
                    {STEP_STATUS_LABEL[status].toUpperCase()}
                  </span>
                </div>

                {submission?.specialist_feedback && (
                  <p className="mt-2.5 rounded-lg bg-bg px-3 py-2 text-sm text-ink-soft">
                    &ldquo;{submission.specialist_feedback}&rdquo;
                  </p>
                )}

                {status === "submitted" && submission && owner && (
                  <>
                    <form action={approveSubmission} className="mt-3 inline-block">
                      <input type="hidden" name="submission_id" value={submission.id} />
                      <input type="hidden" name="client_id" value={owner.id} />
                      <input type="hidden" name="step_id" value={step.id} />
                      <button
                        type="submit"
                        className="rounded-lg bg-success px-4 py-2 text-sm font-semibold text-white"
                      >
                        Approve
                      </button>
                    </form>

                    <form
                      action={returnSubmission}
                      className="mt-3 flex items-end gap-3 border-t border-border-soft pt-3"
                    >
                      <input type="hidden" name="submission_id" value={submission.id} />
                      <input type="hidden" name="client_id" value={owner.id} />
                      <input type="hidden" name="step_id" value={step.id} />
                      <label className="flex flex-1 flex-col gap-1.5">
                        <span className="text-xs font-medium text-ink-soft">
                          Return with feedback
                        </span>
                        <textarea
                          name="feedback"
                          rows={2}
                          className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
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
      </section>

      <section className="mt-9">
        <h2 className="font-display text-lg font-bold text-ink">Work log</h2>

        <div className="mt-3 flex gap-8">
          <div className="min-w-0 flex-1 overflow-hidden rounded-xl border border-border bg-surface">
            <table className="w-full text-left text-sm">
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
            <div className="w-[300px] shrink-0 rounded-xl border border-border bg-surface p-5">
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
