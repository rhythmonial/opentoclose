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
  type OtcField,
} from "@/lib/otcFields";
import {
  saveOtcFieldSelection,
  type OtcFieldSelection,
} from "@/app/configurator/select_otc_fields/actions";

// OTC's field types, as its Field Editor names them.
const KIND_LABELS: Record<string, string> = {
  text: "Text",
  text_area: "Text Area",
  currency: "Decimal: Dollar",
  percentage: "Decimal: Percentage",
  date: "Date",
  number: "Number",
  choice: "Choice",
};

type Field = { id: string; name: string; kind?: Kind; isNew?: boolean };

// Finalize Your Fields, laid out like OTC's Field Editor: a tab per field
// group (checked off when the client has finished it), its sections, and
// their fields, each as "* Name (Type)" (* when OTC requires it). Fields
// assigned in Assign Your Workflow Fields are checked; the client checks
// any others they need, which are listed as fields needed. System required
// fields are always checked. Other names a field goes by show on hover and
// match the search.
export function OtcFieldSelector({
  accountId,
  initial,
  assigned,
  newFields,
  showSummary,
}: {
  // The client account (staff only; clients use their own).
  accountId: string | null;
  initial: OtcFieldSelection;
  // OTC field id -> where it's assigned on the contracts.
  assigned: Record<string, string[]>;
  // Fields the client added while assigning (shown in their sections).
  newFields: OtcField[];
  // The "Your fields" summary (staff only; clients use it later in the
  // course).
  showSummary: boolean;
}) {
  // Every section of OTC's field groups (empty ones too, as OTC shows
  // them), with the client's new fields at the end of theirs.
  const SECTIONS = OTC_SECTIONS.filter((s) => s.id !== CONTACT_ROLES_SECTION).map((s) => ({
    ...s,
    fields: [
      ...s.fields.map((f): Field => ({ ...f, id: `${s.id}/${slugOf(f.name)}` })),
      ...newFields
        .filter((f) => f.sectionId === s.id)
        .map((f): Field => ({ id: f.id, name: f.name, kind: f.kind, isNew: true })),
    ],
  }));
  const ALL_FIELDS = SECTIONS.flatMap((s) => s.fields);

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
      if (isSystemRequired(id) || assigned[id]) continue;
      if (on) next.add(id);
      else next.delete(id);
    }
    save({ picked: next });
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

  const isOn = (id: string) => isSystemRequired(id) || Boolean(assigned[id]) || picked.has(id);
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
      {/* Field group tabs, like OTC's group menu, always on one row (they
          share the width). A group marked done has a check. */}
      <div className="flex gap-1 sm:gap-2" role="tablist" aria-label="Field groups">
        {SELECTABLE_GROUPS.map((g) => {
          const active = !q && g === group;
          const [on, total] = groupCount(g);
          return (
            <button
              key={g}
              type="button"
              role="tab"
              aria-selected={active}
              title={`${g}: ${on} of ${total} checked${done.has(g) ? " · done" : ""}`}
              onClick={() => {
                setGroup(g);
                setQuery("");
              }}
              className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-x-1 rounded-lg border px-0.5 py-1.5 text-[9px] font-semibold min-[360px]:text-[10px] leading-tight transition-colors sm:flex-row sm:px-3 sm:py-2 sm:text-sm ${
                active
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : "border-border bg-surface text-ink-soft hover:border-emerald-500"
              }`}
            >
              {done.has(g) && (
                <span aria-hidden className={`hidden shrink-0 sm:inline ${active ? "text-white" : "text-emerald-600"}`}>
                  &#10003;
                </span>
              )}
              {/* On a phone the name can take two lines; wider, one. */}
              <span className="min-w-0 max-w-full break-words text-center sm:truncate">{g}</span>
              <span
                className={`shrink-0 text-[10px] font-normal sm:text-xs ${active ? "text-white/80" : "text-ink-faint"}`}
              >
                {done.has(g) && <span className="sm:hidden">&#10003; </span>}
                {on}/{total}
              </span>
            </button>
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
                      field={f}
                      checked={isOn(f.id)}
                      required={isSystemRequired(f.id)}
                      onContract={assigned[f.id]}
                      onCheck={(on) => setChecked([f.id], on)}
                      displayName={names[f.id] ?? ""}
                      onDisplayName={(value) => {
                        const next = { ...names };
                        if (value && value.toLowerCase() !== f.name.toLowerCase()) next[f.id] = value;
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

      {showSummary && (
        <YourFields
          sections={SECTIONS}
          isAssigned={(id) => Boolean(assigned[id])}
          isNeeded={(id) => !assigned[id] && (isSystemRequired(id) || picked.has(id))}
          names={names}
        />
      )}
    </div>
  );
}

function FieldRow({
  field,
  checked,
  required,
  onContract,
  onCheck,
  displayName,
  onDisplayName,
}: {
  field: Field;
  checked: boolean;
  required: boolean;
  // Where it's assigned on the contracts (it stays checked).
  onContract?: string[];
  onCheck: (on: boolean) => void;
  // How the client would like it displayed, if not OTC's name.
  displayName: string;
  onDisplayName: (value: string) => void;
}) {
  const aliases = OTC_FIELD_ALIASES[field.id];
  const locked = required || Boolean(onContract);
  return (
    <div
      className={`ml-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border bg-surface px-3 py-2 sm:ml-6 ${
        checked ? "border-accent/40" : "border-border"
      }`}
    >
      <label
        className={`flex min-w-[14rem] flex-1 items-center gap-2.5 ${locked ? "cursor-default" : "cursor-pointer"}`}
        title={
          onContract
            ? `On your contract (change it in Assign Your Workflow Fields):\n${onContract.join("\n")}`
            : undefined
        }
      >
        <input
          type="checkbox"
          checked={checked}
          disabled={locked}
          onChange={(e) => onCheck(e.target.checked)}
          className="h-4 w-4 shrink-0"
        />
        <FieldName field={field} required={required} bold={checked} />
        {onContract ? (
          <span className="shrink-0 rounded bg-accent-soft px-1.5 py-px text-[10px] font-bold uppercase text-accent">
            Contract
          </span>
        ) : (
          checked && (
            <span className="shrink-0 rounded bg-gold/25 px-1.5 py-px text-[10px] font-bold uppercase text-ink">
              Use
            </span>
          )
        )}
      </label>
      <span className="flex min-w-0 max-w-full items-center">
        <input
          key={displayName}
          defaultValue={displayName}
          onBlur={(e) => {
            if (e.target.value.trim() !== displayName) onDisplayName(e.target.value.trim());
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          maxLength={120}
          placeholder={
            aliases ? `Could be: ${aliases.slice(0, 3).join(", ")}…` : "Display as (optional)"
          }
          title={aliases ? `Could be: ${aliases.join(", ")}` : "How you'd like this field displayed"}
          aria-label={`How you'd like ${field.name} displayed`}
          className="w-[19.5rem] max-w-full rounded-md border border-border bg-bg px-2 py-1 text-xs text-ink outline-none placeholder:text-ink-faint focus:border-accent"
        />
      </span>
    </div>
  );
}

// "* Name (Type)": the asterisk when OTC requires it.
function FieldName({ field, required, bold }: { field: Field; required: boolean; bold?: boolean }) {
  const type = KIND_LABELS[field.kind ?? ""];
  return (
    <span className="min-w-0 text-sm">
      <span aria-hidden className="inline-block w-2.5 font-bold text-danger">
        {required ? "*" : ""}
      </span>
      {required && <span className="sr-only">Required: </span>}
      <span className={`text-accent ${bold ? "font-semibold" : ""}`}>{field.name}</span>
      {type && <span className="text-ink-soft"> ({type})</span>}
      {field.isNew && (
        <span className="ml-1.5 rounded bg-gold/20 px-1 py-px align-middle text-[10px] font-bold uppercase text-ink">
          New
        </span>
      )}
    </span>
  );
}

// The client's fields by section: the ones on their contracts, and the
// ones they need that aren't.
function YourFields({
  sections,
  isAssigned,
  isNeeded,
  names,
}: {
  sections: { id: string; name: string; group: string; fields: Field[] }[];
  isAssigned: (id: string) => boolean;
  isNeeded: (id: string) => boolean;
  names: Record<string, string>;
}) {
  const list = (pick: (id: string) => boolean) =>
    sections
      .map((s) => ({ ...s, fields: s.fields.filter((f) => pick(f.id)) }))
      .filter((s) => s.fields.length > 0);
  const columns = [
    {
      title: "On your contracts",
      empty: "None yet. Assign fields in Assign Your Workflow Fields.",
      sections: list(isAssigned),
    },
    {
      title: "Fields needed",
      empty: "None. Check a field above that isn't on your contracts to add it.",
      sections: list(isNeeded),
    },
  ];
  return (
    <section className="mt-4 rounded-xl border border-border bg-surface p-5">
      <h2 className="font-display text-lg font-bold text-ink">Your fields</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Every field you&rsquo;ll use in Open to Close: the ones on your contracts, and the
        ones you need that aren&rsquo;t.
      </p>
      <div className="mt-4 grid gap-6 md:grid-cols-2">
        {columns.map((c) => {
          const n = c.sections.reduce((sum, s) => sum + s.fields.length, 0);
          return (
            <div key={c.title}>
              <h3 className="text-xs font-bold uppercase tracking-wide text-ink-faint">
                {c.title} ({n})
              </h3>
              {n === 0 ? (
                <p className="mt-2 text-sm text-ink-faint">{c.empty}</p>
              ) : (
                c.sections.map((s) => (
                  <div key={s.id} className="mt-3">
                    <p className="text-xs font-semibold text-ink-soft">{s.name}</p>
                    <ul className="mt-1 flex flex-col gap-0.5">
                      {s.fields.map((f) => (
                        <li key={f.id}>
                          <FieldName field={f} required={isSystemRequired(f.id)} />
                          {names[f.id] && (
                            <span className="text-sm text-ink-soft"> &rarr; shown as &ldquo;{names[f.id]}&rdquo;</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Star() {
  return (
    <svg aria-hidden width="13" height="13" viewBox="0 0 24 24" className="shrink-0 fill-accent">
      <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" />
    </svg>
  );
}
