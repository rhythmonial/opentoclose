import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ClientStatusSelect } from "@/components/ClientStatusSelect";
import { approveSubmission, returnSubmission } from "./actions";

export default async function DashboardHome() {
  const supabase = await createClient();

  const [
    { data: accounts },
    { data: profiles },
    { data: steps },
    { data: statuses },
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
    supabase.from("setup_steps").select("id, path, title, sort_order"),
    supabase.from("client_step_status").select("client_id, step_id, status"),
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

    let currentStage = "Not started";
    if (owner) {
      const nextStep = pathSteps.find(
        (s) => statusByClientStep.get(`${owner.id}:${s.id}`) !== "approved",
      );
      currentStage = nextStep ? nextStep.title : "Complete";
    }

    return {
      id: account.id,
      name: account.name,
      path,
      status: account.status,
      ownerEmail: owner?.email ?? "—",
      currentStage,
      hoursUsed,
      hoursPurchased: Number(account.hours_purchased),
    };
  });

  return (
    <main className="px-12 py-9">
      <h1 className="font-display text-[25px] font-bold text-ink">
        Dashboard
      </h1>
      <p className="mt-1.5 text-sm text-ink-soft">
        Everything running through OTC Setup, at a glance.
      </p>

      <div className="mt-7 grid grid-cols-3 gap-4">
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

          {pendingReviews.length === 0 && (
            <p className="rounded-xl border border-border bg-surface p-5 text-sm text-ink-soft">
              Nothing waiting on review.
            </p>
          )}
        </div>
      </section>

      <section id="clients" className="mt-9 scroll-mt-9">
        <h2 className="font-display text-lg font-bold text-ink">Clients</h2>

        <div className="mt-3 overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border-soft bg-bg text-xs font-bold uppercase tracking-wide text-ink-faint">
                <th className="px-5 py-3">Business</th>
                <th className="px-5 py-3">Owner</th>
                <th className="px-5 py-3">Path</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Current stage</th>
                <th className="px-5 py-3">Hours</th>
              </tr>
            </thead>
            <tbody>
              {clientRows.map((row) => (
                <tr key={row.id} className="border-b border-border-soft last:border-0">
                  <td className="p-0">
                    <Link
                      href={`/dashboard/clients/${row.id}`}
                      className="block px-5 py-3.5 font-semibold text-ink hover:text-accent"
                    >
                      {row.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5 text-ink-soft">{row.ownerEmail}</td>
                  <td className="px-5 py-3.5 capitalize text-ink-soft">
                    {row.path}
                  </td>
                  <td className="px-5 py-3.5">
                    <ClientStatusSelect accountId={row.id} status={row.status} />
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide ${
                        row.currentStage === "Complete"
                          ? "bg-success-soft text-success"
                          : "bg-accent-soft text-accent"
                      }`}
                    >
                      {row.currentStage.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-ink-soft">
                    {row.hoursUsed.toFixed(1)} / {row.hoursPurchased.toFixed(1)}
                  </td>
                </tr>
              ))}

              {clientRows.length === 0 && (
                <tr>
                  <td className="px-5 py-6 text-sm text-ink-soft" colSpan={6}>
                    No clients yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
