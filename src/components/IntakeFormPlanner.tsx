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
// op: "" until they pick is (or, for triggers, is not) equal to.
type Rule = { op: "" | "is" | "not"; options: string[]; items: string[] };
type Kind = "triggers" | "conditions";
const BLANK: Rule = { op: "", options: [], items: [] };

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
      Object.entries(initialTriggers).map(([id, list]) => [id, list.map((r) => ({ op: r.op, options: r.options, items: r.templates }))]),
    ),
    conditions: Object.fromEntries(
      Object.entries(initialConditions).map(([id, list]) => [id, list.map((r) => ({ op: r.op, options: r.options, items: r.fields }))]),
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
        Object.entries(all.triggers).map(([id, list]) => [id, list.map((r) => ({ op: r.op, options: r.options, templates: r.items }))]),
      ),
      conditions: Object.fromEntries(
        Object.entries(all.conditions).map(([id, list]) => [id, list.map((r) => ({ op: "is", options: r.options, fields: r.items }))]),
      ),
    });
    setStatus(res.ok ? "saved" : "error");
  }

  const setRule = (kind: Kind, id: string, index: number, patch: Partial<Rule>) => {
    const list = [...(rules[kind][id] ?? [])];
    while (list.length <= index) list.push(BLANK);
    list[index] = { ...list[index], ...patch };
    // Kept once is / is not is picked (taking that off clears it).
    const kept = list.filter((r) => r.op !== "");
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
    if (extra?.kind === kind && extra.id === id && list[list.length - 1].op !== "") list.push(BLANK);
    return list;
  };

  const requiredCount = onForm.filter((id) => required.includes(id)).length;
  const triggerCount = onForm.filter((id) => (rules.triggers[id] ?? []).length > 0).length;
  const conditionCount = onForm.filter((id) => (rules.conditions[id] ?? []).length > 0).length;
  const unfinished = onForm.filter((id) =>
    [...(rules.triggers[id] ?? []), ...(rules.conditions[id] ?? [])].some(
      (r) => r.options.length === 0 || r.items.length === 0,
    ),
  );

  // One kind's two cells on row r of a field: when the answer is (or, for
  // a trigger, isn't) these, then the fields it shows (or templates it
  // brings in), each appearing once the one before is picked.
  const cells = (kind: Kind, f: IntakeField, r: number) => {
    const list = rowsOf(kind, f.id);
    if (r >= list.length)
      return (
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
    const noun = isTrigger ? "trigger" : "condition";
    const others = onForm.filter((x) => x !== f.id).map(nameOf);
    return (
      <>
        <td className="border-l border-border-soft px-3 py-1.5">
          <div className="flex items-center gap-1.5">
            <select
              value={rule.op}
              onChange={(e) => {
                const op = e.target.value as Rule["op"];
                if (op === "") {
                  if (r < saved) removeRule(kind, f.id, r);
                  else setExtra(null);
                } else setRule(kind, f.id, r, { op });
              }}
              aria-label={`${f.name}: when the answer`}
              className={`min-w-0 flex-1 rounded-md border border-border bg-bg px-1.5 py-1 text-xs outline-none focus:border-accent ${
                rule.op ? "text-ink" : "text-ink-faint"
              }`}
            >
              <option value="">{isTrigger ? "Add a trigger…" : "Add a condition…"}</option>
              <option value="is" className="text-ink">
                is equal to
              </option>
              {isTrigger && (
                <option value="not" className="text-ink">
                  is not equal to
                </option>
              )}
            </select>
            {last && rule.op !== "" && (
              <button
                type="button"
                onClick={() => setExtra({ kind, id: f.id })}
                title={`Add another ${noun}`}
                aria-label={`Add another ${noun} for ${f.name}`}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-accent text-sm leading-none text-accent hover:bg-accent-soft/50"
              >
                +
              </button>
            )}
          </div>
          {rule.op !== "" && (
            <div className="mt-1">
              <MultiSelect
                compact
                label={`Answers to ${f.name}`}
                options={answers}
                value={rule.options}
                onChange={(v) => setRule(kind, f.id, r, { options: v })}
                invalid={rule.options.length === 0}
                addLabel={rule.options.length ? "+ Add" : "Pick answers"}
              />
            </div>
          )}
        </td>
        <td className="px-3 py-1.5">
          {rule.op !== "" && rule.options.length > 0 ? (
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
              invalid={rule.items.length === 0}
              addLabel={rule.items.length ? "+ Add" : isTrigger ? "Pick templates" : "Pick fields"}
              emptyText={
                isTrigger
                  ? "No templates yet. Plan your tasks and categorize your documents first."
                  : "No other fields on the form."
              }
            />
          ) : (
            <span className="block py-1 text-ink-faint">&mdash;</span>
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
          Finish the conditions and triggers for: {unfinished.map(nameOf).join(", ")}.
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
              <th className="w-[17%] border-l border-border-soft px-3 pb-2">When the answer</th>
              <th className="w-[20%] px-3 pb-2">Fields it shows</th>
              <th className="w-[17%] border-l border-border-soft px-3 pb-2">When the answer</th>
              <th className="w-[20%] px-3 pb-2">Templates it brings in</th>
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
