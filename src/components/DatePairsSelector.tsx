"use client";

import { useState } from "react";
import { NumberDateDialog, PlaceholderCell } from "@/components/OtcFieldSelector";
import { TIME_FRAMES } from "@/lib/dateCalculations";
import { saveFieldPlaceholder, setNumberNotDate, tieNumberToDate } from "@/app/configurator/select_otc_fields/actions";
import { addOwnField, setCalcDate, setDateTimeFrame } from "@/app/configurator/select_your_dates/actions";

export type PairField = { id: string; name: string; sectionId: string };

// Select Your Dates: each calculated date beside the number field that
// holds its days, by field group and section (as in Customize Your Fields).
// Checking a date makes it calculated: it needs a number field, picked in
// red until it has one. A number field without a date is listed too, with
// a red pick for its date (unless it isn't any date's days). Each pair has
// how its days are counted and the number's placeholder.
export function DatePairsSelector({
  accountId,
  sections,
  dates,
  numbers,
  allDates,
  allNumbers,
  initialTies,
  suggestedDates,
  initialNotDates,
  initialCalcDates,
  timeFrames,
  spots,
  placeholders: initialPlaceholders,
  lines,
}: {
  accountId: string | null;
  // Field groups' sections, in order.
  sections: { id: string; name: string; group: string }[];
  // The dates and number fields they use (checked in Customize Your Fields).
  dates: PairField[];
  numbers: PairField[];
  // Every date and number field, to pick from.
  allDates: PairField[];
  allNumbers: PairField[];
  // Number field -> its date (picked here or in Customize Your Fields).
  initialTies: Record<string, string>;
  suggestedDates: Record<string, string>;
  initialNotDates: string[];
  // Dates checked as calculated that don't have a number field yet.
  initialCalcDates: string[];
  timeFrames: Record<string, string>;
  // Where each first is on the contracts ("Purchase Agreement #134").
  spots: Record<string, string>;
  // Each field's placeholder, and its first line on the contracts.
  placeholders: Record<string, string>;
  lines: Record<string, number | null>;
}) {
  const groups = [...new Set(sections.map((s) => s.group))];
  const [group, setGroup] = useState(groups[0]);
  const [ties, setTies] = useState(initialTies);
  const [notDate, setNotDate] = useState(() => new Set(initialNotDates));
  const [calc, setCalc] = useState(() => new Set(initialCalcDates));
  const [frames, setFrames] = useState(timeFrames);
  const [placeholders, setPlaceholders] = useState(initialPlaceholders);
  const [extraDates, setExtraDates] = useState<PairField[]>([]);
  const [extraNumbers, setExtraNumbers] = useState<PairField[]>([]);
  const [status, setStatus] = useState<"saving" | "saved" | "error" | null>(null);
  const [pickDateFor, setPickDateFor] = useState<PairField | null>(null);
  const [pickNumberFor, setPickNumberFor] = useState<PairField | null>(null);

  const allD = [...allDates, ...extraDates];
  const allN = [...allNumbers, ...extraNumbers];
  const byId = new Map([...allD, ...allN].map((f) => [f.id, f] as const));
  const run = async (p: Promise<{ ok: boolean }>) => {
    setStatus("saving");
    const res = await p;
    setStatus(res.ok ? "saved" : "error");
  };

  // The rows: every number field they use (with its date, if it has one),
  // then dates they use that no number field is the days for.
  const numberRows = [...numbers, ...extraNumbers.filter((n) => !numbers.some((x) => x.id === n.id))];
  const tiedDates = new Set(Object.values(ties));
  type Row = { key: string; date: PairField | null; number: PairField | null; sectionId: string };
  const rows: Row[] = [
    ...numberRows.map((n) => {
      const d = ties[n.id] ? (byId.get(ties[n.id]) ?? null) : null;
      return { key: `n:${n.id}`, date: d, number: n, sectionId: n.sectionId };
    }),
    ...[...dates, ...extraDates.filter((d) => !dates.some((x) => x.id === d.id))]
      .filter((d) => !tiedDates.has(d.id))
      .map((d) => ({ key: `d:${d.id}`, date: d, number: null, sectionId: d.sectionId })),
  ];
  const sectionsHere = sections.filter((s) => s.group === group && rows.some((r) => r.sectionId === s.id));
  const groupCount = (g: string) =>
    rows.filter((r) => sections.find((s) => s.id === r.sectionId)?.group === g && r.date && (r.number || calc.has(r.date.id))).length;

  async function tie(numberId: string, date: { id: string; name: string; isNew?: boolean }, sectionId: string) {
    if (date.isNew) {
      const f = { id: date.id, name: date.name, sectionId };
      setExtraDates((x) => [...x, f]);
      await addOwnField(accountId, { ...f, kind: "date" });
    }
    setTies((t) => ({ ...t, [numberId]: date.id }));
    setNotDate((n) => {
      const next = new Set(n);
      next.delete(numberId);
      return next;
    });
    await run(tieNumberToDate(accountId, numberId, date.id, date.isNew ? date.name : undefined));
  }

  const badge = (id: string) =>
    spots[id] ? (
      <span className="max-w-[11rem] shrink-0 truncate rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">
        {spots[id]}
      </span>
    ) : null;
  const redPick = (label: string, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md bg-danger/10 px-2 py-1 text-xs font-semibold text-danger hover:bg-danger/20"
    >
      {label} &#9662;
    </button>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 sm:gap-2" role="tablist" aria-label="Field groups">
        {groups.map((g) => (
          <button
            key={g}
            type="button"
            role="tab"
            aria-selected={g === group}
            onClick={() => setGroup(g)}
            className={`flex min-w-0 flex-1 items-center justify-center rounded-md border px-1 py-2 text-center text-[11px] font-semibold leading-tight sm:px-3 sm:text-sm ${
              g === group ? "border-accent bg-accent text-white" : "border-border bg-surface text-ink-soft"
            }`}
          >
            <span className="min-w-0 break-words sm:truncate">
              {g}
              <span className={g === group ? "text-white/80" : "text-ink-faint"}> &middot; {groupCount(g)}</span>
            </span>
          </button>
        ))}
      </div>
      <p className="text-xs text-ink-faint">
        {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : status === "error" ? "Couldn't save." : ""}
      </p>

      {sectionsHere.length === 0 && (
        <p className="rounded-lg border border-border bg-surface p-4 text-sm text-ink-faint">
          No dates or number fields in {group}.
        </p>
      )}
      {sectionsHere.map((s) => (
        <section key={s.id} className="flex flex-col gap-1.5">
          <h3 className="rounded-lg bg-border/30 px-4 py-2 text-sm font-semibold text-ink">{s.name}</h3>
          <div className="ml-3 hidden grid-cols-[1fr_1fr_12rem_12rem] gap-3 px-3 text-[11px] font-semibold uppercase tracking-wide text-ink-faint sm:ml-6 md:grid">
            <span>Date</span>
            <span>Number field (days)</span>
            <span>Type</span>
            <span>Placeholder</span>
          </div>
          {rows
            .filter((r) => r.sectionId === s.id)
            .map((r) => {
              const d = r.date;
              const n = r.number;
              const checked = Boolean(d && (n || calc.has(d.id)));
              return (
                <div
                  key={r.key}
                  className={`ml-3 grid items-center gap-x-3 gap-y-1.5 rounded-lg border bg-surface px-3 py-2 sm:ml-6 md:grid-cols-[1fr_1fr_12rem_12rem] ${
                    checked ? "border-accent/40" : "border-border"
                  }`}
                >
                  {/* Date */}
                  <span className="flex min-w-0 items-center gap-2">
                    {d ? (
                      <>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={Boolean(n)}
                          title={n ? "Its number field is picked; uncheck by taking the date off the number." : undefined}
                          onChange={(e) => {
                            const on = e.target.checked;
                            setCalc((c) => {
                              const next = new Set(c);
                              if (on) next.add(d.id);
                              else next.delete(d.id);
                              return next;
                            });
                            void run(setCalcDate(accountId, d.id, on));
                          }}
                          className="h-4 w-4 shrink-0"
                        />
                        <span className={`min-w-0 truncate text-sm text-accent ${checked ? "font-semibold" : ""}`}>
                          {d.name} <span className="font-normal text-ink-soft">(Date)</span>
                        </span>
                        {badge(d.id)}
                        {n && (
                          <button
                            type="button"
                            onClick={() => n && setPickDateFor(n)}
                            title="Change its date"
                            className="shrink-0 text-xs text-ink-faint hover:text-accent"
                          >
                            &#9662;
                          </button>
                        )}
                      </>
                    ) : n && notDate.has(n.id) ? (
                      <button
                        type="button"
                        onClick={() => setPickDateFor(n)}
                        className="text-xs text-ink-faint hover:text-accent"
                      >
                        Not a date&rsquo;s days
                      </button>
                    ) : (
                      n && redPick("Pick a date", () => setPickDateFor(n))
                    )}
                  </span>
                  {/* Number field */}
                  <span className="flex min-w-0 items-center gap-2">
                    {n ? (
                      <>
                        <span className="min-w-0 truncate text-sm text-accent">
                          {n.name} <span className="text-ink-soft">(Number)</span>
                        </span>
                        {badge(n.id)}
                      </>
                    ) : checked && d ? (
                      redPick("Pick a number field", () => setPickNumberFor(d))
                    ) : (
                      <span className="text-sm text-ink-faint">&mdash;</span>
                    )}
                  </span>
                  {/* Type */}
                  <span>
                    {d && n ? (
                      <select
                        value={frames[d.id] || "calendar_days"}
                        onChange={(e) => {
                          const v = e.target.value;
                          setFrames((f) => ({ ...f, [d.id]: v }));
                          void run(setDateTimeFrame(accountId, d.id, v));
                        }}
                        aria-label={`How ${d.name}'s days are counted`}
                        className="w-full rounded-md border border-border bg-bg px-2 py-1 text-xs text-ink outline-none focus:border-accent"
                      >
                        {TIME_FRAMES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    ) : null}
                  </span>
                  {/* Placeholder (the number's) */}
                  <span>
                    {n ? (
                      <PlaceholderCell
                        key={placeholders[n.id] ?? ""}
                        value={placeholders[n.id] ?? ""}
                        line={lines[n.id] ?? null}
                        name={n.name}
                        onSave={(text) => {
                          setPlaceholders((p) => ({ ...p, [n.id]: text }));
                          void run(saveFieldPlaceholder(accountId, n.id, text));
                        }}
                      />
                    ) : null}
                  </span>
                </div>
              );
            })}
        </section>
      ))}

      {pickDateFor && (
        <NumberDateDialog
          name={pickDateFor.name}
          sectionName={sections.find((x) => x.id === pickDateFor.sectionId)?.name ?? ""}
          dates={allD}
          tiedTo={ties[pickDateFor.id] ?? null}
          suggested={suggestedDates[pickDateFor.id] ?? null}
          notDate={notDate.has(pickDateFor.id)}
          onTie={(date) => {
            const n = pickDateFor;
            setPickDateFor(null);
            void tie(n.id, date, n.sectionId);
          }}
          onNotDate={(on) => {
            const id = pickDateFor.id;
            setPickDateFor(null);
            setNotDate((s) => {
              const next = new Set(s);
              if (on) next.add(id);
              else next.delete(id);
              return next;
            });
            if (on) {
              setTies((t) => {
                const next = { ...t };
                delete next[id];
                return next;
              });
            }
            void run(setNumberNotDate(accountId, id, on));
          }}
          onClose={() => setPickDateFor(null)}
        />
      )}
      {pickNumberFor && (
        <NumberPickDialog
          date={pickNumberFor}
          sectionName={sections.find((x) => x.id === pickNumberFor.sectionId)?.name ?? ""}
          numbers={allN.filter((x) => !ties[x.id] || ties[x.id] === pickNumberFor.id)}
          onPick={async (num) => {
            const d = pickNumberFor;
            setPickNumberFor(null);
            if (num.isNew) {
              const f = { id: num.id, name: num.name, sectionId: d.sectionId };
              setExtraNumbers((x) => [...x, f]);
              await addOwnField(accountId, { ...f, kind: "number" });
            }
            await tie(num.id, d, d.sectionId);
          }}
          onClose={() => setPickNumberFor(null)}
        />
      )}
    </div>
  );
}

// A checked date's number field: their number fields without a date, to
// search, or a new one (in the date's section).
function NumberPickDialog({
  date,
  sectionName,
  numbers,
  onPick,
  onClose,
}: {
  date: PairField;
  sectionName: string;
  numbers: PairField[];
  onPick: (n: { id: string; name: string; isNew?: boolean }) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const matches = numbers.filter((n) => !q || n.name.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name));
  const exact = numbers.some((n) => n.name.toLowerCase() === q);
  const addNew = () => onPick({ id: `new-otc:${crypto.randomUUID()}`, name: query.trim().slice(0, 120), isNew: true });
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="number-pick-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-xl border border-border bg-surface p-5 shadow-xl">
        <h2 id="number-pick-title" className="font-display text-lg font-bold text-ink">
          {date.name}
        </h2>
        <p className="mt-1 text-sm text-ink-soft">Which number field holds its days?</p>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            if (matches.length === 1) onPick(matches[0]);
            else if (q && !exact) addNew();
          }}
          placeholder="Search number fields"
          aria-label="Search number fields"
          className="mt-3 rounded-md border border-border bg-bg px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent"
        />
        <div className="mt-2 min-h-0 flex-1 overflow-y-auto rounded-md border border-border">
          {matches.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => onPick(n)}
              className="block w-full px-3 py-1.5 text-left text-sm text-ink hover:bg-accent-soft/50"
            >
              {n.name}
            </button>
          ))}
          {matches.length === 0 && <p className="px-3 py-2 text-xs text-ink-faint">No number fields match.</p>}
        </div>
        {q && !exact && (
          <button type="button" onClick={addNew} className="mt-2 self-start text-sm font-semibold text-accent">
            + Add number field &ldquo;{query.trim()}&rdquo;{sectionName && ` in ${sectionName}`}
          </button>
        )}
        <div className="mt-4 flex justify-end">
          <button type="button" onClick={onClose} className="text-sm font-semibold text-ink-soft">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
