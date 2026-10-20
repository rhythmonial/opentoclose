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
    { data: initiations },
    { data: submissionStatuses },
    { data: leads },
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
    supabase.from("setup_initiation").select("engagement_type"),
    supabase.from("submissions").select("status"),
    supabase.from("leads").select("status"),
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
      label: "Active/Total",
      value: `${activeClients}/${totalClients}`,
    },
    {
      label: "Leads",
      value: activeLeadCount ?? 0,
    },
    {
      label: "Due/Worked",
      value: `${hoursDueTotal.toFixed(1)}/${hoursWorkedThisYear.toFixed(1)}`,
    },
  ];

  // --- Business numbers ---
  const clientsByEngagement = { custom: 0, diy: 0 };
  for (const i of initiations ?? []) {
    if (i.engagement_type === "custom" || i.engagement_type === "diy") {
      clientsByEngagement[i.engagement_type] += 1;
    }
  }
  const payingClients = clientsByEngagement.custom + clientsByEngagement.diy;
  const freeClients = Math.max(0, totalClients - payingClients);

  const hoursUsedTotal = (hoursLog ?? []).reduce(
    (sum, h) => sum + Number(h.hours),
    0,
  );

  const submissionsByStatus = { submitted: 0, approved: 0, returned: 0 };
  for (const sub of submissionStatuses ?? []) {
    if (sub.status in submissionsByStatus) {
      submissionsByStatus[sub.status as keyof typeof submissionsByStatus] += 1;
    }
  }

  const leadsByStatus: Record<string, number> = {
    new: 0,
    contacted: 0,
    info_sent: 0,
    proposal_sent: 0,
    won: 0,
    lost: 0,
  };
  for (const l of leads ?? []) {
    leadsByStatus[l.status] = (leadsByStatus[l.status] ?? 0) + 1;
  }
  const decidedLeads = leadsByStatus.won + leadsByStatus.lost;
  const conversionRate =
    decidedLeads > 0 ? (leadsByStatus.won / decidedLeads) * 100 : 0;

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

      <div className="mt-7 grid grid-cols-3 gap-3 sm:gap-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="min-w-0 rounded-xl border border-border bg-surface px-3 py-4 sm:p-5"
          >
            <div className="truncate font-display text-lg font-bold text-ink sm:text-2xl">
              {card.value}
            </div>
            <div className="mt-1 text-xs text-ink-soft sm:text-sm">
              {card.label}
            </div>
          </div>
        ))}
      </div>

      <section className="mt-9">
        <h2 className="font-display text-lg font-bold text-ink">
          Business numbers
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          Live from clients, leads and hours logged. No billing data is wired
          up yet, so this is activity, not revenue.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <div className="rounded-xl border border-border bg-surface p-5">
            <h3 className="text-[15px] font-bold text-ink">Clients by path</h3>
            <div className="mt-3 flex justify-between text-sm">
              <span className="text-ink-soft">Setup ($999)</span>
              <span className="font-bold text-ink">{clientsByEngagement.custom}</span>
            </div>
            <div className="mt-1.5 flex justify-between text-sm">
              <span className="text-ink-soft">DIY ($19)</span>
              <span className="font-bold text-ink">{clientsByEngagement.diy}</span>
            </div>
            <div className="mt-1.5 flex justify-between text-sm">
              <span className="text-ink-soft">Free</span>
              <span className="font-bold text-ink">{freeClients}</span>
            </div>
            <div className="mt-3 flex justify-between border-t border-border-soft pt-2 text-sm font-bold text-ink">
              <span>Total paying</span>
              <span>{payingClients}</span>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface p-5">
            <h3 className="text-[15px] font-bold text-ink">Hours</h3>
            <div className="mt-3 flex justify-between text-sm">
              <span className="text-ink-soft">Purchased</span>
              <span className="font-bold text-ink">
                {hoursDueTotal.toFixed(1)}
              </span>
            </div>
            <div className="mt-1.5 flex justify-between text-sm">
              <span className="text-ink-soft">Used</span>
              <span className="font-bold text-ink">
                {hoursUsedTotal.toFixed(1)}
              </span>
            </div>
            <div className="mt-3 flex justify-between border-t border-border-soft pt-2 text-sm font-bold text-ink">
              <span>Remaining</span>
              <span>{(hoursDueTotal - hoursUsedTotal).toFixed(1)}</span>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface p-5">
            <h3 className="text-[15px] font-bold text-ink">Submissions</h3>
            <div className="mt-3 flex justify-between text-sm">
              <span className="text-ink-soft">Pending review</span>
              <span className="font-bold text-ink">
                {submissionsByStatus.submitted}
              </span>
            </div>
            <div className="mt-1.5 flex justify-between text-sm">
              <span className="text-ink-soft">Approved</span>
              <span className="font-bold text-ink">
                {submissionsByStatus.approved}
              </span>
            </div>
            <div className="mt-1.5 flex justify-between text-sm">
              <span className="text-ink-soft">Returned</span>
              <span className="font-bold text-ink">
                {submissionsByStatus.returned}
              </span>
            </div>
          </div>

          <div className="rounded-xl sm:col-span-2 border border-border bg-surface p-5">
            <h3 className="text-[15px] font-bold text-ink">Leads by stage</h3>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {Object.entries(leadsByStatus).map(([status, count]) => (
                <div key={status}>
                  <div className="font-display text-xl font-bold text-ink">
                    {count}
                  </div>
                  <div className="text-xs capitalize text-ink-soft">
                    {status.replace("_", " ")}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface p-5">
            <h3 className="text-[15px] font-bold text-ink">Conversion</h3>
            <div className="mt-3 font-display text-2xl font-bold text-ink">
              {conversionRate.toFixed(0)}%
            </div>
            <p className="mt-1 text-xs text-ink-soft">
              Won leads as a share of all leads ever won or lost.
            </p>
          </div>
        </div>
      </section>

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
