"use client";

import { useState } from "react";
import { setUrlParam } from "@/lib/urlState";
import { NumberDateDialog, PlaceholderCell } from "@/components/OtcFieldSelector";
import { TIME_FRAMES } from "@/lib/dateCalculations";
import { saveFieldPlaceholder, setNumberNotDate, tieNumberToDate } from "@/app/configurator/select_otc_fields/actions";
import {
  addOwnField,
  resetSelectYourDates,
  setCalcDate,
  setDateTimeFrame,
  setDefaultTimeFrame,
} from "@/app/configurator/select_your_dates/actions";

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
  names = {},
  initialGroup,
  title,
  intro,
  defaultTimeFrame,
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
  // What they've renamed fields to (shown in place of OTC's names).
  names?: Record<string, string>;
  // The group to open on (kept in the address so a reload comes back).
  initialGroup?: string;
  // The lesson's title (Default Type goes to its right) and description.
  title?: React.ReactNode;
  intro?: React.ReactNode;
  // How days are counted unless changed on a date.
  defaultTimeFrame?: string | null;
}) {
  // "" until they pick one (each date then counts Calendar Day(s)).
  const [defaultFrame, setDefaultFrame] = useState(defaultTimeFrame ?? "");
  const [resetting, setResetting] = useState(false);
  const groups = [...new Set(sections.map((s) => s.group))];
  const [group, setGroupState] = useState(
    initialGroup && groups.includes(initialGroup) ? initialGroup : groups[0],
  );
  const setGroup = (g: string) => {
    setGroupState(g);
    setUrlParam("group", g);
  };
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

  const named = (f: PairField) => ({ ...f, name: names[f.id] || f.name });
  const allD = [...allDates, ...extraDates].map(named);
  const allN = [...allNumbers, ...extraNumbers].map(named);
  const byId = new Map([...allD, ...allN].map((f) => [f.id, f] as const));
  const run = async (p: Promise<{ ok: boolean }>) => {
    setStatus("saving");
    const res = await p;
    setStatus(res.ok ? "saved" : "error");
  };

  // The rows: every number field they use (with its date, if it has one),
  // then dates they use that no number field is the days for.
  const numberRows = [...numbers, ...extraNumbers.filter((n) => !numbers.some((x) => x.id === n.id))].map(named);
  const tiedDates = new Set(Object.values(ties));
  type Row = { key: string; date: PairField | null; number: PairField | null; sectionId: string };
  const rows: Row[] = [
    ...numberRows.map((n) => {
      const d = ties[n.id] ? (byId.get(ties[n.id]) ?? null) : null;
      return { key: `n:${n.id}`, date: d, number: n, sectionId: n.sectionId };
    }),
    ...[...dates, ...extraDates.filter((d) => !dates.some((x) => x.id === d.id))]
      .map(named)
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

  // On the contracts: a document icon, its contract and line on hover.
  const badge = (id: string) =>
    spots[id] ? (
      <span
        title={spots[id]}
        aria-label={`On your contract: ${spots[id]}`}
        className="shrink-0 text-accent"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
          <path d="M14 3v5h5M9 13h6M9 17h4" />
        </svg>
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
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          {title}
          <button
            type="button"
            disabled={resetting}
            onClick={async () => {
              if (
                !window.confirm(
                  "Refresh your dates? This takes off every date you paired with a number field here, the dates you checked and your default type, and clears every type. Placeholders stay.",
                )
              )
                return;
              setResetting(true);
              const res = await resetSelectYourDates(accountId);
              if (!res.ok) {
                setResetting(false);
                window.alert(res.error ?? "Couldn't refresh your dates.");
                return;
              }
              window.location.reload();
            }}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-ink-soft hover:border-accent hover:text-accent disabled:opacity-50"
          >
            <span aria-hidden className="text-base leading-none">&#8634;</span>
            {resetting ? "Refreshing…" : "Refresh your dates"}
          </button>
        </div>
        <div className="mt-2">
          <select
              value={defaultFrame}
              aria-label="Default type"
              onChange={(e) => {
                const v = e.target.value;
                setDefaultFrame(v);
                // Every paired date takes it (no type when the default is
                // taken off).
                const paired = Object.values(ties);
                setFrames((f) => ({ ...f, ...Object.fromEntries(paired.map((id) => [id, v])) }));
                void run(setDefaultTimeFrame(accountId, v, paired));
              }}
              // As wide as what it shows (the placeholder, then their pick).
              className={`rounded-md border border-border bg-surface px-2 py-1.5 text-sm outline-none [field-sizing:content] focus:border-accent ${
                defaultFrame ? "text-ink" : "text-ink-faint"
              }`}
            >
              <option value="">Select your default type</option>
              {TIME_FRAMES.map((t) => (
                <option key={t.value} value={t.value} className="text-ink">
                  {t.label}
                </option>
              ))}
            </select>
        </div>
        {intro}
      </div>
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
      <div className="flex items-center gap-2 rounded-lg bg-border/60 px-4 py-2.5">
        <h2 className="text-sm font-bold text-ink">{group}</h2>
      </div>
      {sectionsHere.map((s) => (
        <section key={s.id} className="flex flex-col gap-1.5 rounded-xl border border-border bg-surface p-2.5">
          <h3 className="rounded-lg bg-border/30 px-3 py-1.5 text-sm font-semibold text-ink">
            {s.name}
            <span className="ml-2 text-xs font-normal text-ink-faint">
              {rows.filter((r) => r.sectionId === s.id).length} row
              {rows.filter((r) => r.sectionId === s.id).length === 1 ? "" : "s"}
            </span>
          </h3>
          <div className="hidden grid-cols-[1fr_1fr_12rem_12rem] gap-3 px-3 text-[11px] font-semibold uppercase tracking-wide text-ink-faint md:grid">
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
                  className={`grid items-center gap-x-3 gap-y-1 rounded-lg border bg-bg px-3 py-1.5 text-sm md:grid-cols-[1fr_1fr_12rem_12rem] ${
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
                          {d.name}
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
                          {n.name}
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
                        value={frames[d.id] ?? defaultFrame}
                        onChange={(e) => {
                          const v = e.target.value;
                          setFrames((f) => ({ ...f, [d.id]: v }));
                          void run(setDateTimeFrame(accountId, d.id, v));
                        }}
                        aria-label={`How ${d.name}'s days are counted`}
                        className="w-full rounded-md border border-border bg-bg px-2 py-1 text-xs text-ink outline-none focus:border-accent"
                      >
                        <option value="">Select your type</option>
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
