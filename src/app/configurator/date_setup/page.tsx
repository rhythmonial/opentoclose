import { OTC_FIELDS, cleanCustomFields, type OtcField } from "@/lib/otcFields";
import { isActive, newOtcFieldsFrom, otcTargetOf, type WorkflowField } from "@/lib/workflowFields";
import {
  DIRECTIONS,
  ROLLS,
  TIME_FRAMES,
  cleanCalc,
  isSameDay,
  type DateCalc,
} from "@/lib/dateCalculations";
import { inUploadOrder } from "@/lib/docOrder";
import type { ContractBlank } from "@/lib/contractBlanks";
import { inContractOrder } from "@/components/WorkflowFieldsSummary";
import { CopyIcon } from "@/components/CopyButton";
import { loadSetupLesson, SetupShell } from "../_setup/shell";

const label = (list: readonly { value: string; label: string }[], v: string | null) =>
  list.find((x) => x.value === v)?.label ?? "";

// Date Setup: each calculated date laid out like Open to Close's date editor:
// Days, Type and When; the Number Field; the Date Field Options (the date it
// counts from); then Weekend Roll, Federal Holiday Roll and Skip Federal
// Holidays. Names copy to paste into OTC.
export default async function DateSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const { client } = await searchParams;
  const lesson = await loadSetupLesson("date_setup", client);
  const { supabase, accountId } = lesson;

  let content: React.ReactNode = null;
  if (accountId) {
    const [{ data: docs }, { data: saved }, { data: selection }] = await Promise.all([
      supabase
        .from("contract_documents")
        .select("blanks, workflow_fields, created_at, upload_order")
        .eq("client_account_id", accountId)
        .eq("is_scanned", false),
      supabase.from("date_calculations").select("*").eq("client_account_id", accountId),
      supabase.from("client_otc_field_selections").select("custom_fields").eq("client_account_id", accountId).maybeSingle(),
    ]);
    const assigned = (docs ?? [])
      .flatMap((d) => (Array.isArray(d.workflow_fields) ? (d.workflow_fields as WorkflowField[]) : []))
      .filter(isActive);
    const all: OtcField[] = [...OTC_FIELDS, ...newOtcFieldsFrom(assigned), ...cleanCustomFields(selection?.custom_fields)];
    const calcs = (saved ?? [])
      .map((c) => cleanCalc(c as Partial<DateCalc>))
      .filter((c): c is DateCalc => Boolean(c && c.enabled));
    const nameOf = (id: string | null, fallback?: string | null) =>
      (id && all.find((f) => f.id === id)?.name) || fallback || id || "";

    // In the order the dates first appear on their contracts.
    const order = new Map<string, number>();
    for (const d of inUploadOrder(docs ?? [])) {
      const doc = {
        id: "",
        name: "",
        blanks: (Array.isArray(d.blanks) ? d.blanks : []) as ContractBlank[],
        fields: Array.isArray(d.workflow_fields) ? (d.workflow_fields as WorkflowField[]) : [],
      };
      for (const { field } of inContractOrder(doc)) {
        const t = otcTargetOf(field);
        if (t && !order.has(t)) order.set(t, order.size);
      }
    }
    const rows = [...calcs].sort(
      (a, b) =>
        (order.get(a.otc_field) ?? 9999) - (order.get(b.otc_field) ?? 9999) ||
        nameOf(a.otc_field, a.field_name).localeCompare(nameOf(b.otc_field, b.field_name)),
    );

    content =
      rows.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface p-6 text-sm text-ink-soft">
          No calculated dates yet. Set them up in Calculate Your Dates first.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {rows.map((c) => {
            const name = nameOf(c.otc_field, c.field_name);
            const from = nameOf(c.relative_to);
            const sameDay = isSameDay(c);
            const numberField = c.number_field ? nameOf(c.number_field) : "";
            const NA = "N/A";
            return (
              <section key={c.otc_field} className="rounded-xl border border-border bg-surface p-4">
                <h2 className="flex items-center gap-1 border-b border-border-soft pb-2 text-base font-bold text-ink">
                  {name}
                  <CopyIcon text={name} />
                </h2>
                {/* Laid out like Open to Close's date editor. */}
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Setting label="Days" value={sameDay ? "" : c.days !== null ? String(c.days) : ""} />
                  <Setting label="Type" value={label(TIME_FRAMES, c.time_frame)} />
                  <Setting label="When" value={sameDay ? "" : label(DIRECTIONS, c.direction)} />
                  <Setting
                    label="Number Field"
                    value={numberField}
                    hint="Fallback field (if applicable)"
                    copy
                  />
                </div>
                <div className="mt-3 border-t border-border-soft pt-3">
                  <Setting label="Date Field Options" value={from} copy />
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 border-t border-border-soft pt-3 sm:grid-cols-3">
                  <Setting label="Weekend Roll" value={label(ROLLS, c.weekend_roll) || NA} plain />
                  <Setting label="Federal Holiday Roll" value={label(ROLLS, c.holiday_roll) || NA} plain />
                  <Setting
                    label="Skip Federal Holidays"
                    value={c.federal_holidays === "skip" ? "Yes" : c.federal_holidays === "count" ? "No" : NA}
                    plain
                  />
                </div>
              </section>
            );
          })}
        </div>
      );
  }

  return (
    <SetupShell
      lesson={lesson}
      fallbackTitle="Date Setup"
      wide
      blurb="Your date template, laid out the way you'll build it in Open to Close: each calculated date with its days, time frame, before or after, and the date it counts from. Copy any name to paste it into Open to Close."
    >
      {content}
    </SetupShell>
  );
}

// One setting, labeled like Open to Close's date editor (red for the ones
// that set the calculation, plain for the rolls), with its value.
function Setting({
  label: name,
  value,
  hint,
  copy = false,
  plain = false,
}: {
  label: string;
  value: string;
  hint?: string;
  copy?: boolean;
  plain?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className={`text-xs font-semibold ${plain ? "text-ink" : "text-danger"}`}>{name}</span>
      <span className="flex min-h-9 items-center gap-1 rounded-lg border border-border bg-bg px-3 py-1.5 text-sm">
        {value ? (
          <>
            <span className="min-w-0 truncate text-ink" title={value}>
              {value}
            </span>
            {copy && <CopyIcon text={value} />}
          </>
        ) : (
          <span className="text-ink-faint">&mdash;</span>
        )}
      </span>
      {hint && <span className="text-[11px] text-ink-faint">{hint}</span>}
    </div>
  );
}
