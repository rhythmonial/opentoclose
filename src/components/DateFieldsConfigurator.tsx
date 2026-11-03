"use client";

import { useEffect, useRef, useState } from "react";
import {
  calcComplete,
  DIRECTIONS,
  emptyCalc,
  FEDERAL_HOLIDAYS,
  isSameDay,
  matchingNumberField,
  ROLLS,
  TIME_FRAMES,
  type DateCalc,
} from "@/lib/dateCalculations";
import { NEW_OTC_PREFIX } from "@/lib/workflowFields";
import { removeAddedDate, saveDateCalc } from "@/app/configurator/select_your_date_fields/actions";

export type FieldOption = {
  id: string;
  name: string;
  section: string;
  // Assigned to a field on one of the client's contracts.
  onContract: boolean;
  // A date the client added here.
  added?: boolean;
};

const inputClass =
  "w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent disabled:cursor-not-allowed";

// Select Your Date Fields: every Open to Close date field, faded until it's
// checked. A checked date asks what OTC's Date Calculation asks: so many
// days (a set number, or a blank on the contract recorded as the number
// field it goes in) of which time frame, after or before which other date
// (or the same day as it), and how weekends and federal holidays move it.
// Clients can add dates that aren't listed, and a summary of every checked
// date closes the page.
export function DateFieldsConfigurator({
  accountId,
  dates: initialDates,
  numbers,
  initial,
}: {
  // The client account (staff only; clients use their own).
  accountId: string | null;
  dates: FieldOption[];
  numbers: FieldOption[];
  initial: DateCalc[];
}) {
  const [saveState, setSaveState] = useState<"saving" | "saved" | "error" | null>(null);
  const [dates, setDates] = useState(initialDates);
  const [newDate, setNewDate] = useState("");
  // When a date's days are a blank on the client's contract (its "- Days"
  // number field was assigned in their field prep), say so.
  const blankFromContract = (date: FieldOption): Partial<DateCalc> => {
    const number = matchingNumberField(date.name, numbers);
    return number?.onContract ? { days_on_contract: true, number_field: number.id } : {};
  };
  // Dates on the client's contracts start checked (unless they've already
  // decided), so they don't have to select them.
  const [auto] = useState(() => {
    const saved = new Set(initial.map((c) => c.otc_field));
    return initialDates
      .filter((d) => d.onContract && !saved.has(d.id))
      .map((d) => ({ ...emptyCalc(d.id), enabled: true, ...blankFromContract(d) }));
  });
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
  const [query, setQuery] = useState("");
  const [onlyChecked, setOnlyChecked] = useState(false);
  const timers = useRef(new Map<string, number>());

  const calcFor = (id: string) => calcs.get(id) ?? emptyCalc(id);
  const checked = [...calcs.values()].filter((c) => c.enabled);
  const incomplete = checked.filter((c) => !calcComplete(c)).length;
  const nameOf = (id: string | null) => dates.find((d) => d.id === id)?.name ?? "";
  const numberName = (id: string | null) => numbers.find((n) => n.id === id)?.name ?? "";

  // How a date is worked out, in words: "Closing Date = 30 Calendar Day(s)
  // After Acceptance Date".
  function describe(c: DateCalc) {
    const relative = nameOf(c.relative_to) || "__";
    if (isSameDay(c)) return `Same Day As ${relative}`;
    const days = c.days_on_contract
      ? `[${numberName(c.number_field) || "number field"}]`
      : (c.days ?? "__");
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

  function addDate() {
    const name = newDate.trim();
    if (!name) return;
    if (dates.some((d) => d.name.toLowerCase() === name.toLowerCase())) {
      setQuery(name);
      setNewDate("");
      return;
    }
    const id = `${NEW_OTC_PREFIX}${crypto.randomUUID()}`;
    setDates((all) => [...all, { id, name, section: "Dates you added", onContract: false, added: true }]);
    setNewDate("");
    update(id, { enabled: true, field_name: name });
  }

  async function removeDate(id: string) {
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

  const q = query.trim().toLowerCase();
  const shown = dates.filter(
    (d) =>
      (!onlyChecked || calcFor(d.id).enabled) &&
      (!q || d.name.toLowerCase().includes(q) || d.section.toLowerCase().includes(q)),
  );
  const groups: [string, FieldOption[]][] = [
    ["Dates on your contracts", shown.filter((d) => d.onContract && !d.added)],
    ["Dates you added", shown.filter((d) => d.added)],
    ["Other Open to Close dates", shown.filter((d) => !d.onContract && !d.added)],
  ];

  const optionGroups = (options: FieldOption[], exclude?: string) => (
    <>
      <optgroup label="On your contracts">
        {options
          .filter((o) => o.onContract && !o.added && o.id !== exclude)
          .map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
      </optgroup>
      {options.some((o) => o.added && o.id !== exclude) && (
        <optgroup label="Dates you added">
          {options
            .filter((o) => o.added && o.id !== exclude)
            .map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
        </optgroup>
      )}
      <optgroup label="Other Open to Close fields">
        {options
          .filter((o) => !o.onContract && !o.added && o.id !== exclude)
          .map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
      </optgroup>
    </>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search dates"
            aria-label="Search dates"
            className="w-56 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-accent"
          />
          <label className="flex items-center gap-1.5 text-sm text-ink-soft">
            <input
              type="checkbox"
              checked={onlyChecked}
              onChange={(e) => setOnlyChecked(e.target.checked)}
            />
            Show only checked dates
          </label>
        </div>
        <span className="text-xs text-ink-faint">
          {checked.length} date{checked.length === 1 ? "" : "s"} checked
          {incomplete > 0 && (
            <span className="font-semibold text-danger"> &middot; {incomplete} to finish</span>
          )}
          {saveState === "saving" && " · Saving…"}
          {saveState === "saved" && " · Saved"}
          {saveState === "error" && <span className="text-danger"> · Couldn&rsquo;t save</span>}
        </span>
      </div>

      {groups.map(([title, items]) =>
        items.length === 0 ? null : (
          <section key={title} className="flex flex-col gap-3">
            <h2 className="text-xs font-bold uppercase tracking-wide text-ink-faint">{title}</h2>
            {items.map((d) => {
              const c = calcFor(d.id);
              const on = c.enabled;
              const sameDay = isSameDay(c);
              const missing = (v: unknown) => on && (v === null || v === "");
              // Days and When don't apply to "Same Day As".
              const missingCount = (v: unknown) => !sameDay && missing(v);
              const labelClass = (bad: boolean) =>
                `text-xs font-semibold ${bad ? "text-danger" : "text-ink-soft"}`;
              const extras = extrasFor(c);
              return (
                <div
                  key={d.id}
                  className={`rounded-xl border bg-surface p-4 transition-colors ${
                    on ? "border-accent/50 shadow-sm" : "border-border"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                    <label className="flex cursor-pointer flex-wrap items-center gap-x-2 gap-y-1">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={(e) =>
                          update(d.id, {
                            enabled: e.target.checked,
                            // Checking a date for the first time fills in its
                            // days from the contract, when they're a blank there.
                            ...(e.target.checked &&
                            c.days === null &&
                            !c.days_on_contract &&
                            !c.number_field
                              ? blankFromContract(d)
                              : {}),
                          })
                        }
                        className="h-4 w-4"
                      />
                      <span className={`font-semibold ${on ? "text-ink" : "text-ink-faint"}`}>
                        {d.name}
                      </span>
                      {d.onContract && (
                        <span className="rounded bg-gold/20 px-1 py-px text-[10px] font-bold uppercase text-ink">
                          On your contract
                        </span>
                      )}
                      {d.added && (
                        <span className="rounded bg-accent-soft/60 px-1 py-px text-[10px] font-bold uppercase text-accent">
                          Added by you
                        </span>
                      )}
                    </label>
                    {d.added && (
                      <button
                        type="button"
                        onClick={() => removeDate(d.id)}
                        className="mr-auto text-xs font-semibold text-ink-faint hover:text-danger"
                      >
                        Remove
                      </button>
                    )}
                    <label
                      className={`flex items-center gap-2 transition-opacity ${on ? "" : "opacity-40"}`}
                    >
                      <span className={`whitespace-nowrap ${labelClass(missing(c.relative_to))}`}>
                        Date Field
                      </span>
                      <select
                        disabled={!on}
                        value={c.relative_to ?? ""}
                        onChange={(e) => update(d.id, { relative_to: e.target.value || null })}
                        className={`${inputClass} w-60 py-1.5`}
                      >
                        <option value="">Choose Date Field</option>
                        {optionGroups(dates, d.id)}
                      </select>
                    </label>
                  </div>

                  {/* Faded and locked until the date is checked. */}
                  <fieldset
                    disabled={!on}
                    aria-label={`How ${d.name} is calculated`}
                    className={`mt-3 flex flex-col gap-3 transition-opacity ${on ? "" : "opacity-40"}`}
                  >
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      {c.days_on_contract ? (
                        <label className="flex flex-col gap-1">
                          <span className={labelClass(missingCount(c.number_field))}>
                            Number Field
                          </span>
                          <select
                            disabled={sameDay}
                            value={c.number_field ?? ""}
                            onChange={(e) => update(d.id, { number_field: e.target.value || null })}
                            className={inputClass}
                          >
                            <option value="">Choose Field</option>
                            {optionGroups(numbers)}
                          </select>
                        </label>
                      ) : (
                        <label className="flex flex-col gap-1">
                          <span className={labelClass(missingCount(c.days))}>Days</span>
                          <input
                            disabled={sameDay}
                            type="number"
                            min={0}
                            max={3650}
                            inputMode="numeric"
                            placeholder="1"
                            value={c.days ?? ""}
                            onChange={(e) =>
                              update(d.id, {
                                days: e.target.value === "" ? null : Math.max(0, Math.trunc(Number(e.target.value))),
                              })
                            }
                            className={inputClass}
                          />
                        </label>
                      )}
                      <label className="flex flex-col gap-1">
                        <span className={labelClass(missing(c.time_frame))}>Type</span>
                        <select
                          value={c.time_frame ?? ""}
                          onChange={(e) =>
                            update(d.id, {
                              time_frame: (e.target.value || null) as DateCalc["time_frame"],
                            })
                          }
                          className={inputClass}
                        >
                          <option value="">Choose Time Frame</option>
                          {TIME_FRAMES.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className={labelClass(missingCount(c.direction))}>When</span>
                        <select
                          disabled={sameDay}
                          value={c.direction ?? ""}
                          onChange={(e) =>
                            update(d.id, {
                              direction: (e.target.value || null) as DateCalc["direction"],
                            })
                          }
                          className={inputClass}
                        >
                          <option value="">Choose When</option>
                          {DIRECTIONS.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <label className="flex w-fit items-center gap-2 text-sm text-ink-soft">
                      <input
                        type="checkbox"
                        disabled={sameDay}
                        checked={c.days_on_contract}
                        onChange={(e) =>
                          update(d.id, {
                            days_on_contract: e.target.checked,
                            // Start from the number field that usually holds
                            // this date's days, if there is one.
                            ...(e.target.checked && !c.number_field
                              ? { number_field: matchingNumberField(d.name, numbers)?.id ?? null }
                              : {}),
                          })
                        }
                      />
                      The days are a blank line on the contract that the agent fills in
                    </label>

                    <div className="grid grid-cols-1 gap-3 border-t border-border pt-3 sm:grid-cols-3">
                      {(
                        [
                          ["weekend_roll", "Weekend Roll", ROLLS],
                          ["holiday_roll", "Federal Holiday Roll", ROLLS],
                          ["federal_holidays", "Skip Federal Holidays", FEDERAL_HOLIDAYS],
                        ] as const
                      ).map(([key, label, choices]) => (
                        <label key={key} className="flex flex-col gap-1">
                          <span className={labelClass(false)}>{label}</span>
                          <select
                            value={c[key] ?? ""}
                            onChange={(e) => update(d.id, { [key]: e.target.value || null })}
                            className={inputClass}
                          >
                            <option value="">N/A</option>
                            {choices.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      ))}
                    </div>

                    {on && (
                      <p className="text-sm text-ink-soft">
                        <span className="font-semibold text-ink">{d.name}</span> = {describe(c)}
                        {extras.length > 0 && (
                          <span className="text-ink-faint"> &middot; {extras.join(" · ")}</span>
                        )}
                      </p>
                    )}
                  </fieldset>
                </div>
              );
            })}
          </section>
        ),
      )}
      {shown.length === 0 && (
        <p className="rounded-xl border border-border bg-surface p-5 text-sm text-ink-faint">
          No dates match.
        </p>
      )}

      <form
        className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-border bg-surface px-4 py-3"
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

      <DateSummary
        rows={dates
          .filter((d) => calcFor(d.id).enabled)
          .map((d) => ({ date: d, calc: calcFor(d.id) }))}
        describe={describe}
        extrasFor={extrasFor}
        onRemove={removeDate}
      />
    </div>
  );
}

// Every checked date and how it's worked out, at the bottom of the page.
function DateSummary({
  rows,
  describe,
  extrasFor,
  onRemove,
}: {
  rows: { date: FieldOption; calc: DateCalc }[];
  describe: (c: DateCalc) => string;
  extrasFor: (c: DateCalc) => string[];
  onRemove: (id: string) => void;
}) {
  return (
    <section className="mt-2 rounded-xl border border-border bg-surface p-5">
      <h2 className="font-display text-lg font-bold text-ink">Your date summary</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Every date you&rsquo;ve checked and how it&rsquo;s worked out.
      </p>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-ink-faint">No dates checked yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
          {rows.map(({ date, calc }) => {
            const done = calcComplete(calc);
            const extras = extrasFor(calc);
            return (
              <li key={date.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="font-semibold text-ink">{date.name}</span>
                  {date.added && <span className="text-xs text-ink-faint"> (added by you)</span>}
                  <span className="block text-ink-soft">
                    {describe(calc)}
                    {extras.length > 0 && <span className="text-ink-faint"> &middot; {extras.join(" · ")}</span>}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  {!done && <span className="text-xs font-semibold text-danger">Needs finishing</span>}
                  {date.added && (
                    <button
                      type="button"
                      onClick={() => onRemove(date.id)}
                      className="text-xs font-semibold text-ink-faint hover:text-danger"
                    >
                      Remove date
                    </button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
