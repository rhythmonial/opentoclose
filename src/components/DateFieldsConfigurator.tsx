"use client";

import { useEffect, useRef, useState } from "react";
import {
  ACCEPTANCE_DATE_ID,
  calcComplete,
  DIRECTIONS,
  emptyCalc,
  isSameDay,
  COUNTED_TIME_FRAMES,
  type DateCalc,
} from "@/lib/dateCalculations";
import type { DateOption, DateRow } from "@/lib/dateRows";
import { saveDateCalc } from "@/app/configurator/select_your_date_fields/actions";

export type NumberOption = DateOption & { group: "contract" | "selected" | "other" };

const cellSelect =
  "w-full min-w-[7rem] rounded-md border border-border bg-bg px-1.5 py-1 text-xs text-ink outline-none focus:border-accent disabled:cursor-not-allowed disabled:opacity-40";

// Select Your Date Fields: the hard dates on the client's contracts
// (nothing to work out), the dates days fields set (the contract's in the
// order they appear on it, then the ones they chose in Finalize Your
// Fields), and the dates they chose there (worked out if they say so).
// Each worked-out date says what OTC's Date Calculation asks: so many days
// (a set number, or a days field) of which time frame, after or before which
// date (or the same day as it). Each shows as a one-line summary; clicking
// it opens its settings.
export function DateFieldsConfigurator({
  accountId,
  rows: initialRows,
  dates: initialDates,
  numbers,
  initial,
  auto,
  blankNotes = {},
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
  // Days field id -> its placeholder text, when the contract gives a value
  // for leaving it blank.
  blankNotes?: Record<string, string>;
}) {
  const [saveState, setSaveState] = useState<"saving" | "saved" | "error" | null>(null);
  const rows = initialRows;
  const dates = initialDates;
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
  // The worked-out date whose settings are showing.
  const [openId, setOpenId] = useState<string | null>(null);

  const calcFor = (id: string) => calcs.get(id) ?? emptyCalc(id);
  const nameOf = (id: string | null) => dates.find((d) => d.id === id)?.name ?? "";
  const worked = rows.filter((r) => r.group !== "contract" && calcFor(r.id).enabled);
  const incomplete = worked.filter((r) => !calcComplete(calcFor(r.id))).length;

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

  const q = query.trim().toLowerCase();
  const matches = (r: DateRow) => !q || r.name.toLowerCase().includes(q) || r.section.toLowerCase().includes(q);
  const contract = rows.filter((r) => r.group === "contract" && matches(r));
  const calculated = rows.filter((r) => r.group === "calculated" && matches(r));
  const picked = rows.filter((r) => r.group === "dates" && matches(r));

  // "From" choices, grouped like the page.
  const fromGroups: [string, DateOption[]][] = [
    ["Contract dates", rows.filter((r) => r.group === "contract")],
    ["Calculated dates", rows.filter((r) => r.group === "calculated")],
    ["Your other dates", rows.filter((r) => r.group === "dates")],
  ];
  const numberGroups: [string, NumberOption[]][] = [
    ["On your contracts", numbers.filter((n) => n.group === "contract")],
    ["Your fields", numbers.filter((n) => n.group === "selected")],
    ["Other Open to Close fields", numbers.filter((n) => n.group === "other")],
  ];

  // A worked-out date in a few words: "[Inspection Period - Days] calendar
  // days after Acceptance Date" (the days the agent fills in on each deal),
  // "3 business days before Closing Date", "Same day as Acceptance Date".
  function summaryOf(c: DateCalc) {
    const relative = nameOf(c.relative_to) || "(choose a date)";
    if (isSameDay(c)) return `Same day as ${relative}`;
    const one = c.days === 1;
    const kind =
      c.time_frame === "business_days"
        ? one ? "business day" : "business days"
        : c.time_frame === "calendar_days"
          ? one ? "calendar day" : "calendar days"
          : c.time_frame === "calendar_days_skip_weekend"
            ? `${one ? "calendar day" : "calendar days"} (skipping a landing weekend day)`
            : "(choose a type)";
    const field = numbers.find((n) => n.id === c.number_field)?.name;
    const count = c.days !== null ? String(c.days) : field ? `[${field}]` : "(choose days)";
    return `${count} ${kind} ${c.direction ?? "(before or after)"} ${relative}`;
  }

  function calcRow(r: DateRow, opts: { optional: boolean }) {
    const c = calcFor(r.id);
    const on = c.enabled;
    const open = on && openId === r.id;
    const done = calcComplete(c);
    return (
      <li key={r.id} className={on ? "" : "text-ink-faint"}>
        <div className="flex items-center gap-2 px-3 py-2">
          {opts.optional ? (
            <input
              type="checkbox"
              checked={on}
              onChange={(e) => {
                check(r.id, e.target.checked);
                setOpenId(e.target.checked ? r.id : null);
              }}
              aria-label={`Work out ${r.name}`}
              className="h-4 w-4 shrink-0"
            />
          ) : (
            <span aria-hidden className="w-4 shrink-0 text-center text-accent">
              &#10003;
            </span>
          )}
          {on ? (
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpenId(open ? null : r.id)}
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
            >
              <span className="min-w-0 flex-1 truncate text-sm">
                <span className="font-semibold text-ink">{r.name}</span>
                {r.group === "calculated" && r.onContract && (
                  <span className="ml-1.5 rounded bg-gold/20 px-1 py-px align-middle text-[10px] font-bold uppercase text-ink">
                    Contract
                  </span>
                )}
                <span className="text-ink-soft"> &ndash; {summaryOf(c)}</span>
              </span>
              {!done && (
                <span className="shrink-0 text-xs font-semibold text-danger">Needs finishing</span>
              )}
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                aria-hidden
                className={`shrink-0 text-ink-faint transition-transform ${open ? "rotate-180" : ""}`}
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          ) : (
            <span className="min-w-0 flex-1 truncate text-sm">
              <span className="font-medium">{r.name}</span>
              <span className="text-xs"> &ndash; entered by hand. Check it if it&rsquo;s worked out from another date.</span>
            </span>
          )}
        </div>
        {open && calcSettings(r, c)}
      </li>
    );
  }

  // The settings of a worked-out date, under it once it's clicked (called,
  // not rendered as a component, so its inputs keep focus).
  function calcSettings(r: DateRow, c: DateCalc) {
    const sameDay = isSameDay(c);
    const bad = (v: unknown) => v === null || v === "";
    const ring = (b: boolean) => (b ? "border-danger" : "");
    const label = (text: string, missing: boolean) => (
      <span className={`text-xs font-semibold ${missing ? "text-danger" : "text-ink-soft"}`}>{text}</span>
    );
    const daysMissing = c.days === null && !c.number_field;
    return (
      <div className="grid grid-cols-1 gap-3 border-t border-border bg-bg/60 px-3 py-3 sm:grid-cols-5 sm:pl-9">
        {/* Days: a number (0 is the same day), or blank when they vary. */}
        <label className="flex flex-col gap-1">
          {label("Days", daysMissing)}
          <input
            type="number"
            min={0}
            max={3650}
            inputMode="numeric"
            placeholder="Per deal"
            value={c.days ?? ""}
            onChange={(e) => {
              const days = e.target.value === "" ? null : Math.max(0, Math.trunc(Number(e.target.value)));
              update(r.id, {
                days,
                days_on_contract: days === null && Boolean(c.number_field),
                // 0 days is "Same Day As"; a count needs a real time frame.
                ...(c.time_frame === "same_day" ? { time_frame: "calendar_days" as const } : {}),
              });
            }}
            title="0 means the same day. Leave it blank when the number of days is filled in on each deal (in the number field)."
            className={`${cellSelect} !min-w-0 ${ring(daysMissing)}`}
          />
          <span className="text-[11px] text-ink-faint">
            0 = same day &middot; blank = filled in per deal (number field)
          </span>
        </label>
        <label className="flex flex-col gap-1">
          {label("Number field", daysMissing)}
          <select
            value={c.number_field ?? ""}
            onChange={(e) =>
              update(r.id, {
                number_field: e.target.value || null,
                days_on_contract: c.days === null && Boolean(e.target.value),
              })
            }
            className={`${cellSelect} ${ring(daysMissing)}`}
          >
            <option value="">None</option>
            {numberGroups.map(([group, items]) =>
              items.length === 0 ? null : (
                <optgroup key={group} label={group}>
                  {items.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name}
                    </option>
                  ))}
                </optgroup>
              ),
            )}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          {label("Type", !sameDay && bad(c.time_frame))}
          <select
            disabled={sameDay}
            value={c.time_frame === "same_day" ? "" : (c.time_frame ?? "")}
            onChange={(e) => update(r.id, { time_frame: (e.target.value || null) as DateCalc["time_frame"] })}
            className={`${cellSelect} ${ring(!sameDay && bad(c.time_frame))}`}
          >
            <option value="">{sameDay ? "Same day" : "Choose"}</option>
            {COUNTED_TIME_FRAMES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          {label("When", !sameDay && bad(c.direction))}
          <select
            disabled={sameDay}
            value={c.direction ?? ""}
            onChange={(e) => update(r.id, { direction: (e.target.value || null) as DateCalc["direction"] })}
            className={`${cellSelect} ${ring(!sameDay && bad(c.direction))}`}
          >
            <option value="">{sameDay ? "Same day" : "Choose"}</option>
            {DIRECTIONS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          {label("From date", bad(c.relative_to))}
          <select
            value={c.relative_to ?? ""}
            onChange={(e) => update(r.id, { relative_to: e.target.value || null })}
            className={`${cellSelect} ${ring(bad(c.relative_to))}`}
          >
            <option value="">Choose a date</option>
            {fromGroups.map(([group, items]) =>
              items.filter((o) => o.id !== r.id).length === 0 ? null : (
                <optgroup key={group} label={group}>
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
        </label>
        {c.number_field && blankNotes[c.number_field] && (
          <p className={`text-xs sm:col-span-5 ${c.days !== null ? "font-semibold text-danger" : "text-ink-soft"}`}>
            Leave Days blank: {numbers.find((n) => n.id === c.number_field)?.name ?? "its days field"} will
            have the placeholder &ldquo;{blankNotes[c.number_field]}&rdquo; to note what the
            contract says when it&rsquo;s left blank.
          </p>
        )}
      </div>
    );
  }

  function calcTable(title: string, help: string, items: DateRow[], opts: { optional: boolean }) {
    if (items.length === 0) return null;
    return (
      <section className="flex flex-col gap-1.5">
        <h2 className="text-sm font-bold text-ink">
          {title} <span className="font-normal text-ink-faint">({items.length})</span>
        </h2>
        <p className="text-xs text-ink-soft">{help} Click a date to change how it&rsquo;s worked out.</p>
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
          {/* A days field's date is always worked out. */}
          {items.map((r) => calcRow(r, { optional: opts.optional && !r.numberField }))}
        </ul>
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
        "Calculated dates",
        "Each days field sets a date: yours from the contract in the order they appear on it, then the days fields you chose in Customize Your Fields. The days come from that field on each deal.",
        calculated,
        { optional: false },
      )}
      {calcTable(
        "Your other dates",
        "The dates you chose in Customize Your Fields. Check one if it's worked out from another date; otherwise it's entered by hand.",
        picked,
        { optional: true },
      )}
      {contract.length + calculated.length + picked.length === 0 && (
        <p className="rounded-xl border border-border bg-surface p-5 text-sm text-ink-faint">
          {q ? "No dates match." : "No dates yet. Pick your date fields in Customize Your Fields."}
        </p>
      )}

    </div>
  );
}
