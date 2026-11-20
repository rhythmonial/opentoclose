"use client";

import { useState } from "react";
import { formatYmd, reportDue } from "@/lib/audits";

const INPUT =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent";
const LABEL = "font-caption text-[11px] font-semibold uppercase tracking-wide text-ink-faint";

// An audit's dates: requested and paid, then the audit date picked here,
// then the report due date (5 business days later, as it's picked) beside
// the delivered date.
export function AuditDates({
  requested,
  paid,
  initialAuditDate,
  initialDelivered,
}: {
  requested: string;
  paid: string;
  initialAuditDate: string;
  initialDelivered: string;
}) {
  const [auditDate, setAuditDate] = useState(initialAuditDate);
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
      <div>
        <div className={LABEL}>Requested</div>
        <div className="mt-1 text-ink">{requested}</div>
      </div>
      <div>
        <div className={LABEL}>Paid</div>
        <div className="mt-1 text-ink">{paid}</div>
      </div>
      <label className="flex flex-col gap-1.5 sm:col-start-2">
        <span className={LABEL}>Audit date</span>
        <input
          type="date"
          name="audit_date"
          value={auditDate}
          onChange={(e) => setAuditDate(e.target.value)}
          className={INPUT}
        />
      </label>
      <div>
        <div className={LABEL}>Report due</div>
        <div className="mt-1 text-ink">
          {auditDate ? formatYmd(reportDue(auditDate)) : "Pick an audit date"}
        </div>
        <div className="text-xs text-ink-faint">5 business days after the audit date</div>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className={LABEL}>Delivered</span>
        <input type="date" name="delivered_date" defaultValue={initialDelivered} className={INPUT} />
      </label>
    </div>
  );
}
