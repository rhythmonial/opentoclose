import { createClient } from "@/lib/supabase/server";
import { approveSubmission, returnSubmission } from "./actions";

export default async function TasksPage() {
  const supabase = await createClient();

  const [{ data: submissions }, { data: steps }, { data: profiles }, { data: accounts }] =
    await Promise.all([
      supabase
        .from("submissions")
        .select("*")
        .eq("status", "submitted")
        .order("submitted_at", { ascending: true }),
      supabase.from("setup_steps").select("id, title"),
      supabase.from("profiles").select("id, email, client_account_id"),
      supabase.from("client_accounts").select("id, name"),
    ]);

  const stepTitleById = new Map((steps ?? []).map((s) => [s.id, s.title]));
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const accountNameById = new Map((accounts ?? []).map((a) => [a.id, a.name]));

  const rows = (submissions ?? []).map((sub) => {
    const profile = profileById.get(sub.client_id);
    const accountName = profile?.client_account_id
      ? (accountNameById.get(profile.client_account_id) ?? "—")
      : "—";

    return {
      id: sub.id,
      clientId: sub.client_id,
      stepId: sub.step_id,
      stepTitle: stepTitleById.get(sub.step_id) ?? "Unknown step",
      clientEmail: profile?.email ?? "—",
      accountName,
      submittedAt: sub.submitted_at,
    };
  });

  return (
    <main className="px-12 py-9">
      <h1 className="font-display text-[25px] font-bold text-ink">
        Review queue
      </h1>
      <p className="mt-1.5 text-sm text-ink-soft">
        Prep sheets and submissions waiting on a decision.
      </p>

      <div className="mt-7 flex flex-col gap-3">
        {rows.map((row) => (
          <div
            key={row.id}
            className="rounded-xl border border-border bg-surface p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[15px] font-bold text-ink">
                  {row.stepTitle}
                </div>
                <div className="text-sm text-ink-soft">
                  {row.accountName} &middot; {row.clientEmail}
                </div>
                <div className="mt-1 text-xs text-ink-faint">
                  Submitted{" "}
                  {new Date(row.submittedAt).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </div>
              </div>

              <form action={approveSubmission}>
                <input type="hidden" name="submission_id" value={row.id} />
                <input type="hidden" name="client_id" value={row.clientId} />
                <input type="hidden" name="step_id" value={row.stepId} />
                <button
                  type="submit"
                  className="shrink-0 rounded-lg bg-success px-4 py-2 text-sm font-semibold text-white"
                >
                  Approve
                </button>
              </form>
            </div>

            <form
              action={returnSubmission}
              className="mt-4 flex items-end gap-3 border-t border-border-soft pt-4"
            >
              <input type="hidden" name="submission_id" value={row.id} />
              <input type="hidden" name="client_id" value={row.clientId} />
              <input type="hidden" name="step_id" value={row.stepId} />
              <label className="flex flex-1 flex-col gap-1.5">
                <span className="text-xs font-medium text-ink-soft">
                  Return with feedback
                </span>
                <textarea
                  name="feedback"
                  rows={2}
                  placeholder="What needs to change before this can be approved?"
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
          </div>
        ))}

        {rows.length === 0 && (
          <p className="rounded-xl border border-border bg-surface p-5 text-sm text-ink-soft">
            Nothing waiting on review.
          </p>
        )}
      </div>
    </main>
  );
}
