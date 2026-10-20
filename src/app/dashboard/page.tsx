import { createClient } from "@/lib/supabase/server";
import {
  SupportStatusBadge,
  SupportThread,
  type SupportMessage,
} from "@/components/SupportThread";

export default async function DashboardHome() {
  const supabase = await createClient();

  const [
    { data: accounts },
    { data: profiles },
    { data: steps },
    { data: hoursLog },
    { count: activeLeadCount },
    { data: tickets },
    { data: initiations },
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
      .from("support_tickets")
      .select("*")
      .order("updated_at", { ascending: true }),
    supabase.from("setup_initiation").select("engagement_type"),
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

  const ticketsByStatus = { open: 0, answered: 0, closed: 0 };
  for (const t of tickets ?? []) {
    if (t.status in ticketsByStatus) {
      ticketsByStatus[t.status as keyof typeof ticketsByStatus] += 1;
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

  // --- Support ---
  const stepTitleById = new Map((steps ?? []).map((s) => [s.id, s.title]));
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const accountNameById = new Map((accounts ?? []).map((a) => [a.id, a.name]));

  const ticketIds = (tickets ?? []).map((t) => t.id);
  const { data: ticketMessages } =
    ticketIds.length > 0
      ? await supabase
          .from("support_messages")
          .select("id, ticket_id, author_id, body, created_at")
          .in("ticket_id", ticketIds)
          .order("created_at")
      : { data: [] };

  const supportTickets = (tickets ?? []).map((t) => {
    const client = profileById.get(t.client_id);
    const accountName = client?.client_account_id
      ? accountNameById.get(client.client_account_id)
      : undefined;
    const messages: SupportMessage[] = (ticketMessages ?? [])
      .filter((m) => m.ticket_id === t.id)
      .map((m) => ({
        id: m.id,
        body: m.body,
        created_at: m.created_at,
        fromStaff: m.author_id !== t.client_id,
      }));

    return {
      ...t,
      accountName: accountName ?? "—",
      clientEmail: client?.email ?? "—",
      stepTitle: t.step_id ? stepTitleById.get(t.step_id) : undefined,
      messages,
    };
  });
  const openTickets = supportTickets.filter((t) => t.status === "open");
  const otherTickets = supportTickets
    .filter((t) => t.status !== "open")
    .reverse()
    .slice(0, 25);

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
            <h3 className="text-[15px] font-bold text-ink">Support</h3>
            <div className="mt-3 flex justify-between text-sm">
              <span className="text-ink-soft">Open</span>
              <span className="font-bold text-ink">{ticketsByStatus.open}</span>
            </div>
            <div className="mt-1.5 flex justify-between text-sm">
              <span className="text-ink-soft">Answered</span>
              <span className="font-bold text-ink">
                {ticketsByStatus.answered}
              </span>
            </div>
            <div className="mt-1.5 flex justify-between text-sm">
              <span className="text-ink-soft">Resolved</span>
              <span className="font-bold text-ink">
                {ticketsByStatus.closed}
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
          Support center
          {openTickets.length > 0 && (
            <span className="ml-2 rounded-full bg-danger px-2 py-0.5 align-middle font-caption text-xs font-bold text-white">
              {openTickets.length}
            </span>
          )}
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          Questions from clients, oldest first. Replying marks a question
          answered; a client reply reopens it.
        </p>

        <div className="mt-3 flex flex-col gap-3">
          {openTickets.map((t) => (
            <details
              key={t.id}
              open={t.status === "open"}
              className="rounded-xl border border-border bg-surface p-5"
            >
              <summary className="flex cursor-pointer items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[15px] font-bold text-ink">
                    {t.subject}
                  </div>
                  <div className="text-sm text-ink-soft">
                    {t.accountName} &middot; {t.clientEmail}
                  </div>
                  <div className="mt-0.5 text-xs text-ink-faint">
                    {t.stepTitle ? `${t.stepTitle} \u00b7 ` : ""}
                    Updated{" "}
                    {new Date(t.updated_at).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
                <SupportStatusBadge status={t.status} />
              </summary>
              <div className="mt-4 border-t border-border-soft pt-4">
                <SupportThread
                  ticketId={t.id}
                  status={t.status}
                  messages={t.messages}
                  viewerIsStaff
                  clientLabel={t.accountName}
                />
              </div>
            </details>
          ))}

          {openTickets.length === 0 && (
            <p className="rounded-xl border border-border bg-surface p-5 text-sm text-ink-soft">
              No open questions.
            </p>
          )}

          {otherTickets.length > 0 && (
            <details className="rounded-xl border border-border bg-surface">
              <summary className="cursor-pointer px-5 py-3.5 font-caption text-xs font-bold uppercase tracking-wide text-ink-faint">
                Answered &amp; resolved ({otherTickets.length})
              </summary>
              <div className="flex flex-col gap-3 border-t border-border-soft p-3">
                {otherTickets.map((t) => (
            <details
              key={t.id}
              open={t.status === "open"}
              className="rounded-xl border border-border bg-surface p-5"
            >
              <summary className="flex cursor-pointer items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[15px] font-bold text-ink">
                    {t.subject}
                  </div>
                  <div className="text-sm text-ink-soft">
                    {t.accountName} &middot; {t.clientEmail}
                  </div>
                  <div className="mt-0.5 text-xs text-ink-faint">
                    {t.stepTitle ? `${t.stepTitle} \u00b7 ` : ""}
                    Updated{" "}
                    {new Date(t.updated_at).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
                <SupportStatusBadge status={t.status} />
              </summary>
              <div className="mt-4 border-t border-border-soft pt-4">
                <SupportThread
                  ticketId={t.id}
                  status={t.status}
                  messages={t.messages}
                  viewerIsStaff
                  clientLabel={t.accountName}
                />
              </div>
            </details>
          ))}
              </div>
            </details>
          )}
        </div>
      </section>
    </main>
  );
}
