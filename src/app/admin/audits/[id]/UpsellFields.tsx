"use client";

import { useState } from "react";
import { AUDIT_FEE, UPSELL_HOURLY_RATE, upsellAmount } from "@/lib/audits";

const INPUT =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent";
const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

// The upsell's hours, and beside it the amount: hours at the hourly rate,
// less the audit fee (credited toward the work).
export function UpsellFields({ initial }: { initial: string }) {
  const [hours, setHours] = useState(initial);
  const amount = upsellAmount(Number(hours) || null);
  return (
    <div className="grid grid-cols-2 gap-x-6">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink">Upsell hours</span>
        <input
          name="upsell_hours"
          inputMode="decimal"
          value={hours}
          onChange={(e) => setHours(e.target.value.replace(/[^\d.]/g, ""))}
          placeholder="0"
          className={INPUT}
        />
      </label>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink">Amount</span>
        <span className="py-2 text-sm text-ink">
          {amount === null ? "—" : money(amount)}
          {amount !== null && (
            <span className="text-xs text-ink-faint">
              {" "}
              ({hours} hrs &times; {money(UPSELL_HOURLY_RATE)} &minus; {money(AUDIT_FEE)} credit)
            </span>
          )}
        </span>
      </div>
    </div>
  );
}
