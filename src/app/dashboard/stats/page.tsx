import { createClient } from "@/lib/supabase/server";

export default async function StatsPage() {
  const supabase = await createClient();

  const [
    { data: accounts },
    { data: initiations },
    { data: submissions },
    { data: leads },
    { data: hoursLog },
  ] = await Promise.all([
    supabase.from("client_accounts").select("hours_purchased"),
    supabase.from("setup_initiation").select("engagement_type"),
    supabase.from("submissions").select("status"),
    supabase.from("leads").select("status"),
    supabase.from("hours_log").select("hours"),
  ]);

  const clientsByEngagement = { custom: 0, diy: 0 };
  for (const i of initiations ?? []) {
    const engagementType = (i.engagement_type ?? "custom") as "custom" | "diy";
    clientsByEngagement[engagementType] += 1;
  }

  let hoursPurchasedTotal = 0;
  for (const a of accounts ?? []) {
    hoursPurchasedTotal += Number(a.hours_purchased);
  }

  const hoursUsedTotal = (hoursLog ?? []).reduce(
    (sum, h) => sum + Number(h.hours),
    0,
  );

  const submissionsByStatus = { submitted: 0, approved: 0, returned: 0 };
  for (const s of submissions ?? []) {
    if (s.status in submissionsByStatus) {
      submissionsByStatus[s.status as keyof typeof submissionsByStatus] += 1;
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

  const totalClients = clientsByEngagement.custom + clientsByEngagement.diy;
  const freeClients = Math.max(0, (accounts ?? []).length - totalClients);
  const decidedLeads = leadsByStatus.won + leadsByStatus.lost;
  const conversionRate =
    decidedLeads > 0 ? (leadsByStatus.won / decidedLeads) * 100 : 0;

  return (
    <main className="px-4 py-7 sm:px-6 sm:py-9 lg:px-12">
      <h1 className="font-script text-[34px] leading-tight text-ink sm:text-[42px]">
        Business numbers
      </h1>
      <p className="mt-1.5 text-sm text-ink-soft">
        Operational metrics pulled live from clients, leads, and hours
        logged. No billing data is wired up yet, so this is activity, not
        revenue.
      </p>

      <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
            <span className="text-ink-soft">Free (not signed up yet)</span>
            <span className="font-bold text-ink">{freeClients}</span>
          </div>
          <div className="mt-3 flex justify-between border-t border-border-soft pt-2 text-sm font-bold text-ink">
            <span>Total paying</span>
            <span>{totalClients}</span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-5">
          <h3 className="text-[15px] font-bold text-ink">Hours</h3>
          <div className="mt-3 flex justify-between text-sm">
            <span className="text-ink-soft">Purchased</span>
            <span className="font-bold text-ink">
              {hoursPurchasedTotal.toFixed(1)}
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
            <span>{(hoursPurchasedTotal - hoursUsedTotal).toFixed(1)}</span>
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

        <div className="sm:col-span-2 rounded-xl border border-border bg-surface p-5">
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
    </main>
  );
}
