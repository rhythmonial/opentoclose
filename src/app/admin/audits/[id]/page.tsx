import Link from "next/link";
import { notFound } from "next/navigation";
import { accessLabel, AUDIT_STATUSES, AUDIT_TZ, easternYmd } from "@/lib/audits";
import { decryptCredential } from "@/lib/auditCredentials";
import { requireStaff } from "../staff";
import { StatusBadge } from "../StatusBadge";
import { updateAuditRequest } from "../actions";
import { AuditDates } from "./AuditDates";
import { DeleteAudit } from "./DeleteAudit";
import { LinkInput } from "./LinkInput";
import { PayLink } from "./PayLink";
import { UpsellFields } from "./UpsellFields";
import { auditPayLink } from "@/lib/auditCheckout";
import { siteOrigin } from "@/lib/site-origin";

const INPUT =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent";
const LABEL = "font-caption text-[11px] font-semibold uppercase tracking-wide text-ink-faint";

// One audit request: who they are, its dates, their login and setup, then
// the status, links, upsell and notes to keep up to date. It's all one form
// with one Save.
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
  const hasLogin = Boolean(r.otc_username || r.otc_password_enc);

  return (
    <main className="flex flex-1 justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-3xl">
        <div className="flex items-center justify-between gap-3">
          <Link href="/dashboard/clients" className="text-sm font-medium text-accent">
            &larr; Back to clients
          </Link>
          <StatusBadge status={r.status} />
        </div>
        <h1 className="mt-3 font-display text-2xl font-bold text-ink">
          {r.name} <span className="font-sans text-base font-normal text-ink-soft">({r.team_name})</span>
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          <a href={`mailto:${r.email}`} className="text-accent hover:underline">
            {r.email}
          </a>
          {r.phone && (
            <>
              {" "}
              &middot;{" "}
              <a href={`tel:${r.phone}`} className="text-accent hover:underline">
                {r.phone}
              </a>
            </>
          )}
        </p>

        {saved && (
          <div className="mt-4 rounded-lg border border-success/30 bg-success-soft px-4 py-2.5 text-sm text-success">Saved.</div>
        )}
        {error && (
          <div className="mt-4 rounded-lg border border-danger/30 bg-danger/5 px-4 py-2.5 text-sm text-danger">{error}</div>
        )}

        <form action={updateAuditRequest}>
          <input type="hidden" name="id" value={r.id} />
          <section className="mt-5 flex flex-col gap-5 rounded-xl border border-border bg-surface p-5 text-sm">
            <div className="grid grid-cols-2 gap-x-6">
              <div>
                <div className={LABEL}>Requested</div>
                <EasternWhen iso={r.created_at} />
              </div>
              <div>
                <div className={LABEL}>Paid</div>
                {r.paid_at ? (
                  <EasternWhen iso={r.paid_at} />
                ) : (
                  <PayLink link={auditPayLink(await siteOrigin(), r.id)} email={r.email} />
                )}
              </div>
            </div>
            <AuditDates initialAuditDate={r.audit_date ?? ""} />
            <div className="grid grid-cols-1 gap-x-6 gap-y-3 border-t border-border-soft pt-4 sm:grid-cols-3">
              <div>
                <div className={LABEL}>Login</div>
                <div className="mt-1 text-ink">{accessLabel(r.access_method)}</div>
              </div>
              {hasLogin && (
                <>
                  <div>
                    <div className={LABEL}>OTC username</div>
                    <div className="mt-1 break-words text-ink">{r.otc_username ?? "—"}</div>
                  </div>
                  <div>
                    <div className={LABEL}>OTC password</div>
                    <div className="mt-1 break-words font-mono text-ink">
                      {decryptCredential(r.otc_password_enc) ?? "Couldn't be read"}
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="border-t border-border-soft pt-4">
              <h2 className={LABEL}>About their setup</h2>
              <p className="mt-1 whitespace-pre-wrap text-ink">{r.frustrations}</p>
              {r.anything_else && (
                <>
                  <h2 className={`mt-4 ${LABEL}`}>Anything else</h2>
                  <p className="mt-1 whitespace-pre-wrap text-ink">{r.anything_else}</p>
                </>
              )}
            </div>
          </section>

          <section className="mt-5 flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
            <div className="grid grid-cols-2 gap-x-6">
              <label className="flex flex-col gap-1.5">
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
                <span className="text-sm font-medium text-ink">Delivered date</span>
                <input type="date" name="delivered_date" defaultValue={easternYmd(r.delivered_at)} className={INPUT} />
              </label>
            </div>
            <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-ink">Video link</span>
                <LinkInput name="video_link" initial={r.video_link ?? ""} />
                {r.video_link && (
                  <a href={r.video_link} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-accent">
                    Open video &#8599;
                  </a>
                )}
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-ink">Report link</span>
                <LinkInput name="report_link" initial={r.report_link ?? ""} />
                {r.report_link && (
                  <a href={r.report_link} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-accent">
                    Open report &#8599;
                  </a>
                )}
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={`/admin/audits/${r.id}/report`}
                className="rounded-lg border border-accent px-4 py-2 text-sm font-semibold text-accent hover:bg-accent-soft/40"
              >
                {r.report_completed_at ? "Open report" : "Open report form"}
              </Link>
              <span className="text-xs text-ink-faint">
                {r.report_completed_at ? "Report complete" : "Fill it in as you audit; save and come back any time."}
              </span>
            </div>
            <UpsellFields initial={r.upsell_hours === null ? "" : String(r.upsell_hours)} />
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink">Notes</span>
              <textarea name="notes" rows={5} defaultValue={r.notes ?? ""} className={INPUT} />
            </label>
            <p className="text-xs text-ink-faint">
              Setting In progress (or later) stamps the paid date if there isn&rsquo;t one. Setting Delivered
              or Upsold without a delivered date uses today.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" className="rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-white">
                Save
              </button>
              <DeleteAudit id={r.id} name={r.name} />
            </div>
          </section>
        </form>
      </div>
    </main>
  );
}

// A time in Eastern: the date, then the time on the next line.
function EasternWhen({ iso }: { iso: string | null }) {
  if (!iso) return <div className="mt-1 text-ink">&mdash;</div>;
  const d = new Date(iso);
  return (
    <div className="mt-1 text-ink">
      <div>{d.toLocaleDateString("en-US", { timeZone: AUDIT_TZ, month: "short", day: "numeric", year: "numeric" })}</div>
      <div className="text-xs text-ink-soft">
        {d.toLocaleTimeString("en-US", { timeZone: AUDIT_TZ, hour: "numeric", minute: "2-digit", timeZoneName: "short" })}
      </div>
    </div>
  );
}
