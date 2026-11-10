import {
  ACCEPTANCE_DATE_ID,
  dateNameFor,
  emptyCalc,
  isDaysField,
  matchingDateField,
  type DateCalc,
} from "@/lib/dateCalculations";
import { NEW_OTC_PREFIX } from "@/lib/workflowFields";

// Select Your Date Fields, a group at a time:
// - "contract": hard dates written on the contract (nothing to work out),
// - "calculated": the date each days field on the contract sets,
// - "otc": the date each days field they chose in Finalize Your Fields sets,
// - "dates": the dates they chose there (worked out if they say so).
export type DateGroup = "contract" | "calculated" | "otc" | "dates";

export type DateOption = { id: string; name: string; section: string };

export type DateRow = DateOption & {
  group: DateGroup;
  // Worked out from this days field (always calculated).
  numberField?: string;
};

export function buildDateRows({
  dates,
  numbers,
  onContract,
  selected,
  saved,
}: {
  // Every date and number field there is (OTC's, and the client's own).
  dates: DateOption[];
  numbers: DateOption[];
  onContract: Set<string>;
  // Picked in Finalize Your Fields (their own fields too).
  selected: Set<string>;
  saved: DateCalc[];
}): { rows: DateRow[]; dates: DateOption[]; auto: DateCalc[] } {
  const rows: DateRow[] = [];
  const allDates = [...dates];
  const used = new Set<string>();
  const savedById = new Map(saved.map((c) => [c.otc_field, c] as const));
  const auto: DateCalc[] = [];

  for (const d of dates.filter((d) => onContract.has(d.id))) {
    rows.push({ ...d, group: "contract" });
    used.add(d.id);
    // Hard dates aren't worked out.
    const s = savedById.get(d.id);
    if (s?.enabled) auto.push({ ...s, enabled: false });
  }

  // The date each days field sets, worked out from it.
  const daysRows = (group: "calculated" | "otc", pick: (n: DateOption) => boolean) => {
    for (const n of numbers.filter((n) => pick(n) && isDaysField(n.name))) {
      let date: DateOption | null = matchingDateField(n.name, allDates);
      if (date && used.has(date.id)) continue;
      if (!date) {
        // A date of their own for it, kept from before or made now.
        const earlier = saved.find((c) => c.number_field === n.id && c.otc_field.startsWith(NEW_OTC_PREFIX));
        date = {
          id: earlier?.otc_field ?? `${NEW_OTC_PREFIX}${crypto.randomUUID()}`,
          name: earlier?.field_name ?? dateNameFor(n.name),
          section: n.section,
        };
        allDates.push(date);
      }
      rows.push({ ...date, group, numberField: n.id });
      used.add(date.id);
      const s = savedById.get(date.id);
      if (!s?.enabled || s.number_field !== n.id) {
        auto.push({
          ...(s ?? emptyCalc(date.id)),
          enabled: true,
          days_on_contract: true,
          number_field: n.id,
          time_frame: s?.time_frame ?? "calendar_days",
          direction: s?.direction ?? "after",
          relative_to: s?.relative_to ?? (date.id === ACCEPTANCE_DATE_ID ? null : ACCEPTANCE_DATE_ID),
          ...(date.id.startsWith(NEW_OTC_PREFIX) ? { field_name: date.name } : {}),
        });
      }
    }
  };
  daysRows("calculated", (n) => onContract.has(n.id));
  daysRows("otc", (n) => selected.has(n.id) && !onContract.has(n.id));

  for (const d of dates.filter((d) => selected.has(d.id) && !used.has(d.id))) {
    rows.push({ ...d, group: "dates" });
    used.add(d.id);
  }

  // Dates that aren't on the page any more (ones they didn't pick, or typed
  // in here before) aren't worked out.
  for (const c of saved) {
    if (c.enabled && !used.has(c.otc_field)) auto.push({ ...c, enabled: false });
  }
  return { rows, dates: allDates, auto };
}
