import { createClient } from "@/lib/supabase/server";
import { approveSubmission, returnSubmission } from "./actions";

export default async function DashboardHome() {
  const supabase = await createClient();

  const [
    { data: accounts },
    { data: profiles },
    { data: steps },
    { data: hoursLog },
    { count: activeLeadCount },
    { data: submissions },
  ] = await Promise.all([
    supabase
      .from("client_accounts")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, role, email, client_account_id")
      .in("role", ["client_owner", "client_admin"]),
    supabase
      .from("setup_steps")
      .select("id, path, title, phase, section, sort_order"),
    supabase.from("hours_log").select("client_id, hours, logged_date"),
    supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .not("status", "in", "(won,lost)"),
    supabase
      .from("submissions")
      .select("*")
      .eq("status", "submitted")
      .order("submitted_at", { ascending: true }),
  ]);

  // --- Cards ---
  const totalClients = (accounts ?? []).length;
  const activeClients = (accounts ?? []).filter(
    (a) => a.status === "active",
  ).length;

  const hoursDueTotal = (accounts ?? []).reduce(
    (sum, a) => sum + Number(a.hours_purchased),
    0,
  );
  const currentYear = new Date().getFullYear();
  const hoursWorkedThisYear = (hoursLog ?? [])
    .filter((h) => new Date(h.logged_date).getFullYear() === currentYear)
    .reduce((sum, h) => sum + Number(h.hours), 0);

  const cards = [
    {
      label: "Active / Total Clients",
      value: `${activeClients}/${totalClients}`,
    },
    {
      label: "Active Leads",
      value: activeLeadCount ?? 0,
    },
    {
      label: "Hours Due / Worked This Year",
      value: `${hoursDueTotal.toFixed(1)}/${hoursWorkedThisYear.toFixed(1)}`,
    },
  ];

  // --- Pending reviews ---
  const stepTitleById = new Map((steps ?? []).map((s) => [s.id, s.title]));
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const accountNameById = new Map((accounts ?? []).map((a) => [a.id, a.name]));

  const pendingReviews = (submissions ?? []).map((sub) => {
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
    <main className="px-4 py-7 sm:px-6 sm:py-9 lg:px-12">
      <h1 className="font-display text-2xl font-bold text-ink sm:text-[28px]">
        Dashboard
      </h1>
      <p className="mt-1.5 text-sm text-ink-soft">
        Everything running through OTC Setup, at a glance.
      </p>

      <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-border bg-surface p-5"
          >
            <div className="font-display text-2xl font-bold text-ink">
              {card.value}
            </div>
            <div className="mt-1 text-sm text-ink-soft">{card.label}</div>
          </div>
        ))}
      </div>

      <section className="mt-9">
        <h2 className="font-display text-lg font-bold text-ink">
          Pending reviews
        </h2>

        <div className="mt-3 flex flex-col gap-3">
          {pendingReviews.map((row) => (
            <div
              key={row.id}
              className="rounded-xl border border-border bg-surface p-5"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
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
                className="mt-4 flex flex-col items-stretch gap-3 border-t border-border-soft pt-4 sm:flex-row sm:items-end"
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

          {pendingReviews.length === 0 && (
            <p className="rounded-xl border border-border bg-surface p-5 text-sm text-ink-soft">
              Nothing waiting on review.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
