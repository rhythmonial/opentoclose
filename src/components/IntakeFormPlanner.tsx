"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { MultiSelect } from "@/components/MultiSelect";
import { DocSpotIcon } from "@/components/DocSpotIcon";
import { VALUE_OPTIONS, type IntakeConditions, type IntakeTriggers } from "@/lib/intakeForm";
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

// A trigger or condition, either way: what it brings in or shows (template
// names, or field ids) and the answers it happens on.
// not (triggers only): when the answer is NOT one of them.
type Rule = { items: string[]; options: string[]; not?: boolean };
type Kind = "triggers" | "conditions";
const BLANK: Rule = { items: [], options: [] };

// Prep Your Intake Form: a row per field on the form (contract fields in
// contract order, then the other fields they use), with Required, its
// Triggers (the templates it brings in, and on which answers) and its
// Conditions (the other fields it shows, and on which answers). A field
// can have more than one of each ("FHA, VA, Conventional" → loan
// templates; "Cash" → cash ones).
export function IntakeFormPlanner({
  accountId,
  fields,
  contractIds,
  otherIds,
  spots,
  fieldsHref,
  initialRequired,
  initialTriggers,
  initialConditions,
  templates,
}: {
  accountId: string | null;
  fields: IntakeField[];
  contractIds: string[];
  // Fields they use that aren't on their contracts (in their Organize
  // Your Fields order).
  otherIds: string[];
  spots: Record<string, string>;
  // Customize Your Fields, where fields are added.
  fieldsHref: string;
  initialRequired: string[];
  initialTriggers: IntakeTriggers;
  initialConditions: IntakeConditions;
  // "Tasks: B - General", "Docs: B Inspection Documents"…
  templates: string[];
}) {
  const router = useRouter();
  const [required, setRequired] = useState(initialRequired);
  const [rules, setRules] = useState<Record<Kind, Record<string, Rule[]>>>(() => ({
    triggers: Object.fromEntries(
      Object.entries(initialTriggers).map(([id, list]) => [id, list.map((r) => ({ items: r.templates, options: r.options, ...(r.not ? { not: true } : {}) }))]),
    ),
    conditions: Object.fromEntries(
      Object.entries(initialConditions).map(([id, list]) => [id, list.map((r) => ({ items: r.fields, options: r.options }))]),
    ),
  }));
  const [status, setStatus] = useState<"saving" | "saved" | "error" | null>(null);
  // A blank trigger or condition row to fill in (on screen only until it
  // has templates or fields).
  const [extra, setExtra] = useState<{ kind: Kind; id: string } | null>(null);
  const byId = new Map(fields.map((f) => [f.id, f] as const));
  const onForm = [...contractIds, ...otherIds];
  // Conditions pick fields by name.
  const nameOf = (id: string) => byId.get(id)?.name ?? id;
  const idOf = new Map(onForm.map((id) => [nameOf(id), id] as const));

  async function commit(next: { required?: string[]; rules?: Record<Kind, Record<string, Rule[]>> }) {
    const req = next.required ?? required;
    const all = next.rules ?? rules;
    if (next.required) setRequired(next.required);
    if (next.rules) setRules(next.rules);
    setStatus("saving");
    const res = await saveIntakeForm(accountId, {
      added: [],
      required: req,
      triggers: Object.fromEntries(
        Object.entries(all.triggers).map(([id, list]) => [id, list.map((r) => ({ templates: r.items, options: r.options, ...(r.not ? { not: true } : {}) }))]),
      ),
      conditions: Object.fromEntries(
        Object.entries(all.conditions).map(([id, list]) => [id, list.map((r) => ({ fields: r.items, options: r.options }))]),
      ),
    });
    setStatus(res.ok ? "saved" : "error");
  }

  const setRule = (kind: Kind, id: string, index: number, patch: Partial<Rule>) => {
    const list = [...(rules[kind][id] ?? [])];
    while (list.length <= index) list.push(BLANK);
    list[index] = { ...list[index], ...patch };
    // One without templates (or fields) does nothing.
    const kept = list.filter((r) => r.items.length > 0);
    const forKind = { ...rules[kind], [id]: kept };
    if (kept.length === 0) delete forKind[id];
    if (extra?.kind === kind && extra.id === id) setExtra(null);
    void commit({ rules: { ...rules, [kind]: forKind } });
  };
  const removeRule = (kind: Kind, id: string, index: number) => {
    const list = (rules[kind][id] ?? []).filter((_, i) => i !== index);
    const forKind = { ...rules[kind], [id]: list };
    if (list.length === 0) delete forKind[id];
    void commit({ rules: { ...rules, [kind]: forKind } });
  };
  // The rows a field shows for one kind: its saved ones (or one blank to
  // start), plus a blank one when they asked for another.
  const rowsOf = (kind: Kind, id: string): Rule[] => {
    const saved = rules[kind][id] ?? [];
    const list = saved.length ? [...saved] : [BLANK];
    if (extra?.kind === kind && extra.id === id && list[list.length - 1].items.length > 0) list.push(BLANK);
    return list;
  };

  const requiredCount = onForm.filter((id) => required.includes(id)).length;
  const triggerCount = onForm.filter((id) => (rules.triggers[id] ?? []).length > 0).length;
  const conditionCount = onForm.filter((id) => (rules.conditions[id] ?? []).length > 0).length;
  const unfinished = onForm.filter((id) =>
    [...(rules.triggers[id] ?? []), ...(rules.conditions[id] ?? [])].some((r) => r.options.length === 0),
  );

  // One kind's two cells (what, and when) on row r of a field.
  const cells = (kind: Kind, f: IntakeField, r: number) => {
    const list = rowsOf(kind, f.id);
    if (r >= list.length) return (
      <>
        <td className="border-l border-border-soft px-3 py-1.5" />
        <td className="px-3 py-1.5" />
      </>
    );
    const rule = list[r];
    const last = r === list.length - 1;
    const saved = (rules[kind][f.id] ?? []).length;
    const answers = f.options && f.options.length > 0 ? f.options : VALUE_OPTIONS;
    const isTrigger = kind === "triggers";
    const others = onForm.filter((x) => x !== f.id).map(nameOf);
    return (
      <>
        <td className="border-l border-border-soft px-3 py-1.5">
          <div className="flex items-start gap-1">
            <div className="min-w-0 flex-1">
              <MultiSelect
                compact
                label={isTrigger ? `Templates ${f.name} brings in` : `Fields ${f.name} shows`}
                options={isTrigger ? templates : others}
                value={isTrigger ? rule.items : rule.items.map(nameOf)}
                onChange={(v) =>
                  setRule(kind, f.id, r, {
                    items: isTrigger ? v : v.map((n) => idOf.get(n)).filter((x): x is string => Boolean(x)),
                  })
                }
                emptyText={
                  isTrigger
                    ? "No templates yet. Plan your tasks and categorize your documents first."
                    : "No other fields on the form."
                }
              />
            </div>
            {r > 0 && (
              <button
                type="button"
                title={isTrigger ? "Remove this trigger" : "Remove this condition"}
                aria-label={`Remove this ${isTrigger ? "trigger" : "condition"} for ${f.name}`}
                onClick={() => (r < saved ? removeRule(kind, f.id, r) : setExtra(null))}
                className="mt-1.5 text-ink-faint hover:text-danger"
              >
                &times;
              </button>
            )}
          </div>
          {last && rule.items.length > 0 && (
            <button
              type="button"
              onClick={() => setExtra({ kind, id: f.id })}
              className="mt-1 text-xs font-semibold text-accent"
            >
              + {isTrigger ? "Templates" : "Fields"} for another answer
            </button>
          )}
        </td>
        <td className="px-3 py-1.5">
          {rule.items.length > 0 ? (
            <div className="flex flex-col gap-1">
              {isTrigger && (
                <select
                  value={rule.not ? "not" : "is"}
                  onChange={(e) => setRule(kind, f.id, r, { not: e.target.value === "not" })}
                  aria-label={`Whether ${f.name}'s answer is or isn't one of these`}
                  className="self-start rounded-md border border-border bg-bg px-1.5 py-0.5 text-xs text-ink outline-none focus:border-accent"
                >
                  <option value="is">is equal to</option>
                  <option value="not">is not equal to</option>
                </select>
              )}
              <MultiSelect
                compact
                label={`Answers to ${f.name} that ${isTrigger ? "bring them in" : "show them"}`}
                options={answers}
                value={rule.options}
                onChange={(v) => setRule(kind, f.id, r, { options: v })}
                invalid={rule.options.length === 0}
                addLabel={rule.options.length ? "+ Add" : "Pick answers"}
              />
            </div>
          ) : (
            <span className="block py-2 text-ink-faint">&mdash;</span>
          )}
        </td>
      </>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink-soft">
        <span>
          {onForm.length} field{onForm.length === 1 ? "" : "s"} &middot; {requiredCount} required &middot;{" "}
          {conditionCount} with conditions &middot; {triggerCount} with triggers
        </span>
        <span className="text-xs text-ink-faint">
          {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : status === "error" ? "Couldn't save." : ""}
        </span>
      </div>
      {unfinished.length > 0 && (
        <p className="rounded-lg bg-danger/5 px-3 py-2 text-sm text-danger">
          Pick the answers for: {unfinished.map(nameOf).join(", ")}.
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[1000px] text-left text-sm">
          <thead>
            <tr className="bg-bg font-caption text-xs font-bold uppercase tracking-wide text-ink-faint">
              <th rowSpan={2} className="border-b border-border-soft px-4 py-3 align-bottom">
                Field <span className="font-normal normal-case tracking-normal">(check if required)</span>
              </th>
              <th colSpan={2} className="border-l border-border-soft px-3 pt-3 pb-1 text-accent">
                Conditions
              </th>
              <th colSpan={2} className="border-l border-border-soft px-3 pt-3 pb-1 text-accent">
                Triggers
              </th>
            </tr>
            <tr className="border-b border-border-soft bg-bg font-caption text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
              <th className="w-[22%] border-l border-border-soft px-3 pb-2">Fields it shows</th>
              <th className="w-[15%] px-3 pb-2">When the answer is</th>
              <th className="w-[22%] border-l border-border-soft px-3 pb-2">Templates it brings in</th>
              <th className="w-[15%] px-3 pb-2">When the answer</th>
            </tr>
          </thead>
          <tbody>
            {onForm.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-sm text-ink-soft">
                  No fields yet. Assign your fields and customize them first.
                </td>
              </tr>
            )}
            {onForm.map((id, at) => {
              const f = byId.get(id);
              if (!f) return null;
              const count = Math.max(rowsOf("triggers", id).length, rowsOf("conditions", id).length);
              return (
                <Fragment key={id}>
                  {at === contractIds.length && (
                    <tr className="border-b border-border-soft bg-accent-soft/40">
                      <td colSpan={5} className="px-4 py-2 font-caption text-xs font-bold uppercase tracking-wide text-accent">
                        Other fields you&rsquo;re using
                      </td>
                    </tr>
                  )}
                  {Array.from({ length: count }, (_, r) => (
                    <tr key={r} className={`align-top ${r === count - 1 ? "border-b border-border-soft" : ""}`}>
                      <td className="px-4 py-2.5">
                        {r === 0 && (
                          <span className="flex min-w-0 items-center gap-1.5">
                            <input
                              type="checkbox"
                              checked={required.includes(id)}
                              title="Required"
                              aria-label={`${f.name} is required`}
                              onChange={(e) =>
                                void commit({
                                  required: e.target.checked ? [...required, id] : required.filter((x) => x !== id),
                                })
                              }
                              className="mr-1 h-4 w-4 shrink-0"
                            />
                            <span className="font-medium text-ink">{f.name}</span>
                            <DocSpotIcon spot={spots[id]} />
                            {f.kind && <span className="text-xs text-ink-faint">({f.kind})</span>}
                          </span>
                        )}
                      </td>
                      {cells("conditions", f, r)}
                      {cells("triggers", f, r)}
                    </tr>
                  ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-ink-soft sm:flex-row sm:items-center sm:justify-between">
        <p>
          Missing a field? Add it in Customize Your Fields (it opens in a new tab), then come back to
          this tab and refresh.
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <a
            href={fieldsHref}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-accent px-3 py-1.5 font-semibold text-accent hover:bg-accent-soft/40"
          >
            Open Customize Your Fields &#8599;
          </a>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="rounded-lg border border-border px-3 py-1.5 font-semibold text-ink-soft hover:border-accent hover:text-accent"
          >
            &#8634; Refresh
          </button>
        </div>
      </div>
    </div>
  );
}
