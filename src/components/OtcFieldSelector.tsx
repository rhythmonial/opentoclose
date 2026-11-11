"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CONTACT_ROLES_SECTION,
  isSystemRequired,
  OTC_FIELD_ALIASES,
  sectionsWith,
  type CustomSection,
  SELECTABLE_GROUPS,
  CUSTOM_FIELD_KINDS,
  slugOf,
  splitOptions,
  type CustomField,
  type Kind,
  type OtcField,
} from "@/lib/otcFields";
import {
  saveChoiceAdded,
  saveFieldPlaceholder,
  setNumberNotDate,
  tieNumberToDate,
  saveOtcFieldSelection,
  type OtcFieldSelection,
} from "@/app/configurator/select_otc_fields/actions";
import { renameCreatedField, unmapCreatedField } from "@/app/configurator/assign_your_workflow_fields/actions";
import { NewFieldMapper } from "@/components/WorkflowFieldNameCell";
import { OTC_FIELDS } from "@/lib/otcFields";
import { NEW_OTC_PREFIX } from "@/lib/workflowFields";
import { placeholderOf, type contractLines } from "@/lib/placeholders";

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

type Field = {
  id: string;
  name: string;
  kind?: Kind;
  isNew?: boolean;
  // A field the client added here.
  custom?: CustomField;
};

// Finalize Your Fields, laid out like OTC's Field Editor: a tab per field
// group (checked off when the client has finished it), its sections, and
// their fields, each as "* Name (Type)" (* when OTC requires it). Fields
// assigned in Assign Your Fields are checked; the client checks
// any others they need, which are listed as fields needed. System required
// fields are always checked. Other names a field goes by show on hover and
// match the search.
export function OtcFieldSelector({
  accountId,
  initial,
  assigned,
  firstSpot = {},
  newFields,
  showSummary,
  customSections = [],
  lines = {},
  savedPlaceholders = {},
  wasNew = {},
  choices = {},
  initialGroup,
  dateOf = {},
  suggestedDates = {},
  addedDates = [],
  notDates = [],
}: {
  // The client account (staff only; clients use their own).
  accountId: string | null;
  initial: OtcFieldSelection;
  // OTC field id -> where it's assigned on the contracts.
  assigned: Record<string, string[]>;
  // Where it first is: its contract's name and page ("Purchase Agreement #3").
  firstSpot?: Record<string, string>;
  // Fields the client added while assigning (shown in their sections).
  newFields: OtcField[];
  // The "Your fields" summary (staff only; clients use it later in the
  // course).
  showSummary: boolean;
  // Sections the client added (shown at the end of their groups).
  customSections?: CustomSection[];
  // Each field's line on the contracts, and the placeholders they've set.
  lines?: ReturnType<typeof contractLines>;
  savedPlaceholders?: Record<string, string>;
  // OTC fields that were fields they added (↺ puts the added one back).
  wasNew?: Record<string, { id: string; name: string }>;
  // Each choice field's options: OTC's, the ones on their contracts, and
  // the ones they've added (shown when its "(Choice)" is clicked).
  choices?: Record<string, { defaults: string[]; contract: string[]; added: string[] }>;
  // The group to open on (from the page's address, kept as they switch so a
  // reload comes back to it).
  initialGroup?: string;
  // Number fields: the date each is the days for, and ones that aren't any
  // date's days; and dates added in Select Your Date Fields.
  dateOf?: Record<string, string>;
  // The date Select Your Date Fields paired each with on its own.
  suggestedDates?: Record<string, string>;
  addedDates?: { id: string; name: string }[];
  notDates?: string[];
}) {
  const router = useRouter();
  // Every section of OTC's field groups (empty ones too, as OTC shows
  // them), with the client's new fields at the end of theirs.
  const [custom, setCustom] = useState<CustomField[]>(initial.custom);
  // Fields they added while assigning, renamed here.
  const [renamed, setRenamed] = useState<Record<string, string>>({});
  // The section a field is being added to, or the field being edited.
  const [dialog, setDialog] = useState<{ sectionId: string; field?: CustomField } | null>(null);
  const SECTIONS = sectionsWith(customSections).filter((s) => s.id !== CONTACT_ROLES_SECTION).map((s) => ({
    ...s,
    fields: [
      ...s.fields.map((f): Field => ({ ...f, id: `${s.id}/${slugOf(f.name)}` })),
      ...newFields
        .filter((f) => f.sectionId === s.id)
        .map((f): Field => ({ id: f.id, name: renamed[f.id] ?? f.name, kind: f.kind, isNew: true })),
      ...custom
        .filter((f) => f.sectionId === s.id)
        .map((f): Field => ({ id: f.id, name: f.name, kind: f.kind, isNew: true, custom: f })),
    ],
  }));
  const ALL_FIELDS = SECTIONS.flatMap((s) => s.fields);
  const customIds = new Set(custom.map((f) => f.id));

  const [picked, setPicked] = useState<Set<string>>(() => new Set(initial.fields));
  const [names, setNames] = useState<Record<string, string>>(initial.names);
  const [placeholders, setPlaceholders] = useState(savedPlaceholders);
  const [added, setAdded] = useState(() =>
    Object.fromEntries(Object.entries(choices).map(([id, c]) => [id, c.added])),
  );
  const [choiceFor, setChoiceFor] = useState<Field | null>(null);
  const [ties, setTies] = useState(dateOf);
  const [notDate, setNotDate] = useState(() => new Set(notDates));
  const [numberFor, setNumberFor] = useState<{ field: Field; sectionId: string } | null>(null);
  const [dateNames, setDateNames] = useState(() => new Map(addedDates.map((d) => [d.id, d.name] as const)));
  async function saveAdded(id: string, next: string[]) {
    setAdded((a) => ({ ...a, [id]: next }));
    setStatus("saving");
    const res = await saveChoiceAdded(accountId, id, next);
    setStatus(res.ok ? "saved" : "error");
    setError(res.ok ? null : (res.error ?? "Couldn't save."));
  }
  async function savePlaceholder(id: string, text: string) {
    setPlaceholders((p) => ({ ...p, [id]: text }));
    setStatus("saving");
    const res = await saveFieldPlaceholder(accountId, id, text);
    setStatus(res.ok ? "saved" : "error");
    setError(res.ok ? null : (res.error ?? "Couldn't save."));
  }
  const [done, setDone] = useState<Set<string>>(() => new Set(initial.groupsDone));
  const [group, setGroupState] = useState(() =>
    initialGroup && SELECTABLE_GROUPS.includes(initialGroup)
      ? initialGroup
      : (SELECTABLE_GROUPS.find((g) => !initial.groupsDone.includes(g)) ?? SELECTABLE_GROUPS[0]),
  );
  const setGroup = (g: string) => {
    setGroupState(g);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("group", g);
      window.history.replaceState(window.history.state, "", url);
    } catch {}
  };
  const [query, setQuery] = useState("");
  const [onlyChecked, setOnlyChecked] = useState(false);
  const [status, setStatus] = useState<"saving" | "saved" | "error" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const top = useRef<HTMLDivElement>(null);

  function save(next: {
    picked?: Set<string>;
    names?: Record<string, string>;
    done?: Set<string>;
    custom?: CustomField[];
  }) {
    const p = next.picked ?? picked;
    const n = next.names ?? names;
    const d = next.done ?? done;
    const c = next.custom ?? custom;
    if (next.picked) setPicked(p);
    if (next.names) setNames(n);
    if (next.done) setDone(d);
    if (next.custom) setCustom(c);
    setStatus("saving");
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      const result = await saveOtcFieldSelection(accountId, {
        fields: [...p],
        names: n,
        groupsDone: [...d],
        custom: c,
      });
      setStatus(result.ok ? "saved" : "error");
      setError(result.ok ? null : (result.error ?? "Couldn't save."));
    }, 500);
  }

  // Unchecking a field also drops its display name (typed again if it's
  // checked again).
  function setChecked(ids: string[], on: boolean) {
    const next = new Set(picked);
    const nextNames = { ...names };
    for (const id of ids) {
      if (isSystemRequired(id) || assigned[id]) continue;
      if (on) next.add(id);
      else {
        next.delete(id);
        delete nextNames[id];
      }
    }
    save({ picked: next, names: nextNames });
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

  // Fields they added here are always in use.
  const isOn = (id: string) =>
    isSystemRequired(id) || Boolean(assigned[id]) || picked.has(id) || customIds.has(id);
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
      {/* Field group tabs, styled like the page buttons in Upload Your
          Contracts with how many fields are checked, sharing the width. */}
      <div className="flex gap-1 sm:gap-2" role="tablist" aria-label="Field groups">
        {SELECTABLE_GROUPS.map((g) => {
          const active = !q && g === group;
          const [on] = groupCount(g);
          return (
            <button
              key={g}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setGroup(g);
                setQuery("");
              }}
              className={`flex min-w-0 flex-1 items-center justify-center rounded-md border px-1 py-2 text-center text-[11px] font-semibold leading-tight sm:px-3 sm:text-sm ${
                active ? "border-accent bg-accent text-white" : "border-border bg-surface text-ink-soft"
              }`}
            >
              <span className="min-w-0 break-words sm:truncate">
                {g}
                <span className={active ? "text-white/80" : "text-ink-faint"}> &middot; {on}</span>
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
                    <span className="flex items-center gap-1.5 text-xs">
                      <button
                        type="button"
                        onClick={() => setDialog({ sectionId: s.id })}
                        aria-label={`Add your own field to ${s.name}`}
                        title={`Add your own field to ${s.name}`}
                        className="flex h-5 w-5 items-center justify-center rounded-full text-base font-semibold leading-none text-accent hover:bg-accent-soft"
                      >
                        +
                      </button>
                    {ids.length > 0 && (
                      <>
                        <span aria-hidden className="text-border">
                          |
                        </span>
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
                      </>
                    )}
                    </span>
                  </div>
                  {s.fields.length === 0 && (
                    <p className="ml-3 px-3 text-xs text-ink-faint sm:ml-6">
                      No fields in this section yet.
                    </p>
                  )}
                  {s.fields.map((f) =>
                    f.custom ? (
                      <CustomFieldRow
                        key={f.id}
                        field={f.custom}
                        onEdit={() => setDialog({ sectionId: s.id, field: f.custom })}
                        onDelete={() => save({ custom: custom.filter((c) => c.id !== f.id) })}
                      />
                    ) : (
                    <FieldRow
                      key={f.id}
                      field={f}
                      checked={isOn(f.id)}
                      required={isSystemRequired(f.id)}
                      onContract={assigned[f.id]}
                      spot={firstSpot[f.id]}
                      onCheck={(on) => setChecked([f.id], on)}
                      displayName={names[f.id] ?? ""}
                      accountId={accountId}
                      placeholder={placeholderOf(f.id, lines, placeholders)}
                      line={lines[f.id]?.line ?? null}
                      onPlaceholder={(text) => savePlaceholder(f.id, text)}
                      wasNew={wasNew[f.id]}
                      onChoices={choices[f.id] ? () => setChoiceFor(f) : undefined}
                      onNumber={f.kind === "number" ? () => setNumberFor({ field: f, sectionId: s.id }) : undefined}
                      numberDone={Boolean(ties[f.id]) || notDate.has(f.id)}
                      onRename={
                        f.id.startsWith(NEW_OTC_PREFIX)
                          ? async (name) => {
                              setRenamed((r) => ({ ...r, [f.id]: name }));
                              setStatus("saving");
                              const res = await renameCreatedField(accountId, f.id, name);
                              setStatus(res.ok ? "saved" : "error");
                              setError(res.ok ? null : (res.error ?? "Couldn't save."));
                              if (res.ok) router.refresh();
                            }
                          : undefined
                      }
                      onMappedTo={(to) => {
                        // Its name goes in the rename box (saved already),
                        // and the page catches up without reloading.
                        if (f.name.trim().toLowerCase() !== to.name.toLowerCase()) {
                          setNames((n) => ({ ...n, [to.id]: f.name }));
                        }
                        router.refresh();
                      }}
                      onPutBack={(was) => {
                        setNames((n) => {
                          if (n[f.id]?.trim().toLowerCase() !== was.name.trim().toLowerCase()) return n;
                          const next = { ...n };
                          delete next[f.id];
                          return next;
                        });
                        router.refresh();
                      }}
                      onDisplayName={(value) => {
                        const next = { ...names };
                        if (value && value.toLowerCase() !== f.name.toLowerCase()) next[f.id] = value;
                        else delete next[f.id];
                        save({ names: next });
                      }}
                    />
                    ),
                  )}
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

      {numberFor && (
        <NumberDateDialog
          name={numberFor.field.name}
          sectionName={SECTIONS.find((x) => x.id === numberFor.sectionId)?.name ?? ""}
          dates={[
            ...OTC_FIELDS.filter((o) => o.kind === "date").map((o) => ({ id: o.id, name: o.name })),
            ...newFields.filter((o) => o.kind === "date").map((o) => ({ id: o.id, name: o.name })),
            ...custom.filter((o) => o.kind === "date").map((o) => ({ id: o.id, name: o.name })),
            ...[...dateNames].map(([id, name]) => ({ id, name })),
          ].filter((d, i, all) => all.findIndex((x) => x.id === d.id) === i)}
          tiedTo={ties[numberFor.field.id] ?? null}
          suggested={suggestedDates[numberFor.field.id] ?? null}
          notDate={notDate.has(numberFor.field.id)}
          onTie={async (date) => {
            const numberId = numberFor.field.id;
            setNumberFor(null);
            // A date they add here is one of their fields, in the number's
            // section.
            if (date.isNew) {
              save({
                custom: [...custom, { id: date.id, name: date.name, sectionId: numberFor.sectionId, kind: "date" }],
              });
              setDateNames((m) => new Map(m).set(date.id, date.name));
            } else if (!isOn(date.id) && OTC_FIELDS.some((o) => o.id === date.id)) {
              setChecked([date.id], true);
            }
            setTies((t) => ({ ...t, [numberId]: date.id }));
            setNotDate((n) => {
              const next = new Set(n);
              next.delete(numberId);
              return next;
            });
            setStatus("saving");
            const res = await tieNumberToDate(accountId, numberId, date.id, date.isNew ? date.name : undefined);
            setStatus(res.ok ? "saved" : "error");
            setError(res.ok ? null : (res.error ?? "Couldn't save."));
          }}
          onNotDate={async (on) => {
            const numberId = numberFor.field.id;
            setNumberFor(null);
            setNotDate((n) => {
              const next = new Set(n);
              if (on) next.add(numberId);
              else next.delete(numberId);
              return next;
            });
            if (on) {
              setTies((t) => {
                const next = { ...t };
                delete next[numberId];
                return next;
              });
            }
            setStatus("saving");
            const res = await setNumberNotDate(accountId, numberId, on);
            setStatus(res.ok ? "saved" : "error");
            setError(res.ok ? null : (res.error ?? "Couldn't save."));
          }}
          onClose={() => setNumberFor(null)}
        />
      )}
      {choiceFor && choices[choiceFor.id] && (
        <ChoiceOptionsDialog
          name={choiceFor.name}
          defaults={choices[choiceFor.id].defaults}
          contract={choices[choiceFor.id].contract}
          added={added[choiceFor.id] ?? []}
          onAdded={(next) => saveAdded(choiceFor.id, next)}
          onClose={() => setChoiceFor(null)}
        />
      )}
      {dialog && (
        <CustomFieldDialog
          sectionName={SECTIONS.find((x) => x.id === dialog.sectionId)?.name ?? ""}
          field={dialog.field}
          onClose={() => setDialog(null)}
          onSave={(value) => {
            const next = dialog.field
              ? custom.map((c) => (c.id === dialog.field!.id ? { ...c, ...value } : c))
              : [
                  ...custom,
                  { id: `new-otc:${crypto.randomUUID()}`, sectionId: dialog.sectionId, ...value },
                ];
            save({ custom: next });
            setDialog(null);
          }}
        />
      )}

      {showSummary && (
        <YourFields
          sections={SECTIONS}
          isAssigned={(id) => Boolean(assigned[id])}
          isNeeded={(id) =>
            !assigned[id] && (isSystemRequired(id) || picked.has(id) || customIds.has(id))
          }
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
  accountId,
  placeholder,
  line,
  onPlaceholder,
  wasNew,
  onChoices,
  onNumber,
  numberDone,
  onMappedTo,
  onPutBack,
  onRename,
  spot,
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
  accountId: string | null;
  // Its placeholder ("" for none), and its line on the contracts.
  placeholder: string;
  line: number | null;
  onPlaceholder: (text: string) => void;
  wasNew?: { id: string; name: string };
  // Opens its choice options (a choice field).
  onChoices?: () => void;
  // Opens the date it's the days for (a number field), and whether that's
  // settled (tied to a date, or marked as not a date's days).
  onNumber?: () => void;
  numberDone?: boolean;
  // After a field they added is pointed at an OTC field, or put back.
  onMappedTo: (to: OtcField) => void;
  onPutBack: (was: { id: string; name: string }) => void;
  // Renames a field they added (with the pencil beside its name).
  onRename?: (name: string) => void;
  spot?: string;
}) {
  const [renaming, setRenaming] = useState(false);
  const aliases = OTC_FIELD_ALIASES[field.id];
  const created = field.id.startsWith(NEW_OTC_PREFIX);
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
            ? `On your contract (change it in Assign Your Fields):\n${onContract.join("\n")}`
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
        {renaming && onRename ? (
          <input
            autoFocus
            defaultValue={field.name}
            maxLength={120}
            aria-label={`Rename ${field.name}`}
            onFocus={(e) => e.currentTarget.select()}
            onClick={(e) => e.preventDefault()}
            onBlur={(e) => {
              setRenaming(false);
              const next = e.target.value.replace(/\s+/g, " ").trim();
              if (next && next !== field.name) onRename(next);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                e.currentTarget.value = field.name;
                e.currentTarget.blur();
              }
            }}
            className="min-w-0 flex-1 rounded-md border border-accent bg-surface px-2 py-0.5 text-sm text-ink outline-none"
          />
        ) : (
          <>
            <FieldName
              field={field}
              required={required}
              bold={checked}
              onType={checked ? (onChoices ?? onNumber) : undefined}
              tone={checked && onNumber ? (numberDone ? "done" : "needed") : undefined}
            />
            {/* A field they added and pointed at this one: ↺ puts it back. */}
            {wasNew && (
              <button
                type="button"
                title={`Put back "${wasNew.name}" as your new field`}
                aria-label={`Put back ${wasNew.name}`}
                onClick={async (e) => {
                  e.preventDefault();
                  const res = await unmapCreatedField(accountId, wasNew.id);
                  if (res.ok) onPutBack(wasNew);
                }}
                className="shrink-0 rounded px-1 text-sm leading-none text-ink-soft hover:bg-accent-soft/60 hover:text-accent"
              >
                &#8634;
              </button>
            )}
            {onRename && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setRenaming(true);
                }}
                title="Rename"
                aria-label={`Rename ${field.name}`}
                className="shrink-0 rounded p-0.5 text-ink-faint hover:bg-accent-soft/60 hover:text-accent"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
              </button>
            )}
          </>
        )}
        {onContract && (
          <span className="max-w-[14rem] shrink-0 truncate rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent">
            {spot ?? "Contract"}
            {onContract.length > 1 && ` +${onContract.length - 1}`}
          </span>
        )}
      </label>
      {/* Fields in use get a placeholder and can be renamed (or, for one
          they added, pointed at an Open to Close field instead). */}
      {checked && (
        <span className="flex max-w-full flex-wrap items-center gap-2">
          {created ? (
            <NewFieldMapper
              accountId={accountId}
              createdId={field.id}
              createdName={field.name}
              choices={OTC_FIELDS.filter((o) => o.kind === field.kind)}
              onPicked={onMappedTo}
            />
          ) : (
            <span className="relative inline-flex">
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
                placeholder="Rename"
                title={aliases ? `Could be: ${aliases.join(", ")}` : "What you'd like this field called"}
                aria-label={`Rename ${field.name}`}
                className={`w-[12rem] max-w-full rounded-md border border-border bg-bg py-1 pl-2 text-xs text-ink outline-none placeholder:text-ink-faint focus:border-accent pr-2`}
              />
            </span>
          )}
          <PlaceholderCell
            key={placeholder}
            value={placeholder}
            line={line}
            name={field.name}
            onSave={onPlaceholder}
          />
        </span>
      )}
    </div>
  );
}

// "* Name (Type)": the asterisk when OTC requires it.
function FieldName({
  field,
  required,
  bold,
  onType,
  tone,
}: {
  field: Field;
  required: boolean;
  bold?: boolean;
  // Clicking the type (a choice field's options, a number's date).
  onType?: () => void;
  // A number field: red until it's tied to a date (or isn't one), then green.
  tone?: "needed" | "done";
}) {
  const type = KIND_LABELS[field.kind ?? ""];
  return (
    <span className="min-w-0 text-sm">
      <span aria-hidden className="inline-block w-2.5 font-bold text-danger">
        {required ? "*" : ""}
      </span>
      {required && <span className="sr-only">Required: </span>}
      <span className={`text-accent ${bold ? "font-semibold" : ""}`}>{field.name}</span>
      {type &&
        (onType ? (
          <>
            {" "}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                onType();
              }}
              title={
                tone === "needed"
                  ? "Pick the date this is the number of days for"
                  : tone === "done"
                    ? "Change the date this is the number of days for"
                    : "See and add its choice options"
              }
              className={
                tone === "needed"
                  ? "rounded bg-danger/10 px-1 font-semibold text-danger hover:bg-danger/20"
                  : tone === "done"
                    ? "rounded bg-success-soft px-1 text-success hover:bg-success/20"
                    : "text-ink-soft underline decoration-dotted underline-offset-2 hover:text-accent"
              }
            >
              ({type})
            </button>
          </>
        ) : (
          <span className="text-ink-soft"> ({type})</span>
        ))}
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
      empty: "None yet. Assign fields in Assign Your Fields.",
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

// A field the client added here: always in use, with its type (and a
// choice field's options), to edit or delete.
function CustomFieldRow({
  field,
  onEdit,
  onDelete,
}: {
  field: CustomField;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const options = field.kind === "choice" && field.options?.length ? field.options.join(", ") : "";
  return (
    <div className="ml-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-accent/40 bg-surface px-3 py-2 sm:ml-6">
      <span className="flex min-w-[14rem] flex-1 items-center gap-2.5">
        <input type="checkbox" checked disabled readOnly className="h-4 w-4 shrink-0" aria-label={`${field.name} (in use)`} />
        <span className="min-w-0 text-sm" title={options ? `Options: ${options}` : undefined}>
          <span aria-hidden className="inline-block w-2.5" />
          <span className="font-semibold text-accent">{field.name}</span>
          <span className="text-ink-soft"> ({KIND_LABELS[field.kind ?? ""]})</span>
          <span className="ml-1.5 rounded bg-gold/20 px-1 py-px align-middle text-[10px] font-bold uppercase text-ink">
            New
          </span>
          {options && <span className="ml-1.5 text-xs text-ink-soft">{options}</span>}
        </span>
        <span className="shrink-0 rounded bg-gold/25 px-1.5 py-px text-[10px] font-bold uppercase text-ink">
          Use
        </span>
      </span>
      <span className="flex items-center gap-3 text-xs font-semibold">
        <button type="button" onClick={onEdit} className="text-accent hover:underline">
          Edit
        </button>
        <button type="button" onClick={onDelete} className="text-danger hover:underline">
          Delete
        </button>
      </span>
    </div>
  );
}

// Adds (or edits) a field of the client's own: its name, its type, and for
// a choice field, its options separated by commas.
function CustomFieldDialog({
  sectionName,
  field,
  onSave,
  onClose,
}: {
  sectionName: string;
  field?: CustomField;
  onSave: (value: { name: string; kind: Kind; options?: string[] }) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(field?.name ?? "");
  const [kind, setKind] = useState<Kind>(field?.kind ?? "text");
  const [options, setOptions] = useState(field?.options?.join(", ") ?? "");
  const parsed = splitOptions(options);
  const ready = name.trim().length > 0 && (kind !== "choice" || parsed.length > 0);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="custom-field-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!ready) return;
          onSave({
            name: name.trim().slice(0, 120),
            kind,
            ...(kind === "choice" ? { options: parsed } : {}),
          });
        }}
        className="w-full max-w-md rounded-xl border border-border bg-surface p-5 shadow-xl"
      >
        <h2 id="custom-field-title" className="font-display text-lg font-bold text-ink">
          {field ? "Edit your field" : "Add your own field"}
        </h2>
        <p className="mt-0.5 text-sm text-ink-soft">In {sectionName}</p>

        <label className="mt-4 block text-sm font-semibold text-ink">
          Field name
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            placeholder="e.g. HOA Transfer Fee"
            className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm font-normal text-ink outline-none focus:border-accent"
          />
        </label>

        <label className="mt-3 block text-sm font-semibold text-ink">
          Field type
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as Kind)}
            className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm font-normal text-ink outline-none focus:border-accent"
          >
            {CUSTOM_FIELD_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </label>

        {kind === "choice" && (
          <label className="mt-3 block text-sm font-semibold text-ink">
            Choice options
            <textarea
              value={options}
              onChange={(e) => setOptions(e.target.value)}
              rows={3}
              placeholder="e.g. Yes, No, Not Sure"
              className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm font-normal text-ink outline-none focus:border-accent"
            />
            <span className="mt-1 block text-xs font-normal text-ink-faint">
              Separate each option with a comma.
              {parsed.length > 0 && ` ${parsed.length} option${parsed.length === 1 ? "" : "s"}.`}
            </span>
          </label>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-ink-soft hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!ready}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {field ? "Save field" : "Add field"}
          </button>
        </div>
      </form>
    </div>
  );
}

// A field's placeholder: its text to edit (clearing it removes it), or a +
// to add one, which starts with the field's contract line ("134- ").
function PlaceholderCell({
  value,
  line,
  name,
  onSave,
}: {
  value: string;
  line: number | null;
  name: string;
  onSave: (text: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const start = line ? `${line}- ` : "";
  const box = useRef<HTMLInputElement>(null);
  if (!value && !adding) {
    return (
      <button
        type="button"
        onClick={() => setAdding(true)}
        title="Add a placeholder"
        aria-label={`Add a placeholder for ${name}`}
        className="flex w-[12rem] items-center gap-1 rounded-md border border-dashed border-border px-2 py-1 text-xs font-medium text-ink-faint hover:border-accent hover:text-accent"
      >
        <span className="text-sm leading-none">+</span> Placeholder
      </button>
    );
  }
  // Leaving a new one as just its line adds nothing.
  const save = (text: string) => {
    const next = text.replace(/\s+/g, " ").trim();
    setAdding(false);
    if (!value && next === start.trim()) return;
    if (next !== value) onSave(next);
  };
  return (
    <span className="relative inline-flex w-[12rem] max-w-full">
      <input
        ref={box}
        defaultValue={value || start}
        autoFocus={adding}
        onFocus={(e) => {
          const end = e.currentTarget.value.length;
          e.currentTarget.setSelectionRange(end, end);
        }}
        onBlur={(e) => save(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        maxLength={200}
        placeholder="Placeholder"
        aria-label={`Placeholder for ${name}`}
        className="w-full rounded-md border border-border bg-bg py-1 pl-2 pr-12 text-xs text-ink outline-none placeholder:text-ink-faint focus:border-accent"
      />
      <span className="absolute inset-y-0 right-1 flex items-center gap-0.5">
        <button
          type="button"
          // Not taking focus from the box first (which would save it).
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => save(box.current?.value ?? "")}
          title="Save placeholder"
          aria-label={`Save the placeholder for ${name}`}
          className="rounded px-1 text-sm leading-none text-success hover:bg-success-soft"
        >
          &#10003;
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setAdding(false);
            if (value) onSave("");
          }}
          title="Delete placeholder"
          aria-label={`Delete the placeholder for ${name}`}
          className="rounded px-1 text-sm leading-none text-danger hover:bg-danger/10"
        >
          &times;
        </button>
      </span>
    </span>
  );
}

// A choice field's options in a popup: Open to Close's, the ones on their
// contracts, and the ones they've added (which can be taken off), with a
// box to add more.
function ChoiceOptionsDialog({
  name,
  defaults,
  contract,
  added,
  onAdded,
  onClose,
}: {
  name: string;
  defaults: string[];
  contract: string[];
  added: string[];
  onAdded: (next: string[]) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const all = [...defaults, ...contract, ...added];
  const add = () => {
    const t = text.trim().slice(0, 120);
    setText("");
    if (!t || all.some((x) => x.toLowerCase() === t.toLowerCase())) return;
    onAdded([...added, t]);
  };
  const chips = (items: string[], remove?: (t: string) => void) => (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {items.map((t) => (
        <span
          key={t}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-bg px-2.5 py-0.5 text-xs text-ink"
        >
          {t}
          {remove && (
            <button
              type="button"
              onClick={() => remove(t)}
              aria-label={`Remove ${t}`}
              className="text-ink-faint hover:text-danger"
            >
              &times;
            </button>
          )}
        </span>
      ))}
    </div>
  );
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="choice-options-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-xl border border-border bg-surface p-5 shadow-xl">
        <h2 id="choice-options-title" className="font-display text-lg font-bold text-ink">
          {name} options
        </h2>
        {defaults.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-semibold text-ink-soft">Open to Close&rsquo;s options</p>
            {chips(defaults)}
          </div>
        )}
        {contract.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-semibold text-ink-soft">From your contracts</p>
            {chips(contract)}
          </div>
        )}
        {added.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-semibold text-ink-soft">Added by you</p>
            {chips(added, (t) => onAdded(added.filter((x) => x !== t)))}
          </div>
        )}
        {all.length === 0 && <p className="mt-3 text-sm text-ink-faint">No options yet.</p>}
        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={120}
            placeholder="Add an option"
            aria-label={`Add an option to ${name}`}
            className="min-w-0 flex-1 rounded-md border border-border bg-bg px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={!text.trim()}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Add
          </button>
        </form>
        <div className="mt-4 flex justify-end">
          <button type="button" onClick={onClose} className="text-sm font-semibold text-ink-soft">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// A number field's date: the one it's the number of days for. They search
// their dates (or add one, in the number's section), or say it isn't the
// days for any date.
function NumberDateDialog({
  name,
  sectionName,
  dates,
  tiedTo,
  suggested,
  notDate,
  onTie,
  onNotDate,
  onClose,
}: {
  name: string;
  sectionName: string;
  dates: { id: string; name: string }[];
  tiedTo: string | null;
  suggested: string | null;
  notDate: boolean;
  onTie: (date: { id: string; name: string; isNew?: boolean }) => void;
  onNotDate: (on: boolean) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const matches = dates
    .filter((d) => !q || d.name.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name));
  const exact = dates.some((d) => d.name.toLowerCase() === q);
  const tied = dates.find((d) => d.id === tiedTo);
  const hint = !tied ? dates.find((d) => d.id === suggested) : undefined;
  const addNew = () =>
    onTie({ id: `new-otc:${crypto.randomUUID()}`, name: query.trim().slice(0, 120), isNew: true });
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="number-date-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-xl border border-border bg-surface p-5 shadow-xl">
        <h2 id="number-date-title" className="font-display text-lg font-bold text-ink">
          {name}
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          {tied
            ? <>The number of days for <span className="font-semibold text-ink">{tied.name}</span>. Pick another date to change it.</>
            : notDate
              ? "Marked as not the days for a date."
              : "Which date is this the number of days for?"}
        </p>
        {hint && (
          <button
            type="button"
            onClick={() => onTie(hint)}
            className="mt-2 self-start rounded-lg border border-accent px-3 py-1.5 text-sm font-semibold text-accent hover:bg-accent-soft/50"
          >
            Suggested: {hint.name}
          </button>
        )}
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            if (matches.length === 1) onTie(matches[0]);
            else if (q && !exact) addNew();
          }}
          placeholder="Search date fields"
          aria-label="Search date fields"
          className="mt-3 rounded-md border border-border bg-bg px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent"
        />
        <div className="mt-2 min-h-0 flex-1 overflow-y-auto rounded-md border border-border">
          {matches.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => onTie(d)}
              className={`block w-full px-3 py-1.5 text-left text-sm ${
                d.id === tiedTo ? "bg-accent text-white" : "text-ink hover:bg-accent-soft/50"
              }`}
            >
              {d.name}
            </button>
          ))}
          {matches.length === 0 && <p className="px-3 py-2 text-xs text-ink-faint">No date fields match.</p>}
        </div>
        {q && !exact && (
          <button type="button" onClick={addNew} className="mt-2 self-start text-sm font-semibold text-accent">
            + Add date field &ldquo;{query.trim()}&rdquo;{sectionName && ` in ${sectionName}`}
          </button>
        )}
        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onNotDate(!notDate)}
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-ink-soft hover:border-accent hover:text-accent"
          >
            {notDate ? "It is tied to a date field" : "Not tied to a date field"}
          </button>
          <button type="button" onClick={onClose} className="text-sm font-semibold text-ink-soft">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
