import Link from "next/link";
import { notFound } from "next/navigation";
import { accessLabel, AUDIT_STATUSES, easternDateTime, easternYmd } from "@/lib/audits";
import { decryptCredential } from "@/lib/auditCredentials";
import { requireStaff } from "../staff";
import { StatusBadge } from "../StatusBadge";
import { updateAuditRequest } from "../actions";
import { AuditDates } from "./AuditDates";

const INPUT =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent";

// One audit request: what they sent, and the status, notes, report link
// and upsell to keep up to date.
export default async function AuditRequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { id } = await params;
  const { saved, error } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await requireStaff();
  const { data: r } = await supabase.from("audit_requests").select("*").eq("id", id).maybeSingle();
  if (!r) notFound();

  const details: [string, React.ReactNode][] = [
    ["Email", <a key="e" href={`mailto:${r.email}`} className="text-accent underline">{r.email}</a>],
    ["Phone", r.phone ? <a key="p" href={`tel:${r.phone}`} className="text-accent underline">{r.phone}</a> : "—"],
    ["Team / brokerage", r.team_name],
    ...(r.team_size ? [["Team size", r.team_size] as [string, React.ReactNode]] : []),
    ["Login", accessLabel(r.access_method)],
    ...(r.otc_username || r.otc_password_enc
      ? [
          ["OTC username", r.otc_username ?? "—"] as [string, React.ReactNode],
          [
            "OTC password",
            <span key="pw" className="font-mono">
              {decryptCredential(r.otc_password_enc) ?? "Couldn't be read"}
            </span>,
          ] as [string, React.ReactNode],
        ]
      : []),
  ];

  return (
    <main className="flex flex-1 justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-3xl">
        <Link href="/admin/audits" className="text-sm font-medium text-accent">
          &larr; All audit requests
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-bold text-ink">{r.name}</h1>
          <StatusBadge status={r.status} />
        </div>

        {saved && (
          <div className="mt-4 rounded-lg border border-success/30 bg-success-soft px-4 py-2.5 text-sm text-success">Saved.</div>
        )}
        {error && (
          <div className="mt-4 rounded-lg border border-danger/30 bg-danger/5 px-4 py-2.5 text-sm text-danger">{error}</div>
        )}

        <section className="mt-5 rounded-xl border border-border bg-surface p-5">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            {details.map(([label, value]) => (
              <div key={label}>
                <dt className="font-caption text-[11px] font-semibold uppercase tracking-wide text-ink-faint">{label}</dt>
                <dd className="mt-0.5 break-words text-ink">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-5 border-t border-border-soft pt-4 text-sm">
            <h2 className="font-caption text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
              About their setup
            </h2>
            <p className="mt-1 whitespace-pre-wrap text-ink">{r.frustrations}</p>
            {r.anything_else && (
              <>
                <h2 className="mt-4 font-caption text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                  Anything else
                </h2>
                <p className="mt-1 whitespace-pre-wrap text-ink">{r.anything_else}</p>
              </>
            )}
          </div>
        </section>

        <form action={updateAuditRequest} className="mt-5 flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
          <input type="hidden" name="id" value={r.id} />
          <AuditDates
            requested={easternDateTime(r.created_at)}
            paid={easternDateTime(r.paid_at)}
            initialAuditDate={r.audit_date ?? ""}
            initialDelivered={easternYmd(r.delivered_at)}
          />
          <label className="flex flex-col gap-1.5 border-t border-border-soft pt-4 sm:w-1/2 sm:pr-3">
            <span className="text-sm font-medium text-ink">Status</span>
            <select name="status" defaultValue={r.status} className={INPUT}>
              {AUDIT_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">Video link</span>
            <input name="video_link" type="url" defaultValue={r.video_link ?? ""} placeholder="https://…" className={INPUT} />
            {r.video_link && (
              <a href={r.video_link} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-accent">
                Open video &#8599;
              </a>
            )}
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">Report link</span>
            <input name="report_link" type="url" defaultValue={r.report_link ?? ""} placeholder="https://…" className={INPUT} />
            {r.report_link && (
              <a href={r.report_link} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-accent">
                Open report &#8599;
              </a>
            )}
          </label>
          <label className="flex flex-col gap-1.5 sm:w-1/2 sm:pr-3">
            <span className="text-sm font-medium text-ink">Upsell amount ($)</span>
            <input name="upsell_amount" inputMode="decimal" defaultValue={r.upsell_amount ?? ""} placeholder="0" className={INPUT} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">Notes</span>
            <textarea name="notes" rows={5} defaultValue={r.notes ?? ""} className={INPUT} />
          </label>
          <p className="text-xs text-ink-faint">
            Setting Paid (or later) stamps the paid date. Setting Delivered or Upsold without a delivered
            date uses today.
          </p>
          <button type="submit" className="self-start rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-white">
            Save
          </button>
        </form>
      </div>
    </main>
  );
}
