"use client";

import { useRef, useState } from "react";
import {
  calcComplete,
  DIRECTIONS,
  emptyCalc,
  matchingNumberField,
  TIME_FRAMES,
  type DateCalc,
} from "@/lib/dateCalculations";
import { saveDateCalc } from "@/app/configurator/select_your_date_fields/actions";

export type FieldOption = {
  id: string;
  name: string;
  section: string;
  // Assigned to a field on one of the client's contracts.
  onContract: boolean;
};

const inputClass =
  "w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent disabled:cursor-not-allowed";

// Select Your Date Fields: every Open to Close date field, faded until it's
// checked. A checked date asks how it's calculated: so many days (a set
// number, or a blank on the contract recorded as the number field it goes
// in), calendar or business days, before or after which other date.
export function DateFieldsConfigurator({
  accountId,
  dates,
  numbers,
  initial,
}: {
  // The client account (staff only; clients use their own).
  accountId: string | null;
  dates: FieldOption[];
  numbers: FieldOption[];
  initial: DateCalc[];
}) {
  const [calcs, setCalcs] = useState(
    () => new Map(initial.map((c) => [c.otc_field, c] as const)),
  );
  const [query, setQuery] = useState("");
  const [onlyChecked, setOnlyChecked] = useState(false);
  const [saveState, setSaveState] = useState<"saving" | "saved" | "error" | null>(null);
  const timers = useRef(new Map<string, number>());

  const calcFor = (id: string) => calcs.get(id) ?? emptyCalc(id);
  const checked = [...calcs.values()].filter((c) => c.enabled);
  const incomplete = checked.filter((c) => !calcComplete(c)).length;
  const nameOf = (id: string | null) => dates.find((d) => d.id === id)?.name ?? "";
  const numberName = (id: string | null) => numbers.find((n) => n.id === id)?.name ?? "";

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
    ["Dates on your contracts", shown.filter((d) => d.onContract)],
    ["Other Open to Close dates", shown.filter((d) => !d.onContract)],
  ];

  const optionGroups = (options: FieldOption[], exclude?: string) => (
    <>
      <optgroup label="On your contracts">
        {options
          .filter((o) => o.onContract && o.id !== exclude)
          .map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
      </optgroup>
      <optgroup label="Other Open to Close fields">
        {options
          .filter((o) => !o.onContract && o.id !== exclude)
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
              const missing = (v: unknown) => on && (v === null || v === "");
              const labelClass = (bad: boolean) =>
                `text-xs font-semibold ${bad ? "text-danger" : "text-ink-soft"}`;
              const daysText = c.days_on_contract
                ? `[${numberName(c.number_field) || "number field"}]`
                : (c.days ?? "__");
              return (
                <div
                  key={d.id}
                  className={`rounded-xl border bg-surface p-4 transition-colors ${
                    on ? "border-accent/50 shadow-sm" : "border-border"
                  }`}
                >
                  <label className="flex cursor-pointer flex-wrap items-center gap-x-2 gap-y-1">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={(e) => update(d.id, { enabled: e.target.checked })}
                      className="h-4 w-4"
                    />
                    <span className={`font-semibold ${on ? "text-ink" : "text-ink-faint"}`}>
                      {d.name}
                    </span>
                    <span className="text-xs text-ink-faint">{d.section}</span>
                    {d.onContract && (
                      <span className="rounded bg-gold/20 px-1 py-px text-[10px] font-bold uppercase text-ink">
                        On your contract
                      </span>
                    )}
                  </label>

                  {/* Faded and locked until the date is checked. */}
                  <fieldset
                    disabled={!on}
                    aria-label={`How ${d.name} is calculated`}
                    className={`mt-3 flex flex-col gap-3 transition-opacity ${on ? "" : "opacity-40"}`}
                  >
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      {c.days_on_contract ? (
                        <label className="flex flex-col gap-1">
                          <span className={labelClass(missing(c.number_field))}>Number Field</span>
                          <select
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
                          <span className={labelClass(missing(c.days))}>Days</span>
                          <input
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
                        <span className={labelClass(missing(c.direction))}>When</span>
                        <select
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

                    <label className="flex flex-col gap-1 sm:w-1/2">
                      <span className={labelClass(missing(c.relative_to))}>Date Field</span>
                      <select
                        value={c.relative_to ?? ""}
                        onChange={(e) => update(d.id, { relative_to: e.target.value || null })}
                        className={inputClass}
                      >
                        <option value="">Choose Date Field</option>
                        {optionGroups(dates, d.id)}
                      </select>
                    </label>

                    {on && (
                      <p className="text-sm text-ink-soft">
                        <span className="font-semibold text-ink">{d.name}</span> = {daysText}{" "}
                        {TIME_FRAMES.find((t) => t.value === c.time_frame)?.label ?? "__"}{" "}
                        {DIRECTIONS.find((t) => t.value === c.direction)?.label ?? "__"}{" "}
                        {nameOf(c.relative_to) || "__"}
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
    </div>
  );
}
