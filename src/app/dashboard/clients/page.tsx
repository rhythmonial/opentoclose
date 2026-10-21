import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ClientStatusSelect } from "@/components/ClientStatusSelect";
import { ClientOutcomeInput } from "@/components/ClientOutcomeInput";
import { LeadStatusSelect } from "@/components/LeadStatusSelect";
import { startSandbox } from "../sandbox-actions";
import { deleteLead, setLeadArchived } from "../leads/actions";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import type { Tables } from "@/lib/supabase/types";
import { AddLeadDialog } from "@/components/AddLeadDialog";
import type { SandboxTier } from "@/lib/devSandbox";

type Lead = Tables<"leads">;

export default async function ClientsPage() {
  const supabase = await createClient();

  const [
    { data: accounts },
    { data: profiles },
    { data: steps },
    { data: statuses },
    { data: hoursLog },
    { data: initiations },
    { data: leads },
    { data: payments },
  ] = await Promise.all([
    supabase
      .from("client_accounts")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, role, client_account_id")
      .in("role", ["client_owner", "client_admin"]),
    supabase
      .from("setup_steps")
      .select("id, path, title, phase, section, sort_order"),
    supabase.from("client_step_status").select("client_id, step_id, status"),
    supabase.from("hours_log").select("client_id, hours"),
    supabase.from("setup_initiation").select("client_id, engagement_type"),
    supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase.from("payments").select("client_id, kind, step_id"),
  ]);

  // --- Clients table ---
  const hoursByClient = new Map<string, number>();
  for (const h of hoursLog ?? []) {
    hoursByClient.set(
      h.client_id,
      (hoursByClient.get(h.client_id) ?? 0) + Number(h.hours),
    );
  }

  const statusByClientStep = new Map<string, string>();
  for (const s of statuses ?? []) {
    statusByClientStep.set(`${s.client_id}:${s.step_id}`, s.status);
  }

  const engagementByClientId = new Map(
    (initiations ?? []).map((i) => [i.client_id, i.engagement_type]),
  );

  const STAGE_LABEL: Record<string, string> = {
    "Getting Started": "Not Started",
  };

  const clientRows = (accounts ?? []).map((account) => {
    const members = (profiles ?? []).filter(
      (p) => p.client_account_id === account.id,
    );
    const owner = members.find((m) => m.role === "client_owner") ?? members[0];

    const hoursUsed = members.reduce(
      (sum, m) => sum + (hoursByClient.get(m.id) ?? 0),
      0,
    );

    const path = account.setup_path ?? "custom";
    const pathSteps = (steps ?? [])
      .filter((s) => s.path === path)
      .sort((a, b) => a.sort_order - b.sort_order);

    let stage = "Not Started";
    let section = "—";
    if (owner) {
      const nextStep = pathSteps.find(
        (s) => statusByClientStep.get(`${owner.id}:${s.id}`) !== "approved",
      );
      if (nextStep) {
        const phase = nextStep.phase ?? "General";
        stage = STAGE_LABEL[phase] ?? phase;
        section = nextStep.section;
      } else if (pathSteps.length > 0) {
        stage = "Complete";
        section = "—";
      }
    }

    const engagementType = owner
      ? (engagementByClientId.get(owner.id) ?? "free")
      : "free";

    return {
      id: account.id,
      name: account.name,
      engagementType,
      status: account.status,
      stage,
      section,
      hoursUsed,
      hoursPurchased: Number(account.hours_purchased),
      outcome: account.outcome,
    };
  });

  const activeRows = clientRows.filter(
    (r) => r.status !== "completed" && r.status !== "churned",
  );
  const closedRows = clientRows.filter(
    (r) => r.status === "completed" || r.status === "churned",
  );

  const clientGroups: {
    label: string;
    tier: SandboxTier;
    rows: typeof clientRows;
  }[] = [
    {
      label: "Setup ($999)",
      tier: "custom",
      rows: activeRows.filter((r) => r.engagementType === "custom"),
    },
    {
      label: "DIY ($19)",
      tier: "diy",
      rows: activeRows.filter((r) => r.engagementType === "diy"),
    },
    {
      label: "Free",
      tier: "free",
      rows: activeRows.filter((r) => r.engagementType === "free"),
    },
  ];

  // Free signups are linked to their client account. A lead counts as won
  // once marked won or once its linked account is on a paid plan; won leads
  // list what that account has bought.
  const engagementByAccountId = new Map(
    clientRows.map((r) => [r.id, r.engagementType]),
  );
  const accountByProfileId = new Map(
    (profiles ?? []).map((p) => [p.id, p.client_account_id]),
  );
  const stepTitleById = new Map((steps ?? []).map((s) => [s.id, s.title]));
  const purchasesByAccount = new Map<string, string[]>();
  for (const pay of payments ?? []) {
    const accountId = accountByProfileId.get(pay.client_id);
    if (!accountId) continue;
    const label =
      pay.kind === "setup"
        ? "Setup"
        : pay.kind === "diy"
          ? "DIY"
          : `Step: ${(pay.step_id && stepTitleById.get(pay.step_id)) ?? "removed step"}`;
    const list = purchasesByAccount.get(accountId) ?? [];
    if (!list.includes(label)) list.push(label);
    purchasesByAccount.set(accountId, list);
  }

  function leadPlan(lead: Lead) {
    return lead.converted_client_account_id
      ? engagementByAccountId.get(lead.converted_client_account_id)
      : undefined;
  }
  function isWon(lead: Lead) {
    const plan = leadPlan(lead);
    return lead.status === "won" || plan === "custom" || plan === "diy";
  }
  function purchasedFor(lead: Lead) {
    const accountId = lead.converted_client_account_id;
    const bought = accountId ? (purchasesByAccount.get(accountId) ?? []) : [];
    if (bought.length > 0) return bought.join(", ");
    const plan = leadPlan(lead);
    if (plan === "custom") return "Setup";
    if (plan === "diy") return "DIY";
    return "Marked won";
  }

  const activeLeads = (leads ?? []).filter((l) => !l.archived_at);
  const manualLeads = activeLeads.filter(
    (l) => !l.converted_client_account_id && !isWon(l),
  );
  const freeLeads = activeLeads.filter(
    (l) => l.converted_client_account_id && !isWon(l),
  );
  const wonLeads = activeLeads.filter(isWon);
  const archivedLeads = (leads ?? []).filter((l) => l.archived_at);
  const leadGroups = [
    { label: "Manual", rows: manualLeads, empty: "No manual leads yet." },
    {
      label: "Free signups",
      rows: freeLeads,
      empty: "No free signups to upsell.",
    },
    { label: "Won", rows: wonLeads, empty: "No won leads yet." },
  ];
  const openLeads = [...manualLeads, ...freeLeads];
  const newLeadCount = openLeads.filter((l) => l.status === "new").length;

  function leadRow(lead: Lead) {
    return (
      <tr key={lead.id} className="border-b border-border-soft last:border-0">
        <td className="px-5 py-3.5 font-semibold text-ink">
          {lead.converted_client_account_id ? (
            <Link
              href={`/dashboard/clients/${lead.converted_client_account_id}`}
              className="hover:text-accent"
            >
              {lead.name}
            </Link>
          ) : (
            lead.name
          )}
        </td>
        <td className="px-5 py-3.5 text-ink-soft">
          <div>{lead.email}</div>
          {lead.phone && (
            <div className="text-xs text-ink-faint">{lead.phone}</div>
          )}
        </td>
        <td className="px-5 py-3.5 text-ink-soft">
          <div>
            {lead.source === "request_info"
              ? "Request Info"
              : lead.source === "signup"
                ? "Free signup"
                : "Manual"}
          </div>
          {lead.heard_about && (
            <div className="text-xs text-ink-faint">
              {lead.heard_about}
              {lead.heard_about_detail ? ` \u2014 ${lead.heard_about_detail}` : ""}
            </div>
          )}
        </td>
        <td className="px-5 py-3.5">
          <LeadStatusSelect
            leadId={lead.id}
            status={isWon(lead) ? "won" : lead.status}
          />
          {isWon(lead) && (
            <div className="mt-1 text-xs text-ink-soft">
              Purchased: {purchasedFor(lead)}
            </div>
          )}
        </td>
        <td className="px-5 py-3.5 text-xs text-ink-faint">
          {new Date(lead.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </td>
        <td className="px-5 py-3.5">
          <div className="flex items-center justify-end gap-1.5">
            <form action={setLeadArchived}>
              <input type="hidden" name="lead_id" value={lead.id} />
              <input
                type="hidden"
                name="archived"
                value={lead.archived_at ? "false" : "true"}
              />
              <button
                type="submit"
                title={lead.archived_at ? "Restore lead" : "Archive lead"}
                aria-label={lead.archived_at ? "Restore lead" : "Archive lead"}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-ink-soft hover:text-ink"
              >
                {lead.archived_at ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                    <path d="M3 3v5h5" />
                  </svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="5" rx="1" />
                    <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
                    <path d="M10 12h4" />
                  </svg>
                )}
              </button>
            </form>
            <form action={deleteLead}>
              <input type="hidden" name="lead_id" value={lead.id} />
              <ConfirmSubmitButton
                confirmMessage={`Delete the lead "${lead.name}"? This cannot be undone.`}
                title="Delete lead"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-danger"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18" />
                  <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6" />
                  <path d="M14 11v6" />
                </svg>
              </ConfirmSubmitButton>
            </form>
          </div>
        </td>
      </tr>
    );
  }

  const leadTableHead = (
    <thead>
      <tr className="border-b border-border-soft bg-bg text-xs font-bold uppercase font-caption tracking-wide text-ink-faint">
        <th className="px-5 py-3">Name</th>
        <th className="px-5 py-3">Contact</th>
        <th className="px-5 py-3">Source</th>
        <th className="px-5 py-3">Status</th>
        <th className="px-5 py-3">Added</th>
        <th className="px-5 py-3" />
      </tr>
    </thead>
  );

  return (
    <main className="px-4 py-7 sm:px-6 sm:py-9 lg:px-12">
      <section className="relative">
        <details>
          <summary className="cursor-pointer pr-14">
            <h2 className="inline font-display text-lg font-bold text-ink">
              Leads ({openLeads.length})
            </h2>
            {newLeadCount > 0 && (
              <span className="ml-2 rounded-full bg-danger px-2 py-0.5 align-middle font-caption text-xs font-bold text-white">
                {newLeadCount} new
              </span>
            )}
            <p className="mt-1 text-sm text-ink-soft">
              Everyone who&rsquo;s requested info or been added as a prospect,
              before they become a client.
            </p>
          </summary>

          <div className="mt-4 flex flex-col gap-4">
            <div className="min-w-0 overflow-x-auto rounded-xl border border-border bg-surface">
              <table className="w-full min-w-[640px] text-left text-sm">
                {leadTableHead}
                <tbody>
                  {leadGroups.map((group) => [
                    <tr
                      key={group.label}
                      className="border-b border-border-soft bg-bg"
                    >
                      <td
                        colSpan={6}
                        className="px-5 py-2 font-caption text-[11px] font-bold uppercase tracking-wide text-ink-faint"
                      >
                        {group.label} ({group.rows.length})
                      </td>
                    </tr>,
                    ...(group.rows.length === 0
                      ? [
                          <tr
                            key={`${group.label}-empty`}
                            className="border-b border-border-soft last:border-0"
                          >
                            <td
                              className="px-5 py-4 text-sm text-ink-soft"
                              colSpan={6}
                            >
                              {group.empty}
                            </td>
                          </tr>,
                        ]
                      : group.rows.map(leadRow)),
                  ])}
                </tbody>
              </table>
            </div>

            <details className="rounded-xl border border-border bg-surface">
              <summary className="cursor-pointer px-5 py-3.5 font-caption text-xs font-bold uppercase tracking-wide text-ink-faint">
                Archived ({archivedLeads.length})
              </summary>
              <div className="overflow-x-auto border-t border-border-soft">
                <table className="w-full min-w-[640px] text-left text-sm">
                  {leadTableHead}
                  <tbody>
                    {archivedLeads.map(leadRow)}
                    {archivedLeads.length === 0 && (
                      <tr>
                        <td
                          className="px-5 py-4 text-sm text-ink-soft"
                          colSpan={6}
                        >
                          No archived leads.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </details>
          </div>
        </details>
        <div className="absolute right-0 top-0">
          <AddLeadDialog />
        </div>
      </section>

      <section id="clients" className="mt-9">
        <details open>
          <summary className="cursor-pointer">
            <h2 className="inline font-display text-lg font-bold text-ink">
              Clients ({clientGroups.map((g) => g.rows.length).join("/")})
            </h2>
            <p className="mt-1 text-sm text-ink-soft">
              Active and paused clients by plan: Setup / DIY / Free.
            </p>
          </summary>
          <div className="mt-4 flex flex-col gap-6">
            {clientGroups.map((group) => (
              <div key={group.label}>
                <div className="mb-2 flex items-center gap-2">
                  <h3 className="text-xs font-bold uppercase font-caption tracking-wide text-ink-faint">
                    {group.label}
                  </h3>
                  <form action={startSandbox}>
                    <input type="hidden" name="tier" value={group.tier} />
                    <button
                      type="submit"
                      title={`View as ${group.label}`}
                      aria-label={`View as ${group.label}`}
                      className="flex h-6 w-6 items-center justify-center rounded-lg border border-border text-ink-soft hover:text-accent"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </button>
                  </form>
                </div>
                <div className="overflow-x-auto rounded-xl border border-border bg-surface">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-border-soft bg-bg text-xs font-bold uppercase font-caption tracking-wide text-ink-faint">
                        <th className="px-5 py-3">Business</th>
                        <th className="px-5 py-3">Stage</th>
                        <th className="px-5 py-3">Section</th>
                        <th className="px-5 py-3">Hours</th>
                        <th className="px-5 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows.map((row) => (
                        <tr
                          key={row.id}
                          className="border-b border-border-soft last:border-0"
                        >
                          <td className="p-0">
                            <Link
                              href={`/dashboard/clients/${row.id}`}
                              className="block px-5 py-3.5 font-semibold text-ink hover:text-accent"
                            >
                              {row.name}
                            </Link>
                          </td>
                          <td className="px-5 py-3.5">
                            <span
                              className={`rounded-full px-2.5 py-1 text-[11px] font-bold font-caption tracking-wide ${
                                row.stage === "Complete"
                                  ? "bg-success-soft text-success"
                                  : "bg-accent-soft text-accent"
                              }`}
                            >
                              {row.stage.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-ink-soft">
                            {row.section}
                          </td>
                          <td className="px-5 py-3.5 text-ink-soft">
                            {row.hoursUsed.toFixed(1)} /{" "}
                            {row.hoursPurchased.toFixed(1)}
                          </td>
                          <td className="px-5 py-3.5">
                            <ClientStatusSelect
                              accountId={row.id}
                              status={row.status}
                            />
                          </td>
                        </tr>
                      ))}

                      {group.rows.length === 0 && (
                        <tr>
                          <td
                            className="px-5 py-6 text-sm text-ink-soft"
                            colSpan={5}
                          >
                            No clients yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}

            <details className="rounded-xl border border-border bg-surface">
              <summary className="cursor-pointer px-5 py-3.5 text-xs font-bold uppercase font-caption tracking-wide text-ink-faint">
                Completed / Churned ({closedRows.length})
              </summary>
              <div className="overflow-x-auto border-t border-border-soft">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border-soft bg-bg text-xs font-bold uppercase font-caption tracking-wide text-ink-faint">
                      <th className="px-5 py-3">Business</th>
                      <th className="px-5 py-3">Stage</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Outcome</th>
                    </tr>
                  </thead>
                  <tbody>
                    {closedRows.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-border-soft last:border-0"
                      >
                        <td className="p-0">
                          <Link
                            href={`/dashboard/clients/${row.id}`}
                            className="block px-5 py-3.5 font-semibold text-ink hover:text-accent"
                          >
                            {row.name}
                          </Link>
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-bold font-caption tracking-wide ${
                              row.stage === "Complete"
                                ? "bg-success-soft text-success"
                                : "bg-accent-soft text-accent"
                            }`}
                          >
                            {row.stage.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <ClientStatusSelect
                            accountId={row.id}
                            status={row.status}
                          />
                        </td>
                        <td className="px-5 py-3.5">
                          <ClientOutcomeInput
                            accountId={row.id}
                            outcome={row.outcome}
                          />
                        </td>
                      </tr>
                    ))}

                    {closedRows.length === 0 && (
                      <tr>
                        <td
                          className="px-5 py-6 text-sm text-ink-soft"
                          colSpan={4}
                        >
                          No completed or churned clients yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </details>
          </div>
        </details>
      </section>
    </main>
  );
}
