import Link from "next/link";
import { AUDIT_FEE, AUDIT_STATUSES, isAuditStatus, statusLabel } from "@/lib/audits";
import { requireStaff } from "./staff";
import { StatusBadge } from "./StatusBadge";

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: n % 1 ? 2 : 0 });

// OTC Audit requests, newest first, with counts and a status filter (kept
// in the address).
export default async function AuditsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const filter = status && isAuditStatus(status) ? status : null;
  const supabase = await requireStaff();
  const { data } = await supabase
    .from("audit_requests")
    .select("id, created_at, name, email, team_name, team_size, status, paid_at, upsell_amount")
    .order("created_at", { ascending: false });
  const all = data ?? [];
  const rows = filter ? all.filter((r) => r.status === filter) : all;
  const count = (s: string) => all.filter((r) => r.status === s).length;
  // Each paid audit, plus what they bought after.
  const revenue =
    all.filter((r) => r.paid_at).length * AUDIT_FEE + all.reduce((sum, r) => sum + Number(r.upsell_amount ?? 0), 0);

  const stats = [
    { label: "Requested", value: String(count("requested")) },
    { label: "Paid", value: String(count("paid")) },
    { label: "In progress", value: String(count("in_progress")) },
    { label: "Delivered", value: String(count("delivered")) },
    { label: "Upsold", value: String(count("upsold")) },
    { label: "Total revenue", value: money(revenue) },
  ];

  return (
    <main className="flex flex-1 justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-5xl">
        <Link href="/dashboard" className="text-sm font-medium text-accent">
          &larr; Back to dashboard
        </Link>
        <h1 className="mt-3 font-display text-2xl font-bold text-ink">OTC Audits</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Requests from the{" "}
          <Link href="/audit" className="font-semibold text-accent underline">
            /audit
          </Link>{" "}
          page. Revenue counts ${AUDIT_FEE} for each paid audit plus upsells.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-surface px-4 py-3">
              <div className="font-caption text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                {s.label}
              </div>
              <div className="mt-1 font-display text-2xl font-bold text-ink">{s.value}</div>
            </div>
          ))}
        </div>

        <nav className="mt-6 flex flex-wrap gap-2" aria-label="Filter by status">
          {[{ value: "", label: `All (${all.length})` }, ...AUDIT_STATUSES.map((s) => ({ value: s.value, label: `${s.label} (${count(s.value)})` }))].map(
            (s) => {
              const active = (filter ?? "") === s.value;
              return (
                <Link
                  key={s.value || "all"}
                  href={s.value ? `/admin/audits?status=${s.value}` : "/admin/audits"}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    active ? "border-accent bg-accent text-white" : "border-border bg-surface text-ink-soft hover:border-accent"
                  }`}
                >
                  {s.label}
                </Link>
              );
            },
          )}
        </nav>

        <div className="mt-4 overflow-hidden rounded-xl border border-border bg-surface">
          <div className="hidden grid-cols-[7rem_1fr_1fr_6rem_7rem] gap-3 border-b border-border-soft bg-bg px-4 py-2.5 font-caption text-[11px] font-bold uppercase tracking-wide text-ink-faint md:grid">
            <span>Date</span>
            <span>Name</span>
            <span>Team</span>
            <span>Size</span>
            <span>Status</span>
          </div>
          {rows.length === 0 && (
            <p className="px-4 py-6 text-sm text-ink-soft">
              {filter ? `No ${statusLabel(filter).toLowerCase()} requests.` : "No requests yet."}
            </p>
          )}
          <ul className="divide-y divide-border-soft">
            {rows.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/admin/audits/${r.id}`}
                  className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 px-4 py-3 text-sm hover:bg-accent-soft/30 md:grid-cols-[7rem_1fr_1fr_6rem_7rem] md:items-center"
                >
                  <span className="order-4 col-span-2 text-xs text-ink-faint md:order-none md:col-span-1 md:text-sm md:text-ink-soft">
                    {new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                  <span className="order-1 min-w-0 md:order-none">
                    <span className="block truncate font-semibold text-ink">{r.name}</span>
                    <span className="block truncate text-xs text-ink-faint">{r.email}</span>
                  </span>
                  <span className="order-3 col-span-2 min-w-0 truncate text-ink-soft md:order-none md:col-span-1">
                    {r.team_name}
                    <span className="text-ink-faint md:hidden"> · {r.team_size}</span>
                  </span>
                  <span className="hidden text-ink-soft md:block">{r.team_size}</span>
                  <span className="order-2 justify-self-end md:order-none md:justify-self-start">
                    <StatusBadge status={r.status} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
