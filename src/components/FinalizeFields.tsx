"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { fieldLabel, type ContractBlank } from "@/lib/contractBlanks";
import {
  isContactRole,
  kindMatches,
  OTC_FIELDS,
  OTC_SECTIONS,
  sectionById,
  type OtcField,
} from "@/lib/otcFields";
import {
  isComplete,
  NEW_OTC_PREFIX,
  newOtcFieldsFrom,
  otcTargetOf,
  type WorkflowField,
} from "@/lib/workflowFields";
import { inContractOrder, typeLabel, type SummaryDoc } from "@/components/WorkflowFieldsSummary";
import { NewOtcFieldForm, OtcFieldList } from "@/components/OtcFieldList";
import { reassignFields } from "@/app/configurator/finalize_your_fields/actions";

type Row = { doc: SummaryDoc; field: WorkflowField; first: ContractBlank };

const KIND_NAMES: Record<string, string> = {
  contact: "Contact role",
  text: "Text",
  text_area: "Text area",
  currency: "Decimal Dollar",
  percentage: "Decimal Percent",
  date: "Date",
  number: "Number",
  choice: "Choice field",
};

// What's being reassigned, and the OTC fields it can go to.
type Reassigning = {
  // Which popover is open: a group's ("g:<target>") or a row's.
  anchor: string;
  from?: string;
  field?: { documentId: string; fieldId: string };
  label: string;
  selectedId?: string;
  kind: "contact" | "choice" | "field";
  pool: OtcField[];
  suggested: OtcField[];
  suggestedLabel?: string;
  adding: string | null;
};

// Finalize Your Fields: every workflow field the client assigned, grouped
// by the Open to Close field it fills (in contract order), with the full
// OTC field list beside it. Fields can be reassigned one at a time, or a
// whole group at once, which merges two OTC fields that are really the same
// one (like a new "Contract Date" that should be "Acceptance Date").
export function FinalizeFields({
  accountId,
  docs,
}: {
  // The client account being finalized (staff only; clients use their own).
  accountId: string | null;
  docs: SummaryDoc[];
}) {
  const [open, setOpen] = useState<Reassigning | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [flash, setFlash] = useState<string | null>(null);

  const rows: Row[] = docs.flatMap((doc) =>
    inContractOrder(doc).map((r) => ({ doc, field: r.field, first: r.first })),
  );
  const added = newOtcFieldsFrom(rows.map((r) => r.field));
  const otcFields = [...OTC_FIELDS, ...added];
  const otcById = new Map(otcFields.map((f) => [f.id, f] as const));

  // Groups by OTC field, in the order each first appears on the contracts;
  // fields not assigned yet come last.
  const groups = new Map<string, Row[]>();
  const unassigned: Row[] = [];
  for (const r of rows) {
    const target = otcTargetOf(r.field);
    if (!target) {
      unassigned.push(r);
      continue;
    }
    groups.set(target, [...(groups.get(target) ?? []), r]);
  }
  const uses = (id: string) => groups.get(id)?.length ?? 0;
  const multiDoc = docs.length > 1;

  const isOption = (f: WorkflowField) => f.type === "choice" && f.choice_role === "option";

  // The OTC fields something can be reassigned to, by what it is.
  function choicesFor(sample: WorkflowField) {
    if (sample.type === "contact") {
      return { kind: "contact" as const, pool: otcFields.filter(isContactRole), suggested: [] };
    }
    if (isOption(sample)) {
      return {
        kind: "choice" as const,
        pool: otcFields.filter((f) => !isContactRole(f) && f.kind === "choice"),
        suggested: [],
      };
    }
    const pool = otcFields.filter((f) => !isContactRole(f));
    return {
      kind: "field" as const,
      pool,
      suggested: pool.filter((f) => kindMatches(f.kind, sample.type, sample.decimal_format)),
    };
  }

  function openFor(anchor: string, sample: WorkflowField, extra: Partial<Reassigning>) {
    const { kind, pool, suggested } = choicesFor(sample);
    setError(null);
    setOpen({
      anchor,
      label: "",
      kind,
      pool,
      suggested,
      suggestedLabel: `Suggested for ${typeLabel(sample).toLowerCase()} fields`,
      adding: null,
      ...extra,
    });
  }

  function reassign(to: OtcField) {
    if (!open) return;
    const { from, field } = open;
    setOpen(null);
    startTransition(async () => {
      const result = await reassignFields({ accountId, from, field, to });
      if (!result.ok) setError(result.error ?? "Couldn't save that change.");
    });
  }

  function jumpTo(id: string) {
    document.getElementById(`group-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    setFlash(id);
    window.setTimeout(() => setFlash((f) => (f === id ? null : f)), 1600);
  }

  const popover = (anchor: string) =>
    open?.anchor === anchor ? (
      <ReassignPopover onClose={() => setOpen(null)}>
        {open.adding === null ? (
          <OtcFieldList
            title={`Reassign ${open.label} to…`}
            backLabel="Cancel"
            pool={open.pool}
            suggested={open.suggested}
            suggestedLabel={open.suggestedLabel}
            selectedId={open.selectedId}
            searchPlaceholder={
              open.kind === "contact"
                ? "Search contact roles"
                : open.kind === "choice"
                  ? "Search choice fields"
                  : "Search OTC fields"
            }
            emptyText="Nothing matches."
            addLabel={
              open.kind === "contact"
                ? "Add a new contact role"
                : open.kind === "choice"
                  ? "Add a new choice field"
                  : "Add a new OTC field"
            }
            onPick={reassign}
            onAddNew={(q) => setOpen({ ...open, adding: q })}
            onBack={() => setOpen(null)}
          />
        ) : (
          <NewOtcFieldForm
            defaultName={open.adding}
            kind={open.kind}
            onAdd={(name, sectionId) =>
              reassign({
                id: `${NEW_OTC_PREFIX}${crypto.randomUUID()}`,
                name,
                sectionId,
                kind: open.kind === "choice" ? "choice" : undefined,
                isNew: true,
              })
            }
            onBack={() => setOpen({ ...open, adding: null })}
          />
        )}
      </ReassignPopover>
    ) : null;

  const rowLine = (r: Row) => (
    <>
      {multiDoc && <span className="text-ink-faint">{r.doc.name} · </span>}
      <span className="text-ink-faint">
        {r.first.line ? `Line ${r.first.line}` : `Page ${r.first.page}`}
      </span>
    </>
  );

  // The OTC side panel: every field, with how often it's used.
  const q = query.trim().toLowerCase();
  const panelFields = otcFields.filter(
    (f) =>
      !q ||
      f.name.toLowerCase().includes(q) ||
      (sectionById(f.sectionId)?.name ?? "").toLowerCase().includes(q),
  );
  // Contact roles go last, after the fields.
  const order = new Map(
    OTC_SECTIONS.map((s, i) => [s.id, isContactRole({ sectionId: s.id }) ? 900 : i] as const),
  );
  const panelSections = new Map<string, OtcField[]>();
  for (const f of [...panelFields].sort(
    (a, b) => (order.get(a.sectionId) ?? 999) - (order.get(b.sectionId) ?? 999),
  )) {
    const name = sectionById(f.sectionId)?.name ?? "Your new fields";
    panelSections.set(name, [...(panelSections.get(name) ?? []), f]);
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold text-ink">Your fields</h2>
          <span className="text-xs text-ink-faint">
            {pending ? "Saving…" : `${groups.size} OTC fields · ${rows.length} contract fields`}
          </span>
        </div>
        {error && (
          <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        {rows.length === 0 && (
          <p className="rounded-xl border border-border bg-surface p-5 text-sm text-ink-soft">
            You haven&rsquo;t assigned any fields yet. Assign them in the Assign Your Workflow
            Fields lesson first.
          </p>
        )}

        {[...groups].map(([target, items]) => {
          const otc = otcById.get(target);
          const sample = items[0].field;
          const name =
            otc?.name ?? (isOption(sample) ? sample.question_text : undefined) ?? "Unknown field";
          const kindName = otc?.kind ? KIND_NAMES[otc.kind] : typeLabel(sample);
          const options = items.filter((r) => isOption(r.field));
          return (
            <section
              key={target}
              id={`group-${target}`}
              className={`scroll-mt-24 rounded-xl border bg-surface p-4 transition-colors ${
                flash === target ? "border-accent ring-2 ring-accent/30" : "border-border"
              }`}
            >
              <div className="relative flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">
                    {name}
                    {otc?.isNew && (
                      <span className="ml-1.5 rounded bg-gold/20 px-1 py-px align-middle text-[10px] font-bold uppercase text-ink">
                        New
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-ink-soft">
                    {kindName}
                    {otc && sectionById(otc.sectionId) && !isContactRole(otc)
                      ? ` · ${sectionById(otc.sectionId)!.name}`
                      : ""}
                    {options.length > 0 &&
                      ` · Options: ${[...new Set(options.map((r) => r.field.option_title).filter(Boolean))].join(", ")}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    openFor(`g:${target}`, sample, {
                      from: target,
                      label: items.length === 1 ? `“${name}”` : `all ${items.length} “${name}” fields`,
                      selectedId: target,
                    })
                  }
                  className="shrink-0 rounded-md border border-border px-2.5 py-1 text-xs font-semibold text-accent hover:bg-accent-soft/40"
                >
                  {items.length > 1 ? "Reassign all" : "Reassign"}
                </button>
                {popover(`g:${target}`)}
              </div>

              <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
                {items.map((r) => {
                  const anchor = `r:${r.doc.id}:${r.field.id}`;
                  return (
                    <li
                      key={anchor}
                      className="relative flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2 text-sm"
                    >
                      <span className="min-w-0">
                        <span className="text-ink">{fieldLabel(r.first)}</span>
                        {isOption(r.field) && r.field.option_title && (
                          <span className="text-ink-soft"> &rarr; {r.field.option_title}</span>
                        )}
                        <span className="block text-xs">
                          {rowLine(r)}
                          <span className="text-ink-faint"> · {typeLabel(r.field)}</span>
                        </span>
                      </span>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            openFor(anchor, r.field, {
                              field: { documentId: r.doc.id, fieldId: r.field.id },
                              label: `“${fieldLabel(r.first)}”`,
                              selectedId: target,
                            })
                          }
                          className="text-xs font-semibold text-ink-soft hover:text-accent"
                        >
                          Reassign this one
                        </button>
                      )}
                      {popover(anchor)}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}

        {unassigned.length > 0 && (
          <section className="rounded-xl border border-danger/40 bg-surface p-4">
            <p className="font-semibold text-ink">Not assigned yet</p>
            <p className="text-xs text-ink-soft">
              Pick an Open to Close field for each of these.
            </p>
            <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
              {unassigned.map((r) => {
                const anchor = `r:${r.doc.id}:${r.field.id}`;
                return (
                  <li
                    key={anchor}
                    className="relative flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2 text-sm"
                  >
                    <span className="min-w-0">
                      <span className="text-ink">{fieldLabel(r.first)}</span>
                      <span className="block text-xs">
                        {rowLine(r)}
                        <span className="text-ink-faint"> · {typeLabel(r.field)}</span>
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        openFor(anchor, r.field, {
                          field: { documentId: r.doc.id, fieldId: r.field.id },
                          label: `“${fieldLabel(r.first)}”`,
                        })
                      }
                      className="rounded-md border border-border px-2.5 py-1 text-xs font-semibold text-accent"
                    >
                      Assign
                    </button>
                    {popover(anchor)}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
        {rows.some((r) => !isComplete(r.field) && otcTargetOf(r.field)) && (
          <p className="text-xs text-danger">
            Some fields still need an answer (like a choice option&rsquo;s title). Finish them
            in Assign Your Workflow Fields.
          </p>
        )}
      </div>

      <aside className="lg:sticky lg:top-4 lg:self-start">
        <div className="rounded-xl border border-border bg-surface p-3">
          <h2 className="px-1 font-display text-base font-bold text-ink">Open to Close fields</h2>
          <p className="px-1 text-xs text-ink-soft">
            Used ones show how many of your fields fill them. Click one to find it.
          </p>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search OTC fields"
            aria-label="Search OTC fields"
            className="mt-2 w-full rounded-md border border-border bg-bg px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent"
          />
          <div className="mt-2 max-h-[70vh] overflow-y-auto">
            {[...panelSections].map(([section, items]) => (
              <div key={section}>
                <p className="sticky top-0 bg-surface px-1 pb-0.5 pt-2 text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                  {section}
                </p>
                {items.map((f) => {
                  const n = uses(f.id);
                  return n > 0 ? (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => jumpTo(f.id)}
                      className="flex w-full items-center justify-between gap-2 rounded-md px-1 py-1 text-left text-sm font-semibold text-ink hover:bg-accent-soft/40"
                    >
                      <span className="min-w-0">{f.name}</span>
                      <span className="shrink-0 rounded-full bg-accent px-1.5 text-[10px] font-bold text-white">
                        {n}
                      </span>
                    </button>
                  ) : (
                    <p key={f.id} className="px-1 py-1 text-sm text-ink-faint">
                      {f.name}
                    </p>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

// The reassign menu, opened under the button that opened it; closes on a
// click elsewhere or Escape.
function ReassignPopover({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) closeRef.current();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div
      ref={ref}
      role="menu"
      className="absolute right-0 top-full z-30 mt-1 flex w-72 flex-col rounded-lg border border-border bg-surface p-1 text-left shadow-lg"
    >
      {children}
    </div>
  );
}
