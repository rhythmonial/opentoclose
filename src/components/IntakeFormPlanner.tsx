"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { MultiSelect } from "@/components/MultiSelect";
import { DocSpotIcon } from "@/components/DocSpotIcon";
import { VALUE_OPTIONS, type IntakeTrigger, type IntakeTriggers } from "@/lib/intakeForm";
import { saveIntakeForm } from "@/app/configurator/prep_your_intake_form/actions";

export type IntakeField = {
  id: string;
  name: string;
  // "Choice", "Date"… ("" when unknown).
  kind: string;
  section: string;
  // A choice field's options (null for any other field).
  options: string[] | null;
};

// Prep Your Intake Form: a row per field on the form (contract fields in
// contract order, then ones they added), with Required, the templates the
// field brings in, and which answers bring them in. A field can have more
// than one trigger ("FHA, VA, Conventional" → loan templates; "Cash" →
// cash ones).
export function IntakeFormPlanner({
  accountId,
  fields,
  contractIds,
  spots,
  initialAdded,
  initialRequired,
  initialTriggers,
  templates,
}: {
  accountId: string | null;
  fields: IntakeField[];
  contractIds: string[];
  spots: Record<string, string>;
  initialAdded: string[];
  initialRequired: string[];
  initialTriggers: IntakeTriggers;
  // "Tasks: B - General", "Docs: B Inspection Documents"…
  templates: string[];
}) {
  const [added, setAdded] = useState(initialAdded);
  const [required, setRequired] = useState(initialRequired);
  const [triggers, setTriggers] = useState(initialTriggers);
  const [status, setStatus] = useState<"saving" | "saved" | "error" | null>(null);
  const byId = new Map(fields.map((f) => [f.id, f] as const));
  const onForm = [...contractIds, ...added];

  async function commit(next: { added?: string[]; required?: string[]; triggers?: IntakeTriggers }) {
    const form = { added: next.added ?? added, required: next.required ?? required, triggers: next.triggers ?? triggers };
    if (next.added) setAdded(next.added);
    if (next.required) setRequired(next.required);
    if (next.triggers) setTriggers(next.triggers);
    setStatus("saving");
    const res = await saveIntakeForm(accountId, form);
    setStatus(res.ok ? "saved" : "error");
  }

  const setRule = (id: string, index: number, patch: Partial<IntakeTrigger>) => {
    const rules = [...(triggers[id] ?? [])];
    while (rules.length <= index) rules.push({ templates: [], options: [] });
    rules[index] = { ...rules[index], ...patch };
    // A trigger without templates can't bring anything in.
    const kept = rules.filter((r) => r.templates.length > 0);
    const next = { ...triggers, [id]: kept };
    if (kept.length === 0) delete next[id];
    void commit({ triggers: next });
  };
  const removeRule = (id: string, index: number) => {
    const rules = (triggers[id] ?? []).filter((_, i) => i !== index);
    const next = { ...triggers, [id]: rules };
    if (rules.length === 0) delete next[id];
    void commit({ triggers: next });
  };
  // A blank trigger row to fill in (kept on screen only until it has
  // templates).
  const [extraRow, setExtraRow] = useState<string | null>(null);

  const requiredCount = onForm.filter((id) => required.includes(id)).length;
  const triggerCount = onForm.filter((id) => (triggers[id] ?? []).some((r) => r.templates.length > 0)).length;
  const unfinished = onForm.filter((id) => (triggers[id] ?? []).some((r) => r.templates.length > 0 && r.options.length === 0));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink-soft">
        <span>
          {onForm.length} field{onForm.length === 1 ? "" : "s"} &middot; {requiredCount} required &middot;{" "}
          {triggerCount} bringing in templates
        </span>
        <span className="text-xs text-ink-faint">
          {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : status === "error" ? "Couldn't save." : ""}
        </span>
      </div>
      {unfinished.length > 0 && (
        <p className="rounded-lg bg-danger/5 px-3 py-2 text-sm text-danger">
          Pick which answers bring in the templates for: {unfinished.map((id) => byId.get(id)?.name ?? id).join(", ")}.
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead>
            <tr className="border-b border-border-soft bg-bg font-caption text-xs font-bold uppercase tracking-wide text-ink-faint">
              <th className="px-4 py-3">Field</th>
              <th className="w-20 px-2 py-3 text-center">Required</th>
              <th className="w-[34%] px-3 py-3">Templates it brings in</th>
              <th className="w-[24%] px-3 py-3">When the answer is</th>
              <th className="w-10 px-2 py-3" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {onForm.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-sm text-ink-soft">
                  No contract fields yet. Assign your fields first, or add fields below.
                </td>
              </tr>
            )}
            {onForm.map((id, at) => {
              const f = byId.get(id);
              if (!f) return null;
              const isAdded = at >= contractIds.length;
              const saved = triggers[id] ?? [];
              const rules: IntakeTrigger[] = saved.length ? [...saved] : [{ templates: [], options: [] }];
              if (extraRow === id && rules[rules.length - 1].templates.length > 0) rules.push({ templates: [], options: [] });
              const answers = f.options && f.options.length > 0 ? f.options : VALUE_OPTIONS;
              return (
                <Fragment key={id}>
                  {isAdded && at === contractIds.length && (
                    <tr className="border-b border-border-soft bg-accent-soft/40">
                      <td colSpan={5} className="px-4 py-2 font-caption text-xs font-bold uppercase tracking-wide text-accent">
                        Fields you added
                      </td>
                    </tr>
                  )}
                  {rules.map((rule, r) => {
                    const last = r === rules.length - 1;
                    return (
                      <tr key={r} className={`align-top ${last ? "border-b border-border-soft" : ""}`}>
                        <td className="px-4 py-2.5">
                          {r === 0 && (
                            <span className="flex min-w-0 items-center gap-1.5">
                              <span className="font-medium text-ink">{f.name}</span>
                              <DocSpotIcon spot={spots[id]} />
                              {f.kind && <span className="text-xs text-ink-faint">({f.kind})</span>}
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          {r === 0 && (
                            <input
                              type="checkbox"
                              checked={required.includes(id)}
                              aria-label={`${f.name} is required`}
                              onChange={(e) =>
                                void commit({
                                  required: e.target.checked ? [...required, id] : required.filter((x) => x !== id),
                                })
                              }
                              className="mt-1 h-4 w-4"
                            />
                          )}
                        </td>
                        <td className="px-3 py-1.5">
                          <MultiSelect
                            compact
                            label={`Templates ${f.name} brings in`}
                            options={templates}
                            value={rule.templates}
                            onChange={(v) => {
                              if (extraRow === id) setExtraRow(null);
                              setRule(id, r, { templates: v });
                            }}
                            emptyText="No templates yet. Plan your tasks and categorize your documents first."
                          />
                          {last && rule.templates.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setExtraRow(id)}
                              className="mt-1 text-xs font-semibold text-accent"
                            >
                              + Templates for another answer
                            </button>
                          )}
                        </td>
                        <td className="px-3 py-1.5">
                          {rule.templates.length > 0 ? (
                            <MultiSelect
                              compact
                              label={`Answers to ${f.name} that bring them in`}
                              options={answers}
                              value={rule.options}
                              onChange={(v) => setRule(id, r, { options: v })}
                              invalid={rule.options.length === 0}
                              addLabel={rule.options.length ? "+ Add" : "Pick answers"}
                            />
                          ) : (
                            <span className="block py-2 text-ink-faint">&mdash;</span>
                          )}
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          {r > 0 ? (
                            <button
                              type="button"
                              title="Remove this trigger"
                              aria-label={`Remove this trigger for ${f.name}`}
                              onClick={() => (r < saved.length ? removeRule(id, r) : setExtraRow(null))}
                              className="text-ink-faint hover:text-danger"
                            >
                              &times;
                            </button>
                          ) : isAdded ? (
                            <button
                              type="button"
                              title="Take this field off the form"
                              aria-label={`Take ${f.name} off the form`}
                              onClick={() => {
                                const next = { ...triggers };
                                delete next[id];
                                void commit({
                                  added: added.filter((x) => x !== id),
                                  required: required.filter((x) => x !== id),
                                  triggers: next,
                                });
                              }}
                              className="text-ink-faint hover:text-danger"
                            >
                              &times;
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <AddField
        fields={fields.filter((f) => !onForm.includes(f.id))}
        onAdd={(id) => void commit({ added: [...added, id] })}
      />
    </div>
  );
}

// "+ Add a field": search every field they could add (by name or section).
function AddField({ fields, onAdd }: { fields: IntakeField[]; onAdd: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);
  const q = query.trim().toLowerCase();
  const shown = fields
    .filter((f) => !q || f.name.toLowerCase().includes(q) || f.section.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 80);
  return (
    <div ref={ref} className="relative self-start">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="rounded-lg border border-dashed border-accent px-3 py-1.5 text-sm font-semibold text-accent hover:bg-accent-soft/40"
      >
        + Add a field
      </button>
      {open && (
        <div
          className="absolute left-0 top-full z-30 mt-1 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-1 rounded-lg border border-border bg-surface p-2 shadow-lg"
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
        >
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Open to Close fields"
            aria-label="Search fields to add"
            className="rounded-md border border-border bg-bg px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent"
          />
          <div className="max-h-64 overflow-y-auto">
            {shown.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  onAdd(f.id);
                  setQuery("");
                  setOpen(false);
                }}
                className="flex w-full items-baseline justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm text-ink hover:bg-accent-soft/40"
              >
                <span>{f.name}</span>
                <span className="shrink-0 text-xs text-ink-faint">{f.section}</span>
              </button>
            ))}
            {shown.length === 0 && <p className="px-2 py-1.5 text-xs text-ink-faint">No fields match.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
