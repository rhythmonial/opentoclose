"use client";

import { useEffect, useRef, useState } from "react";
import {
  ACCEPTANCE_DATE_ID,
  calcComplete,
  DIRECTIONS,
  emptyCalc,
  FEDERAL_HOLIDAYS,
  isSameDay,
  ROLLS,
  TIME_FRAMES,
  type DateCalc,
} from "@/lib/dateCalculations";
import type { DateOption, DateRow } from "@/lib/dateRows";
import { NEW_OTC_PREFIX } from "@/lib/workflowFields";
import { removeAddedDate, saveDateCalc } from "@/app/configurator/select_your_date_fields/actions";

export type NumberOption = DateOption & { group: "contract" | "selected" | "other" };

const cellSelect =
  "w-full min-w-[7rem] rounded-md border border-border bg-bg px-1.5 py-1 text-xs text-ink outline-none focus:border-accent disabled:cursor-not-allowed disabled:opacity-40";

// Select Your Date Fields, as tables: the hard dates on the client's
// contracts (nothing to work out), the dates their contract's days fields
// set, the dates and days fields they chose in Finalize Your Fields, dates
// they added here, and the rest of Open to Close's dates to pick from. Each
// worked-out date says what OTC's Date Calculation asks: so many days (a
// set number, or a days field) of which time frame, after or before which
// date (or the same day as it), and how weekends and federal holidays move
// it. A summary of every worked-out date closes the page.
export function DateFieldsConfigurator({
  accountId,
  rows: initialRows,
  dates: initialDates,
  numbers,
  initial,
  auto,
}: {
  // The client account (staff only; clients use their own).
  accountId: string | null;
  rows: DateRow[];
  dates: DateOption[];
  numbers: NumberOption[];
  initial: DateCalc[];
  // Calculations to save on arrival (days fields' dates filled in, hard
  // dates switched off).
  auto: DateCalc[];
}) {
  const [saveState, setSaveState] = useState<"saving" | "saved" | "error" | null>(null);
  const [rows, setRows] = useState(initialRows);
  const [dates, setDates] = useState(initialDates);
  const [newDate, setNewDate] = useState("");
  const [query, setQuery] = useState("");
  const [calcs, setCalcs] = useState(
    () => new Map([...initial, ...auto].map((c) => [c.otc_field, c] as const)),
  );
  const savedAuto = useRef(false);
  useEffect(() => {
    if (savedAuto.current || auto.length === 0) return;
    savedAuto.current = true;
    void Promise.all(auto.map((c) => saveDateCalc(accountId, c))).then((results) =>
      setSaveState(results.every((r) => r.ok) ? "saved" : "error"),
    );
  }, [auto, accountId]);
  const timers = useRef(new Map<string, number>());

  const calcFor = (id: string) => calcs.get(id) ?? emptyCalc(id);
  const nameOf = (id: string | null) => dates.find((d) => d.id === id)?.name ?? "";
  const numberName = (id: string | null) => numbers.find((n) => n.id === id)?.name ?? "";
  const worked = rows.filter((r) => r.group !== "contract" && calcFor(r.id).enabled);
  const incomplete = worked.filter((r) => !calcComplete(calcFor(r.id))).length;

  // How a date is worked out, in words: "30 Calendar Day(s) After
  // Acceptance Date".
  function describe(c: DateCalc) {
    const relative = nameOf(c.relative_to) || "__";
    if (isSameDay(c)) return `Same Day As ${relative}`;
    const days = c.days_on_contract ? `[${numberName(c.number_field) || "days field"}]` : (c.days ?? "__");
    return [
      days,
      TIME_FRAMES.find((t) => t.value === c.time_frame)?.label ?? "__",
      DIRECTIONS.find((t) => t.value === c.direction)?.label ?? "__",
      relative,
    ].join(" ");
  }
  const extrasFor = (c: DateCalc) =>
    [
      c.weekend_roll && `Weekends: ${ROLLS.find((r) => r.value === c.weekend_roll)!.label}`,
      c.holiday_roll && `Federal holidays: ${ROLLS.find((r) => r.value === c.holiday_roll)!.label}`,
      c.federal_holidays && FEDERAL_HOLIDAYS.find((r) => r.value === c.federal_holidays)!.label,
    ].filter(Boolean) as string[];

  function update(id: string, change: Partial<DateCalc>) {
    const next = { ...calcFor(id), ...change };
    setCalcs((all) => new Map(all).set(id, next));
    // Save shortly after the last change to this date.
    const old = timers.current.get(id);
    if (old) window.clearTimeout(old);
    setSaveState("saving");
    timers.current.set(
      id,
      window.setTimeout(async () => {
        timers.current.delete(id);
        const result = await saveDateCalc(accountId, next);
        setSaveState(result.ok ? (timers.current.size > 0 ? "saving" : "saved") : "error");
      }, 500),
    );
  }

  // Checking a date to work out fills in what's usual: so many calendar
  // days after the Acceptance Date.
  function check(id: string, on: boolean) {
    const c = calcFor(id);
    update(id, {
      enabled: on,
      ...(on && !c.relative_to && id !== ACCEPTANCE_DATE_ID ? { relative_to: ACCEPTANCE_DATE_ID } : {}),
      ...(on && !c.direction ? { direction: "after" as const } : {}),
      ...(on && !c.time_frame ? { time_frame: "calendar_days" as const } : {}),
    });
  }

  function addDate() {
    const name = newDate.trim();
    if (!name) return;
    const existing = dates.find((d) => d.name.toLowerCase() === name.toLowerCase());
    setNewDate("");
    if (existing) {
      if (rows.find((r) => r.id === existing.id)?.group === "other") check(existing.id, true);
      return;
    }
    const id = `${NEW_OTC_PREFIX}${crypto.randomUUID()}`;
    const d = { id, name, section: "Dates you added" };
    setDates((all) => [...all, d]);
    setRows((all) => [...all, { ...d, group: "other", added: true }]);
    update(id, {
      field_name: name,
      enabled: true,
      relative_to: ACCEPTANCE_DATE_ID,
      direction: "after",
      time_frame: "calendar_days",
    });
  }

  async function removeDate(id: string) {
    setRows((all) => all.filter((r) => r.id !== id));
    setDates((all) => all.filter((d) => d.id !== id));
    setCalcs((all) => {
      const next = new Map(all);
      next.delete(id);
      return next;
    });
    // Dates counted from it need another.
    for (const c of calcs.values()) {
      if (c.relative_to === id) update(c.otc_field, { relative_to: null });
    }
    await removeAddedDate(accountId, id);
  }

  const q = query.trim().toLowerCase();
  const matches = (r: DateRow) => !q || r.name.toLowerCase().includes(q) || r.section.toLowerCase().includes(q);
  const contract = rows.filter((r) => r.group === "contract" && matches(r));
  const calculated = rows.filter((r) => r.group === "calculated" && matches(r));
  const selected = rows.filter((r) => r.group === "selected" && matches(r));
  // A date picked from the rest (or typed in) moves up to "Dates you added".
  const added = rows.filter((r) => r.group === "other" && (r.added || calcFor(r.id).enabled) && matches(r));
  const other = rows.filter((r) => r.group === "other" && !r.added && !calcFor(r.id).enabled && matches(r));

  // "From" choices, grouped like the page.
  const fromGroups: [string, DateOption[]][] = [
    ["Contract dates", rows.filter((r) => r.group === "contract")],
    ["Calculated from your contract", rows.filter((r) => r.group === "calculated")],
    ["Your other dates", rows.filter((r) => r.group === "selected" || (r.group === "other" && (r.added || calcFor(r.id).enabled)))],
    ["Other Open to Close dates", rows.filter((r) => r.group === "other" && !r.added && !calcFor(r.id).enabled)],
  ];
  const numberGroups: [string, NumberOption[]][] = [
    ["On your contracts", numbers.filter((n) => n.group === "contract")],
    ["Your fields", numbers.filter((n) => n.group === "selected")],
    ["Other Open to Close fields", numbers.filter((n) => n.group === "other")],
  ];

  function calcRow(r: DateRow, opts: { optional: boolean }) {
    const c = calcFor(r.id);
    const on = c.enabled;
    const sameDay = isSameDay(c);
    const bad = (v: unknown) => on && (v === null || v === "");
    const ring = (b: boolean) => (b ? "border-danger" : "");
    return (
      <tr key={r.id} className={on ? "" : "text-ink-faint"}>
        <td className="px-2 py-1.5 align-middle">
          {opts.optional ? (
            <input
              type="checkbox"
              checked={on}
              onChange={(e) => check(r.id, e.target.checked)}
              aria-label={`Work out ${r.name}`}
              className="h-4 w-4"
            />
          ) : (
            <span aria-hidden className="text-accent">
              &#10003;
            </span>
          )}
        </td>
        <td className="max-w-[14rem] px-2 py-1.5">
          <span className="block truncate font-medium text-ink" title={r.name}>
            {r.name}
          </span>
          <span className="block truncate text-[11px] text-ink-faint">
            {r.section}
            {r.added && (
              <button
                type="button"
                onClick={() => removeDate(r.id)}
                className="ml-2 font-semibold text-ink-faint hover:text-danger"
              >
                Remove
              </button>
            )}
          </span>
        </td>
        {on ? (
          <>
            <td className="px-1 py-1.5">
              <div className="flex items-center gap-1">
                <select
                  disabled={sameDay}
                  value={c.days_on_contract ? (c.number_field ?? "") : "__fixed"}
                  onChange={(e) =>
                    update(
                      r.id,
                      e.target.value === "__fixed"
                        ? { days_on_contract: false, number_field: null }
                        : { days_on_contract: true, number_field: e.target.value || null },
                    )
                  }
                  aria-label={`Days for ${r.name}`}
                  className={`${cellSelect} ${ring(!sameDay && c.days_on_contract && bad(c.number_field))}`}
                >
                  <option value="__fixed">A set number</option>
                  {c.days_on_contract && !c.number_field && <option value="">Choose a days field</option>}
                  {numberGroups.map(([label, items]) =>
                    items.length === 0 ? null : (
                      <optgroup key={label} label={label}>
                        {items.map((n) => (
                          <option key={n.id} value={n.id}>
                            {n.name}
                          </option>
                        ))}
                      </optgroup>
                    ),
                  )}
                </select>
                {!c.days_on_contract && (
                  <input
                    disabled={sameDay}
                    type="number"
                    min={0}
                    max={3650}
                    inputMode="numeric"
                    placeholder="#"
                    value={c.days ?? ""}
                    onChange={(e) =>
                      update(r.id, {
                        days: e.target.value === "" ? null : Math.max(0, Math.trunc(Number(e.target.value))),
                      })
                    }
                    aria-label={`Number of days for ${r.name}`}
                    className={`${cellSelect} !min-w-0 w-14 ${ring(!sameDay && bad(c.days))}`}
                  />
                )}
              </div>
            </td>
            <td className="px-1 py-1.5">
              <select
                value={c.time_frame ?? ""}
                onChange={(e) => update(r.id, { time_frame: (e.target.value || null) as DateCalc["time_frame"] })}
                aria-label={`Type for ${r.name}`}
                className={`${cellSelect} ${ring(bad(c.time_frame))}`}
              >
                <option value="">Choose</option>
                {TIME_FRAMES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </td>
            <td className="px-1 py-1.5">
              <select
                disabled={sameDay}
                value={c.direction ?? ""}
                onChange={(e) => update(r.id, { direction: (e.target.value || null) as DateCalc["direction"] })}
                aria-label={`When for ${r.name}`}
                className={`${cellSelect} !min-w-[5rem] ${ring(!sameDay && bad(c.direction))}`}
              >
                <option value="">Choose</option>
                {DIRECTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </td>
            <td className="px-1 py-1.5">
              <select
                value={c.relative_to ?? ""}
                onChange={(e) => update(r.id, { relative_to: e.target.value || null })}
                aria-label={`Date ${r.name} counts from`}
                className={`${cellSelect} !min-w-[9rem] ${ring(bad(c.relative_to))}`}
              >
                <option value="">Choose a date</option>
                {fromGroups.map(([label, items]) =>
                  items.filter((o) => o.id !== r.id).length === 0 ? null : (
                    <optgroup key={label} label={label}>
                      {items
                        .filter((o) => o.id !== r.id)
                        .map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                          </option>
                        ))}
                    </optgroup>
                  ),
                )}
              </select>
            </td>
            {(
              [
                ["weekend_roll", "Weekends", ROLLS],
                ["holiday_roll", "Federal holidays", ROLLS],
                ["federal_holidays", "Skip federal holidays", FEDERAL_HOLIDAYS],
              ] as const
            ).map(([key, label, choices]) => (
              <td key={key} className="px-1 py-1.5">
                <select
                  value={c[key] ?? ""}
                  onChange={(e) => update(r.id, { [key]: e.target.value || null })}
                  aria-label={`${label} for ${r.name}`}
                  className={`${cellSelect} !min-w-[6rem]`}
                >
                  <option value="">N/A</option>
                  {choices.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </td>
            ))}
          </>
        ) : (
          <td colSpan={7} className="px-2 py-1.5 text-xs">
            {opts.optional && r.group === "selected"
              ? "Entered by hand. Check it if it's worked out from another date."
              : ""}
          </td>
        )}
      </tr>
    );
  }

  function calcTable(title: string, help: string, items: DateRow[], opts: { optional: boolean }) {
    if (items.length === 0) return null;
    return (
      <section className="flex flex-col gap-1.5">
        <h2 className="text-sm font-bold text-ink">
          {title} <span className="font-normal text-ink-faint">({items.length})</span>
        </h2>
        <p className="text-xs text-ink-soft">{help}</p>
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full min-w-[60rem] text-left text-sm">
            <thead className="bg-bg text-xs text-ink-soft">
              <tr>
                <th className="w-8 px-2 py-2" />
                <th className="px-2 py-2 font-semibold">Date</th>
                <th className="px-1 py-2 font-semibold">Days</th>
                <th className="px-1 py-2 font-semibold">Type</th>
                <th className="px-1 py-2 font-semibold">When</th>
                <th className="px-1 py-2 font-semibold">From date</th>
                <th className="px-1 py-2 font-semibold">Weekends</th>
                <th className="px-1 py-2 font-semibold">Federal holidays</th>
                <th className="px-1 py-2 font-semibold">Skip federal holidays</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {/* A days field's date is always worked out. */}
              {items.map((r) => calcRow(r, { optional: opts.optional && !r.numberField }))}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search dates"
          aria-label="Search dates"
          className="w-56 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-accent"
        />
        <span className="text-xs text-ink-faint">
          {worked.length} date{worked.length === 1 ? "" : "s"} worked out
          {incomplete > 0 && <span className="font-semibold text-danger"> &middot; {incomplete} to finish</span>}
          {saveState === "saving" && " · Saving…"}
          {saveState === "saved" && " · Saved"}
          {saveState === "error" && <span className="text-danger"> · Couldn&rsquo;t save</span>}
        </span>
      </div>

      {contract.length > 0 && (
        <section className="flex flex-col gap-1.5">
          <h2 className="text-sm font-bold text-ink">
            Contract dates <span className="font-normal text-ink-faint">({contract.length})</span>
          </h2>
          <p className="text-xs text-ink-soft">
            Dates written on your contract. They&rsquo;re entered as they are, so there&rsquo;s nothing
            to work out, but other dates can count from them.
          </p>
          <div className="overflow-x-auto rounded-lg border border-border bg-surface">
            <table className="w-full text-left text-sm">
              <thead className="bg-bg text-xs text-ink-soft">
                <tr>
                  <th className="px-3 py-2 font-semibold">Date</th>
                  <th className="px-3 py-2 font-semibold">Section</th>
                  <th className="px-3 py-2 font-semibold">How it&rsquo;s set</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {contract.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2 font-medium text-ink">{r.name}</td>
                    <td className="px-3 py-2 text-ink-soft">{r.section}</td>
                    <td className="px-3 py-2 text-ink-soft">Entered from the contract</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {calcTable(
        "Calculated from your contract",
        "Each days field on your contract sets a date. Say how it's counted; the days come from the contract.",
        calculated,
        { optional: false },
      )}
      {calcTable(
        "Your other dates",
        "Dates and days fields you chose in Finalize Your Fields. A days field's date is always worked out; check a date if it's worked out from another date.",
        selected,
        { optional: true },
      )}
      {calcTable(
        "Dates you added",
        "Dates you checked below or typed in.",
        added,
        { optional: true },
      )}

      <section className="flex flex-col gap-1.5">
        <h2 className="text-sm font-bold text-ink">
          Other Open to Close dates <span className="font-normal text-ink-faint">({other.length})</span>
        </h2>
        <p className="text-xs text-ink-soft">
          Check any other date your team works out. It moves up to Dates you added.
        </p>
        {other.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <table className="w-full text-left text-sm">
              <tbody className="divide-y divide-border">
                {other.map((r) => (
                  <tr key={r.id}>
                    <td className="w-8 px-2 py-1.5">
                      <input
                        type="checkbox"
                        checked={false}
                        onChange={() => check(r.id, true)}
                        aria-label={`Work out ${r.name}`}
                        className="h-4 w-4"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-ink">{r.name}</td>
                    <td className="px-2 py-1.5 text-xs text-ink-faint">{r.section}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <form
          className="mt-1 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border bg-surface px-4 py-3"
          onSubmit={(e) => {
            e.preventDefault();
            addDate();
          }}
        >
          <span className="text-sm font-semibold text-ink">Don&rsquo;t see a date?</span>
          <input
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            maxLength={120}
            placeholder="e.g. Survey Due Date"
            aria-label="New date name"
            className="w-64 rounded-lg border border-border bg-bg px-3 py-1.5 text-sm text-ink outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={!newDate.trim()}
            className="rounded-lg bg-accent px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Add date
          </button>
        </form>
      </section>

      <DateSummary
        rows={worked.map((r) => ({ date: r, calc: calcFor(r.id) }))}
        describe={describe}
        extrasFor={extrasFor}
      />
    </div>
  );
}

// Every worked-out date and how, at the bottom of the page.
function DateSummary({
  rows,
  describe,
  extrasFor,
}: {
  rows: { date: DateRow; calc: DateCalc }[];
  describe: (c: DateCalc) => string;
  extrasFor: (c: DateCalc) => string[];
}) {
  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h2 className="font-display text-lg font-bold text-ink">Your date summary</h2>
      <p className="mt-1 text-sm text-ink-soft">Every date that&rsquo;s worked out, and how.</p>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-ink-faint">No dates worked out yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
          {rows.map(({ date, calc }) => {
            const extras = extrasFor(calc);
            return (
              <li key={date.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="font-semibold text-ink">{date.name}</span> = {describe(calc)}
                  {extras.length > 0 && <span className="text-ink-faint"> &middot; {extras.join(" · ")}</span>}
                </span>
                {!calcComplete(calc) && <span className="text-xs font-semibold text-danger">Needs finishing</span>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
