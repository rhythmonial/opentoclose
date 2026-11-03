"use client";

import { useRef, useState } from "react";
import {
  isSystemRequired,
  OTC_FIELD_ALIASES,
  SELECTABLE_SECTIONS,
  slugOf,
} from "@/lib/otcFields";
import { saveOtcFieldSelection } from "@/app/configurator/select_otc_fields/actions";

const KIND_LABELS: Record<string, string> = {
  text: "Text",
  text_area: "Text area",
  currency: "Dollar",
  percentage: "Percent",
  date: "Date",
  number: "Number",
  choice: "Choice",
};

const SECTIONS = SELECTABLE_SECTIONS.map((s) => ({
  ...s,
  fields: s.fields.map((f) => ({
    ...f,
    id: `${s.id}/${slugOf(f.name)}`,
  })),
}));
const TOTAL = SECTIONS.reduce((n, s) => n + s.fields.length, 0);

// Select OTC Fields: every field Open to Close comes with, by group and
// section, to check the ones the client's process uses. System required
// fields are always checked. Other names a field goes by are shown under
// it, and the search matches them.
export function OtcFieldSelector({
  accountId,
  initial,
}: {
  // The client account (staff only; clients use their own).
  accountId: string | null;
  initial: string[];
}) {
  const [picked, setPicked] = useState<Set<string>>(() => new Set(initial));
  const [query, setQuery] = useState("");
  const [onlyChecked, setOnlyChecked] = useState(false);
  const [status, setStatus] = useState<"saving" | "saved" | "error" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  function save(next: Set<string>) {
    setPicked(next);
    setStatus("saving");
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      const result = await saveOtcFieldSelection(accountId, [...next]);
      setStatus(result.ok ? "saved" : "error");
      setError(result.ok ? null : (result.error ?? "Couldn't save."));
    }, 500);
  }

  function toggle(id: string, on: boolean) {
    if (isSystemRequired(id)) return;
    const next = new Set(picked);
    if (on) next.add(id);
    else next.delete(id);
    save(next);
  }

  function setAll(ids: string[], on: boolean) {
    const next = new Set(picked);
    for (const id of ids) {
      if (isSystemRequired(id)) continue;
      if (on) next.add(id);
      else next.delete(id);
    }
    save(next);
  }

  const q = query.trim().toLowerCase();
  const matches = (f: { id: string; name: string }, sectionName: string) =>
    (!onlyChecked || picked.has(f.id)) &&
    (!q ||
      f.name.toLowerCase().includes(q) ||
      sectionName.toLowerCase().includes(q) ||
      (OTC_FIELD_ALIASES[f.id] ?? []).some((a) => a.toLowerCase().includes(q)));
  const shown = SECTIONS.map((s) => ({
    ...s,
    fields: s.fields.filter((f) => matches(f, s.name)),
  })).filter((s) => s.fields.length > 0);
  const groups = [...new Set(shown.map((s) => s.group))];
  const count = SECTIONS.reduce((n, s) => n + s.fields.filter((f) => picked.has(f.id)).length, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-gold/50 bg-gold/10 px-4 py-3 text-sm text-ink">
        <p className="font-semibold">Your fields may go by a different name here</p>
        <p className="mt-1 text-ink-soft">
          Open to Close&rsquo;s field names won&rsquo;t always match your contract or the words
          your state uses. For example, <strong className="text-ink">Acceptance Date</strong> is
          the date both sides signed, which your contract may call the Contract Date, Effective
          Date or Binding Agreement Date. Go by what a field is for, not just its name, and do
          your best to check every field you use in your process. Where we know other names
          for a field, they&rsquo;re listed under it, and the search finds them too.
        </p>
      </div>

      <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center gap-3 bg-bg px-1 py-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search fields, e.g. effective date"
          aria-label="Search fields"
          className="w-72 max-w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-accent"
        />
        <label className="flex items-center gap-1.5 text-sm text-ink-soft">
          <input
            type="checkbox"
            checked={onlyChecked}
            onChange={(e) => setOnlyChecked(e.target.checked)}
          />
          Show checked only
        </label>
        <span className="ml-auto text-xs text-ink-faint">
          {count} of {TOTAL} fields checked
          {status === "saving" && " · Saving…"}
          {status === "saved" && " · Saved"}
          {status === "error" && <span className="text-danger"> · {error}</span>}
        </span>
      </div>

      {shown.length === 0 && (
        <p className="rounded-xl border border-border bg-surface p-5 text-sm text-ink-soft">
          No fields match &ldquo;{query.trim()}&rdquo;. Try another name for it. If Open to
          Close doesn&rsquo;t have it, you&rsquo;ll be able to add it when you assign the
          fields on your contracts.
        </p>
      )}

      {groups.map((group) => (
        <div key={group} className="flex flex-col gap-3">
          <h2 className="mt-2 font-display text-lg font-bold text-ink">{group}</h2>
          {shown
            .filter((s) => s.group === group)
            .map((s) => {
              const ids = s.fields.map((f) => f.id);
              const on = ids.filter((id) => picked.has(id)).length;
              const allOn = on === ids.length;
              return (
                <section key={s.id} className="rounded-xl border border-border bg-surface">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
                    <h3 className="font-semibold text-ink">
                      {s.name}
                      <span className="ml-2 text-xs font-normal text-ink-faint">
                        {on} of {ids.length}
                      </span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => setAll(ids, !allOn)}
                      className="text-xs font-semibold text-accent"
                    >
                      {allOn ? "Uncheck all" : "Check all"}
                    </button>
                  </div>
                  <ul className="grid grid-cols-1 gap-x-4 px-2 py-1.5 sm:grid-cols-2">
                    {s.fields.map((f) => {
                      const required = isSystemRequired(f.id);
                      const checked = required || picked.has(f.id);
                      const aliases = OTC_FIELD_ALIASES[f.id];
                      return (
                        <li key={f.id}>
                          <label
                            className={`flex items-start gap-2.5 rounded-md px-2 py-1.5 ${
                              required ? "cursor-default" : "cursor-pointer hover:bg-accent-soft/30"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={required}
                              onChange={(e) => toggle(f.id, e.target.checked)}
                              className="mt-0.5 shrink-0"
                            />
                            <span className="min-w-0">
                              <span className={`text-sm ${checked ? "font-semibold text-ink" : "text-ink"}`}>
                                {f.name}
                              </span>
                              <span className="ml-1.5 text-[11px] text-ink-faint">
                                {KIND_LABELS[f.kind ?? ""] ?? ""}
                              </span>
                              {required && (
                                <span className="ml-1.5 rounded bg-accent-soft px-1 py-px text-[10px] font-bold uppercase text-accent">
                                  Required by OTC
                                </span>
                              )}
                              {aliases && (
                                <span className="block text-xs text-ink-soft">
                                  Also called: {aliases.join(", ")}
                                </span>
                              )}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
        </div>
      ))}
    </div>
  );
}
