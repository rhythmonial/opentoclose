"use client";

import { useRef, useState } from "react";
import {
  CONTACT_ROLES_SECTION,
  isSystemRequired,
  OTC_FIELD_ALIASES,
  OTC_SECTIONS,
  SELECTABLE_GROUPS,
  slugOf,
  type Kind,
} from "@/lib/otcFields";
import {
  saveOtcFieldSelection,
  type OtcFieldSelection,
} from "@/app/configurator/select_otc_fields/actions";

const KIND_LABELS: Record<string, string> = {
  text: "Text",
  text_area: "Text area",
  currency: "Dollar",
  percentage: "Percent",
  date: "Date",
  number: "Number",
  choice: "Choice",
};

// Every section of OTC's field groups (empty ones too, as OTC shows them),
// with field ids.
const SECTIONS = OTC_SECTIONS.filter((s) => s.id !== CONTACT_ROLES_SECTION).map((s) => ({
  ...s,
  fields: s.fields.map((f) => ({ ...f, id: `${s.id}/${slugOf(f.name)}` })),
}));
const ALL_FIELDS = SECTIONS.flatMap((s) => s.fields);

// Select OTC Fields, laid out like OTC's Field Editor: a tab per field
// group (checked off when the client has finished it), its sections, and
// their fields. The client checks the fields their process uses and, when
// they call one something else, types their name for it. System required
// fields are always checked. Other names a field goes by show under it and
// match the search.
export function OtcFieldSelector({
  accountId,
  initial,
}: {
  // The client account (staff only; clients use their own).
  accountId: string | null;
  initial: OtcFieldSelection;
}) {
  const [picked, setPicked] = useState<Set<string>>(() => new Set(initial.fields));
  const [names, setNames] = useState<Record<string, string>>(initial.names);
  const [done, setDone] = useState<Set<string>>(() => new Set(initial.groupsDone));
  const [group, setGroup] = useState(
    () => SELECTABLE_GROUPS.find((g) => !initial.groupsDone.includes(g)) ?? SELECTABLE_GROUPS[0],
  );
  const [query, setQuery] = useState("");
  const [onlyChecked, setOnlyChecked] = useState(false);
  const [status, setStatus] = useState<"saving" | "saved" | "error" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const top = useRef<HTMLDivElement>(null);

  function save(next: { picked?: Set<string>; names?: Record<string, string>; done?: Set<string> }) {
    const p = next.picked ?? picked;
    const n = next.names ?? names;
    const d = next.done ?? done;
    if (next.picked) setPicked(p);
    if (next.names) setNames(n);
    if (next.done) setDone(d);
    setStatus("saving");
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      const result = await saveOtcFieldSelection(accountId, {
        fields: [...p],
        names: n,
        groupsDone: [...d],
      });
      setStatus(result.ok ? "saved" : "error");
      setError(result.ok ? null : (result.error ?? "Couldn't save."));
    }, 500);
  }

  function setChecked(ids: string[], on: boolean) {
    const next = new Set(picked);
    for (const id of ids) {
      if (isSystemRequired(id)) continue;
      if (on) next.add(id);
      else next.delete(id);
    }
    save({ picked: next });
  }

  function setDoneFor(g: string, on: boolean) {
    const next = new Set(done);
    if (on) next.add(g);
    else next.delete(g);
    save({ done: next });
  }

  // Marks this group done and moves on to the next one not done yet.
  function finishGroup() {
    const next = new Set(done).add(group);
    save({ done: next });
    const after = SELECTABLE_GROUPS.find((g) => !next.has(g));
    if (after) {
      setGroup(after);
      top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  const isOn = (id: string) => isSystemRequired(id) || picked.has(id);
  const q = query.trim().toLowerCase();
  const matches = (f: { id: string; name: string }, sectionName: string) =>
    (!onlyChecked || isOn(f.id)) &&
    (!q ||
      f.name.toLowerCase().includes(q) ||
      sectionName.toLowerCase().includes(q) ||
      (names[f.id] ?? "").toLowerCase().includes(q) ||
      (OTC_FIELD_ALIASES[f.id] ?? []).some((a) => a.toLowerCase().includes(q)));
  // Searching looks through every group; otherwise it's the open tab.
  const filtering = Boolean(q) || onlyChecked;
  const shown = SECTIONS.filter((s) => (q ? true : s.group === group))
    .map((s) => ({ ...s, fields: s.fields.filter((f) => matches(f, s.name)) }))
    .filter((s) => !filtering || s.fields.length > 0);
  const shownGroups = [...new Set(shown.map((s) => s.group))];
  const count = ALL_FIELDS.filter((f) => isOn(f.id)).length;
  const groupCount = (g: string) => {
    const fields = SECTIONS.filter((s) => s.group === g).flatMap((s) => s.fields);
    return [fields.filter((f) => isOn(f.id)).length, fields.length] as const;
  };

  return (
    <div ref={top} className="flex scroll-mt-4 flex-col gap-4">
      <div className="rounded-xl border border-gold/50 bg-gold/10 px-4 py-3 text-sm text-ink">
        <p className="font-semibold">Your fields may go by a different name here</p>
        <p className="mt-1 text-ink-soft">
          Open to Close&rsquo;s field names won&rsquo;t always match your contract or the words
          your state uses. For example, <strong className="text-ink">Acceptance Date</strong> is
          the date both sides signed, which your contract may call the Contract Date, Effective
          Date or Binding Agreement Date. Go by what a field is for, not just its name, and do
          your best to check every field you use in your process. If you call a field
          something else, type your name for it beside the field.
        </p>
      </div>

      {/* Field group tabs, like OTC's group menu; the checkbox marks a
          group done. */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Field groups">
        {SELECTABLE_GROUPS.map((g) => {
          const active = !q && g === group;
          const [on, total] = groupCount(g);
          return (
            <div
              key={g}
              className={`flex items-center gap-2 rounded-lg border pl-3 text-sm font-semibold transition-colors ${
                active
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : "border-border bg-surface text-ink-soft hover:border-emerald-500"
              }`}
            >
              <input
                type="checkbox"
                checked={done.has(g)}
                onChange={(e) => setDoneFor(g, e.target.checked)}
                aria-label={`${g} done`}
                title={done.has(g) ? "Done" : "Mark this group done"}
                className="h-4 w-4 cursor-pointer accent-emerald-600"
              />
              <button
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setGroup(g);
                  setQuery("");
                }}
                className="py-2 pr-3 text-left"
              >
                {g}
                <span className={`ml-1.5 text-xs font-normal ${active ? "text-white/80" : "text-ink-faint"}`}>
                  {on}/{total}
                </span>
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search all fields, e.g. effective date"
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
          {count} of {ALL_FIELDS.length} fields checked &middot; {done.size} of{" "}
          {SELECTABLE_GROUPS.length} groups done
          {status === "saving" && " · Saving…"}
          {status === "saved" && " · Saved"}
          {status === "error" && <span className="text-danger"> · {error}</span>}
        </span>
      </div>

      {shown.length === 0 && (
        <p className="rounded-xl border border-border bg-surface p-5 text-sm text-ink-soft">
          {q
            ? `No fields match “${query.trim()}”. Try another name for it. If Open to Close doesn’t have it, you’ll be able to add it when you assign the fields on your contracts.`
            : "No checked fields in this group."}
        </p>
      )}

      {shownGroups.map((g) => (
        <div key={g} className="flex flex-col gap-2">
          {/* The group bar. */}
          <div className="flex items-center justify-between gap-2 rounded-lg bg-border/60 px-4 py-2.5">
            <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
              <Star />
              {g}
            </h2>
            <span className="text-xs text-ink-soft">
              {groupCount(g)[0]} of {groupCount(g)[1]} checked
            </span>
          </div>

          {shown
            .filter((s) => s.group === g)
            .map((s) => {
              const ids = s.fields.map((f) => f.id);
              return (
                <section key={s.id} className="ml-3 flex flex-col gap-1.5 sm:ml-6">
                  <div className="flex items-center justify-between gap-2 rounded-lg bg-border/30 px-4 py-2">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                      <Star />
                      {s.name}
                    </h3>
                    {ids.length > 0 && (
                      <span className="flex items-center gap-1.5 text-xs">
                        <button
                          type="button"
                          onClick={() => setChecked(ids, true)}
                          className="font-medium text-accent hover:underline"
                        >
                          All
                        </button>
                        <span aria-hidden className="text-border">
                          |
                        </span>
                        <button
                          type="button"
                          onClick={() => setChecked(ids, false)}
                          className="font-medium text-accent hover:underline"
                        >
                          None
                        </button>
                      </span>
                    )}
                  </div>
                  {s.fields.length === 0 && (
                    <p className="ml-3 px-3 text-xs text-ink-faint sm:ml-6">
                      No fields in this section yet.
                    </p>
                  )}
                  {s.fields.map((f) => (
                    <FieldRow
                      key={f.id}
                      id={f.id}
                      name={f.name}
                      kind={f.kind}
                      checked={isOn(f.id)}
                      required={isSystemRequired(f.id)}
                      yourName={names[f.id] ?? ""}
                      onCheck={(on) => setChecked([f.id], on)}
                      onName={(value) => {
                        const next = { ...names };
                        if (value) next[f.id] = value;
                        else delete next[f.id];
                        save({ names: next });
                      }}
                    />
                  ))}
                </section>
              );
            })}

          {!q && (
            <div className="mt-2 flex justify-end">
              {done.has(g) ? (
                <span className="text-sm font-semibold text-emerald-700">
                  ✓ {g} is done
                </span>
              ) : (
                <button
                  type="button"
                  onClick={finishGroup}
                  className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
                >
                  ✓ Done with {g}
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function FieldRow({
  id,
  name,
  kind,
  checked,
  required,
  yourName,
  onCheck,
  onName,
}: {
  id: string;
  name: string;
  kind?: Kind;
  checked: boolean;
  required: boolean;
  yourName: string;
  onCheck: (on: boolean) => void;
  onName: (value: string) => void;
}) {
  const aliases = OTC_FIELD_ALIASES[id];
  const type = KIND_LABELS[kind ?? ""] ?? "";
  return (
    <div
      className={`ml-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border bg-surface px-3 py-2 sm:ml-6 ${
        checked ? "border-accent/40" : "border-border"
      }`}
    >
      <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2.5">
        <input
          type="checkbox"
          checked={checked}
          disabled={required}
          onChange={(e) => onCheck(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0"
        />
        <span className="min-w-0">
          <span className={`text-sm text-accent ${checked ? "font-semibold" : ""}`}>{name}</span>
          {required && (
            <span className="ml-1.5 rounded bg-accent-soft px-1 py-px align-middle text-[10px] font-bold uppercase text-accent">
              Required by OTC
            </span>
          )}
          {aliases && (
            <span className="block text-xs text-ink-faint">Also called: {aliases.join(", ")}</span>
          )}
        </span>
      </label>
      {checked && (
        <>
          <input
            defaultValue={yourName}
            onBlur={(e) => {
              if (e.target.value.trim() !== yourName) onName(e.target.value.trim());
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            list={aliases ? `aliases-${id}` : undefined}
            maxLength={120}
            placeholder="Your name for it (if different)"
            aria-label={`What you call ${name}`}
            className="w-56 max-w-full rounded-md border border-border bg-bg px-2 py-1 text-xs text-ink outline-none focus:border-accent"
          />
          {aliases && (
            <datalist id={`aliases-${id}`}>
              {aliases.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          )}
        </>
      )}
      <span className="flex shrink-0 items-center gap-2 text-ink-faint">
        <TypeIcon kind={kind} />
        <span
          title={`${type} field${aliases ? `. Also called: ${aliases.join(", ")}` : ""}`}
          aria-label={`${type} field`}
          className="flex h-4 w-4 items-center justify-center rounded-full border border-current text-[10px] font-bold"
        >
          i
        </span>
      </span>
    </div>
  );
}

function Star() {
  return (
    <svg aria-hidden width="13" height="13" viewBox="0 0 24 24" className="shrink-0 fill-accent">
      <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" />
    </svg>
  );
}

// A small mark for the field's type (a calendar for dates, $ for dollars...).
function TypeIcon({ kind }: { kind?: Kind }) {
  const label = KIND_LABELS[kind ?? ""] ?? "";
  if (kind === "date") {
    return (
      <svg
        aria-label={label}
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-accent"
      >
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 3v4M16 3v4M9 15l2 2 4-4" />
      </svg>
    );
  }
  const glyph: Record<string, string> = {
    text: "Aa",
    text_area: "¶",
    currency: "$",
    percentage: "%",
    number: "#",
    choice: "☰",
  };
  return (
    <span aria-label={label} title={label} className="w-4 text-center text-xs font-bold">
      {glyph[kind ?? ""] ?? ""}
    </span>
  );
}
