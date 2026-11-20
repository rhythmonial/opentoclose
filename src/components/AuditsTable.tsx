"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AUDIT_STATUSES, formatYmd, reportDue } from "@/lib/audits";
import { quickUpdateAudit } from "@/app/admin/audits/actions";

export type AuditRow = {
  id: string;
  name: string;
  team_name: string;
  // When they requested it, already as an Eastern date ("Nov 20, 2026").
  requested: string;
  audit_date: string | null;
  status: string;
};

// Staff (Clients page): audits still in play. Each row's audit date and
// status save as they're picked; clicking anywhere else opens its page.
export function AuditsTable({ rows: initial }: { rows: AuditRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);

  async function save(row: AuditRow, patch: { status?: string; audit_date?: string }) {
    setRows((all) => all.map((r) => (r.id === row.id ? { ...r, ...patch } : r)));
    const res = await quickUpdateAudit(row.id, patch);
    if (!res.ok) window.alert(res.error ?? "Couldn't save.");
    router.refresh();
  }

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <div className="mt-4 min-w-0 overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-border-soft bg-bg font-caption text-xs font-bold uppercase tracking-wide text-ink-faint">
            <th className="px-5 py-3">Name</th>
            <th className="px-5 py-3">Requested</th>
            <th className="px-5 py-3">Audit date</th>
            <th className="px-5 py-3">Report due</th>
            <th className="px-5 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="px-5 py-4 text-ink-faint">
                No audits waiting.
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr
              key={r.id}
              onClick={() => router.push(`/admin/audits/${r.id}`)}
              className="cursor-pointer border-b border-border-soft align-top last:border-0 hover:bg-bg"
            >
              <td className="px-5 py-3.5">
                {/* The name always on one line; the team wraps under it. */}
                <div className="whitespace-nowrap font-semibold text-ink">{r.name}</div>
                <div className="max-w-[16rem] text-xs text-ink-faint">{r.team_name}</div>
              </td>
              <td className="whitespace-nowrap px-5 py-3.5 text-ink-soft">{r.requested}</td>
              <td className="px-5 py-3" onClick={stop}>
                <input
                  type="date"
                  value={r.audit_date ?? ""}
                  onChange={(e) => save(r, { audit_date: e.target.value })}
                  aria-label={`Audit date for ${r.name}`}
                  className="rounded-md border border-border bg-bg px-2 py-1 text-sm text-ink"
                />
              </td>
              <td className="whitespace-nowrap px-5 py-3.5 text-ink-soft">{formatYmd(reportDue(r.audit_date))}</td>
              <td className="px-5 py-3" onClick={stop}>
                <select
                  value={r.status}
                  onChange={(e) => save(r, { status: e.target.value })}
                  aria-label={`Status for ${r.name}`}
                  className="rounded-md border border-border bg-bg px-2 py-1 text-sm text-ink"
                >
                  {AUDIT_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
