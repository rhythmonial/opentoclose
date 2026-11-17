import { OTC_FIELDS, cleanCustomFields, type OtcField } from "@/lib/otcFields";
import { isActive, newOtcFieldsFrom, otcTargetOf, type WorkflowField } from "@/lib/workflowFields";
import {
  DIRECTIONS,
  FEDERAL_HOLIDAYS,
  ROLLS,
  TIME_FRAMES,
  cleanCalc,
  isSameDay,
  type DateCalc,
} from "@/lib/dateCalculations";
import { inUploadOrder } from "@/lib/docOrder";
import type { ContractBlank } from "@/lib/contractBlanks";
import { inContractOrder } from "@/components/WorkflowFieldsSummary";
import { CopyButton } from "@/components/CopyButton";
import { loadSetupLesson, SetupShell } from "../_setup/shell";

const label = (list: readonly { value: string; label: string }[], v: string | null) =>
  list.find((x) => x.value === v)?.label ?? "";

// Date Setup: their date template laid out the way it's built in Open to
// Close: each calculated date with its days (or the number field that holds
// them), time frame, before / after and the date it counts from, plus the
// weekend and holiday rules. Each name copies to paste into OTC.
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
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-border-soft bg-bg font-caption text-xs font-bold uppercase tracking-wide text-ink-faint">
                <th className="px-3 py-2.5">Date field</th>
                <th className="px-3 py-2.5">Days</th>
                <th className="px-3 py-2.5">Time frame</th>
                <th className="px-3 py-2.5">Before / After</th>
                <th className="px-3 py-2.5">Date field it counts from</th>
                <th className="px-3 py-2.5">Weekends &amp; holidays</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const name = nameOf(c.otc_field, c.field_name);
                const from = nameOf(c.relative_to);
                const sameDay = isSameDay(c);
                const days = c.number_field ? nameOf(c.number_field) : c.days !== null ? String(c.days) : "";
                return (
                  <tr key={c.otc_field} className="border-b border-border-soft align-top last:border-0">
                    <td className="px-3 py-2.5">
                      <span className="flex items-center gap-2">
                        <span className="font-semibold text-ink">{name}</span>
                        <CopyButton text={name} />
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-ink-soft">
                      {sameDay ? (
                        "—"
                      ) : (
                        <span className="flex items-center gap-2">
                          {days || "—"}
                          {c.number_field && <CopyButton text={days} />}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-ink-soft">{label(TIME_FRAMES, c.time_frame) || "—"}</td>
                    <td className="px-3 py-2.5 text-ink-soft">{sameDay ? "" : label(DIRECTIONS, c.direction)}</td>
                    <td className="px-3 py-2.5">
                      {from ? (
                        <span className="flex items-center gap-2">
                          <span className="text-ink">{from}</span>
                          <CopyButton text={from} />
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-ink-soft">
                      {[
                        c.weekend_roll && `Weekends: ${label(ROLLS, c.weekend_roll)}`,
                        c.holiday_roll && `Holidays: ${label(ROLLS, c.holiday_roll)}`,
                        c.federal_holidays && label(FEDERAL_HOLIDAYS, c.federal_holidays),
                      ]
                        .filter(Boolean)
                        .map((t) => (
                          <span key={String(t)} className="block">
                            {t}
                          </span>
                        ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
