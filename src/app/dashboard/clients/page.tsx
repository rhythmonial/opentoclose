import { createClient } from "@/lib/supabase/server";

export default async function ClientsPage() {
  const supabase = await createClient();

  const [
    { data: accounts },
    { data: profiles },
    { data: steps },
    { data: statuses },
    { data: hoursLog },
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
    supabase.from("hours_log").select("client_id, hours"),
  ]);

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

  const rows = (accounts ?? []).map((account) => {
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
      ownerEmail: owner?.email ?? "—",
      teamSize: members.length,
      currentStage,
      hoursUsed,
      hoursPurchased: Number(account.hours_purchased),
    };
  });

  return (
    <main className="px-12 py-9">
      <h1 className="font-display text-[25px] font-bold text-ink">Clients</h1>
      <p className="mt-1.5 text-sm text-ink-soft">
        Every business running through OTC Setup.
      </p>

      <div className="mt-7 overflow-hidden rounded-xl border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border-soft bg-bg text-xs font-bold uppercase tracking-wide text-ink-faint">
              <th className="px-5 py-3">Business</th>
              <th className="px-5 py-3">Path</th>
              <th className="px-5 py-3">Owner</th>
              <th className="px-5 py-3">Team</th>
              <th className="px-5 py-3">Current stage</th>
              <th className="px-5 py-3">Hours</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border-soft last:border-0">
                <td className="px-5 py-3.5 font-semibold text-ink">
                  {row.name}
                </td>
                <td className="px-5 py-3.5 capitalize text-ink-soft">
                  {row.path}
                </td>
                <td className="px-5 py-3.5 text-ink-soft">{row.ownerEmail}</td>
                <td className="px-5 py-3.5 text-ink-soft">{row.teamSize}</td>
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

            {rows.length === 0 && (
              <tr>
                <td className="px-5 py-6 text-sm text-ink-soft" colSpan={6}>
                  No clients yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
