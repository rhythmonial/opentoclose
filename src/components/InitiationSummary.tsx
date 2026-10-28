import type { Tables } from "@/lib/supabase/types";
import { formatPhone } from "@/lib/phone";

type Initiation = Tables<"setup_initiation">;

const PLAN_LABEL: Record<string, string> = {
  custom: "Setup ($999)",
  diy: "DIY ($19)",
  free: "Free (not paid yet)",
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="font-caption text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
        {label}
      </dt>
      <dd className="mt-0.5 break-words text-sm text-ink">
        {value === null || value === undefined || value === "" ? (
          <span className="text-ink-faint">&mdash;</span>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

function contact(
  first: string | null,
  last: string | null,
  cell: string | null,
  email: string | null,
) {
  const name = [first, last].filter(Boolean).join(" ");
  if (!name && !cell && !email) return null;
  return (
    <>
      <div className="font-semibold">{name || "—"}</div>
      {cell && (
        <div className="text-ink-soft">
          {formatPhone(cell).length === 12 ? formatPhone(cell) : cell}
        </div>
      )}
      {email && (
        <a href={`mailto:${email}`} className="text-accent">
          {email}
        </a>
      )}
    </>
  );
}

export function InitiationSummary({
  initiation,
  otcPassword,
}: {
  initiation: Initiation | null;
  otcPassword: string | null;
}) {
  return (
    <details open className="mt-5 rounded-xl border border-border bg-surface">
      <summary className="flex cursor-pointer flex-wrap items-baseline justify-between gap-2 px-5 py-3.5">
        <span className="text-[15px] font-bold text-ink">Setup Initiation</span>
        <span className="text-xs text-ink-faint">
          {initiation
            ? `Last updated ${new Date(initiation.updated_at).toLocaleDateString(
                "en-US",
                { month: "short", day: "numeric", year: "numeric" },
              )}`
            : "Not submitted yet"}
        </span>
      </summary>

      {initiation ? (
        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 border-t border-border-soft px-5 py-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Business / team" value={initiation.business_name} />
          <Field label="Company structure" value={initiation.company_structure} />
          <Field
            label="Plan"
            value={PLAN_LABEL[initiation.engagement_type] ?? initiation.engagement_type}
          />
          <Field
            label="Team owner"
            value={contact(
              initiation.first_name,
              initiation.last_name,
              initiation.cell_phone,
              initiation.email,
            )}
          />
          <Field
            label="OTC Guru"
            value={
              initiation.guru_same_as_owner
                ? "Same as team owner"
                : contact(
                    initiation.guru_first_name,
                    initiation.guru_last_name,
                    initiation.guru_cell,
                    initiation.guru_email,
                  )
            }
          />
          <Field
            label="States serviced"
            value={
              initiation.states_serviced && (
                <>
                  {initiation.states_serviced}
                  {initiation.priority_state && (
                    <div className="text-ink-soft">
                      Starting with {initiation.priority_state}
                    </div>
                  )}
                </>
              )
            }
          />
          {/* No longer asked; still shown for clients who answered earlier. */}
          {initiation.transactions_under_contract !== null && (
            <Field label="Under contract" value={initiation.transactions_under_contract} />
          )}
          {initiation.transactions_per_month !== null && (
            <Field label="Closed this month" value={initiation.transactions_per_month} />
          )}
          {initiation.tc_count !== null && (
            <Field label="TCs on team" value={initiation.tc_count} />
          )}
          <Field
            label="E-sign platform"
            value={
              initiation.esign_platform === "Other"
                ? `Other: ${initiation.esign_other ?? ""}`
                : initiation.esign_platform
            }
          />
          <Field label="Transaction management" value={initiation.tms} />
          <Field label="Email provider" value={initiation.email_provider} />
          {(initiation.otc_username || otcPassword) && (
            <Field
              label="OTC login"
              value={
                <>
                  <div>{initiation.otc_username ?? "—"}</div>
                  {otcPassword && (
                    <details className="text-ink-soft">
                      <summary className="cursor-pointer text-accent">
                        Show password
                      </summary>
                      <span className="font-mono text-ink">{otcPassword}</span>
                    </details>
                  )}
                </>
              }
            />
          )}
          {(initiation.tools_used.length > 0 || initiation.tools_other) && (
            <Field
              label="Tools (earlier form)"
              value={[...initiation.tools_used, initiation.tools_other]
                .filter(Boolean)
                .join(", ")}
            />
          )}
        </dl>
      ) : (
        <p className="border-t border-border-soft px-5 py-4 text-sm text-ink-soft">
          This client hasn&rsquo;t filled out the Setup Initiation form yet.
        </p>
      )}
    </details>
  );
}
