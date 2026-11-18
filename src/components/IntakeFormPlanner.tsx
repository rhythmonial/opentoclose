"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
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
// contract order, then the other fields they use), with Required, the templates the
// field brings in, and which answers bring them in. A field can have more
// than one trigger ("FHA, VA, Conventional" → loan templates; "Cash" →
// cash ones).
export function IntakeFormPlanner({
  accountId,
  fields,
  contractIds,
  otherIds,
  spots,
  fieldsHref,
  initialRequired,
  initialTriggers,
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
  // "Tasks: B - General", "Docs: B Inspection Documents"…
  templates: string[];
}) {
  const router = useRouter();
  const [required, setRequired] = useState(initialRequired);
  const [triggers, setTriggers] = useState(initialTriggers);
  const [status, setStatus] = useState<"saving" | "saved" | "error" | null>(null);
  const byId = new Map(fields.map((f) => [f.id, f] as const));
  const onForm = [...contractIds, ...otherIds];

  async function commit(next: { required?: string[]; triggers?: IntakeTriggers }) {
    const form = { added: [], required: next.required ?? required, triggers: next.triggers ?? triggers };
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
              <th className="px-4 py-3">
                Field <span className="font-normal normal-case tracking-normal">(check if required)</span>
              </th>
              <th className="w-[34%] px-3 py-3">Templates it brings in</th>
              <th className="w-[24%] px-3 py-3">When the answer is</th>
              <th className="w-10 px-2 py-3" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {onForm.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-sm text-ink-soft">
                  No fields yet. Assign your fields and customize them first.
                </td>
              </tr>
            )}
            {onForm.map((id, at) => {
              const f = byId.get(id);
              if (!f) return null;
              const saved = triggers[id] ?? [];
              const rules: IntakeTrigger[] = saved.length ? [...saved] : [{ templates: [], options: [] }];
              if (extraRow === id && rules[rules.length - 1].templates.length > 0) rules.push({ templates: [], options: [] });
              const answers = f.options && f.options.length > 0 ? f.options : VALUE_OPTIONS;
              return (
                <Fragment key={id}>
                  {at === contractIds.length && (
                    <tr className="border-b border-border-soft bg-accent-soft/40">
                      <td colSpan={4} className="px-4 py-2 font-caption text-xs font-bold uppercase tracking-wide text-accent">
                        Other fields you&rsquo;re using
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
