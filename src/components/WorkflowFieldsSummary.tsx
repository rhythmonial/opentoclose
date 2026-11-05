import { fieldLabel, type ContractBlank } from "@/lib/contractBlanks";
import {
  isContactRole,
  OTC_FIELDS,
  sectionById,
  SYSTEM_REQUIRED_FIELDS,
} from "@/lib/otcFields";
import {
  isActive,
  isComplete,
  newOtcFieldsFrom,
  otcTargetOf,
  type WorkflowField,
} from "@/lib/workflowFields";

export type SummaryDoc = {
  id: string;
  name: string;
  blanks: ContractBlank[];
  fields: WorkflowField[];
};

// The workflow field type, as the field menu names it.
export function typeLabel(f: WorkflowField) {
  if (f.type === "decimal") {
    return f.decimal_format === "percentage"
      ? "Decimal Percent"
      : "Decimal Dollar";
  }
  if (f.type === "choice")
    return f.choice_role === "option" ? "Choice option" : "Choice field";
  return KIND_LABELS[f.type ?? ""] ?? "";
}

// A document's workflow fields in the order they appear on the contract
// (by the first box of each, top to bottom and left to right on each page),
// with the contract's text for each.
export function inContractOrder(doc: SummaryDoc) {
  const boxes = doc.blanks
    .filter((b) => b.id)
    .sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x);
  return doc.fields
    .filter(isActive)
    .map((f) => {
      const first = boxes.find((b) => b.id === f.id || b.group === f.id);
      return { field: f, first };
    })
    .filter((r): r is { field: WorkflowField; first: ContractBlank } =>
      Boolean(r.first),
    )
    .sort((a, b) => boxes.indexOf(a.first) - boxes.indexOf(b.first));
}

const KIND_LABELS: Record<string, string> = {
  contact: "Contact",
  text: "Text",
  text_area: "Text area",
  currency: "Decimal Dollar",
  percentage: "Decimal Percent",
  date: "Date",
  number: "Number",
  choice: "Choice",
};

// The fields Open to Close requires on every transaction, checked off as
// the client assigns them from their contracts.
export function SystemRequiredChecklist({
  fields,
  onJump,
}: {
  fields: WorkflowField[];
  // When given, assigned ones are buttons that jump to where they're used.
  onJump?: (otcId: string) => void;
}) {
  const used = new Set(
    fields.filter(isActive).map(otcTargetOf).filter(Boolean),
  );
  const done = SYSTEM_REQUIRED_FIELDS.filter((f) => used.has(f.id)).length;
  return (
    <div className="rounded-lg border border-border bg-bg p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h3 className="text-xs font-bold uppercase tracking-wide text-ink-faint">
          System required fields
        </h3>
        <span className="text-xs text-ink-soft">
          {done} of {SYSTEM_REQUIRED_FIELDS.length} on your contracts
        </span>
      </div>
      <p className="mt-0.5 text-xs text-ink-soft">
        Open to Close requires these on every transaction. Assign them
        wherever they appear on your contracts.
      </p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {SYSTEM_REQUIRED_FIELDS.map((f) => {
          const on = used.has(f.id);
          const chip = (
            <>
              <span aria-hidden className={on ? "text-accent" : "text-ink-faint"}>
                {on ? "✓" : "○"}
              </span>
              {f.name}
              <span className="sr-only">
                {on ? " (assigned)" : " (not assigned yet)"}
              </span>
            </>
          );
          const cls = `flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs ${
            on
              ? "border-accent/40 bg-accent-soft/40 font-semibold text-ink"
              : "border-border bg-surface text-ink-soft"
          }`;
          return (
            <li key={f.id}>
              {on && onJump ? (
                <button
                  type="button"
                  onClick={() => onJump(f.id)}
                  className={`${cls} hover:border-accent`}
                >
                  {chip}
                </button>
              ) : (
                <span className={cls}>{chip}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Chips({ items }: { items: string[] }) {
  return (
    <span className="mt-1 flex flex-wrap gap-1">
      {items.map((t) => (
        <span
          key={t}
          className="rounded-full border border-border bg-bg px-2 py-0.5 text-xs text-ink"
        >
          {t}
        </span>
      ))}
    </span>
  );
}

// The workflow fields a client assigned, contract by contract in the order
// they appear on it, then everything they added that Open to Close doesn't
// have yet (fields, contact roles) and the options they titled for each
// choice field, kept for building their OTC account later.
export function WorkflowFieldsSummary({ docs }: { docs: SummaryDoc[] }) {
  const active = docs.flatMap((d) => d.fields).filter(isActive);
  const added = newOtcFieldsFrom(active);
  const otcName = (id?: string) =>
    id ? [...OTC_FIELDS, ...added].find((f) => f.id === id)?.name : undefined;
  const isNewId = (id?: string) =>
    Boolean(id && added.some((f) => f.id === id));
  const assigned = docs.map((d) => ({ doc: d, rows: inContractOrder(d) }));
  const newFields = added.filter((f) => !isContactRole(f));
  const newRoles = added.filter((f) => isContactRole(f));

  // Option titles under each choice field, in the order they were added:
  // options tied to an OTC choice field, or to a choice field on the
  // contract (counted under its OTC field), and ones added by hand in
  // Upload Your Contracts.
  const questionOtc = new Map(
    active
      .filter((f) => f.choice_role === "question" && f.otc_field)
      .map((f) => [f.id, f.otc_field!] as const),
  );
  const options = new Map<string, string[]>();
  const addOption = (choiceId: string, title: string) => {
    const list = options.get(choiceId) ?? [];
    if (!list.includes(title)) list.push(title);
    options.set(choiceId, list);
  };
  for (const f of active) {
    if (f.choice_role !== "option" || !f.question_id || !f.option_title)
      continue;
    addOption(questionOtc.get(f.question_id) ?? f.question_id, f.option_title);
  }
  for (const f of active) {
    if (f.choice_role !== "question" || !f.otc_field) continue;
    for (const title of f.options ?? []) addOption(f.otc_field, title);
  }
  const existingChoices = OTC_FIELDS.filter((f) => options.has(f.id));
  const empty =
    newFields.length === 0 &&
    newRoles.length === 0 &&
    existingChoices.length === 0;

  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h2 className="font-display text-lg font-bold text-ink">
        Your workflow fields
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        Every field you&rsquo;ve assigned, in the order it appears on your
        contract, then the fields, contact roles and choice options you&rsquo;ve
        added. We&rsquo;ll use these when we build your account.
      </p>

      <div className="mt-4">
        <SystemRequiredChecklist fields={active} />
      </div>

      <div className="mt-4 flex flex-col gap-4">
        <h3 className="text-xs font-bold uppercase tracking-wide text-ink-faint">
          Assigned fields
        </h3>
        {assigned.every((a) => a.rows.length === 0) && (
          <p className="text-sm text-ink-faint">
            Nothing yet. Fields you assign will be listed here in contract
            order.
          </p>
        )}
        {assigned
          .filter((a) => a.rows.length > 0)
          .map(({ doc, rows }) => (
            <div key={doc.id}>
              {docs.length > 1 && (
                <p className="mb-1.5 truncate text-sm font-semibold text-ink">
                  {doc.name}
                </p>
              )}
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[28rem] text-left text-sm">
                  <thead className="bg-bg text-xs text-ink-soft">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Line</th>
                      <th className="px-3 py-2 font-semibold">Page</th>
                      <th className="px-3 py-2 font-semibold">Field</th>
                      <th className="px-3 py-2 font-semibold">Type</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.map(({ field: f, first }) => {
                      const option =
                        f.type === "choice" && f.choice_role === "option";
                      const target = option
                        ? (questionOtc.get(f.question_id ?? "") ?? f.question_id)
                        : f.otc_field;
                      const name =
                        otcName(target) ??
                        (option ? f.question_text : undefined);
                      return (
                        <tr key={f.id} className="align-top">
                          <td className="px-3 py-2 text-ink-faint">{first.line ?? "—"}</td>
                          <td className="px-3 py-2 text-ink-soft">
                            {first.page}
                          </td>
                          {/* The field they picked; until it has one, the
                              contract's wording, to help find it. */}
                          <td className="px-3 py-2 text-ink">
                            {name ? (
                              <>
                                {name}
                                {option && f.option_title && (
                                  <span className="text-ink-soft">
                                    {" "}
                                    &rarr; {f.option_title}
                                  </span>
                                )}
                                {isNewId(target) && (
                                  <span className="ml-1.5 rounded bg-gold/20 px-1 py-px text-[10px] font-bold uppercase text-ink">
                                    New
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="text-ink-faint">{fieldLabel(first)}</span>
                            )}
                            {!isComplete(f) && (
                              <span className="text-xs font-semibold text-danger">
                                {" · "}Needs an answer
                              </span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-ink-soft">
                            {typeLabel(f)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
      </div>

      {!empty && (
        <div className="mt-6 flex flex-col gap-5">
          {newFields.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wide text-ink-faint">
                New fields
              </h3>
              <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
                {newFields.map((f) => (
                  <li key={f.id} className="flex flex-col px-3 py-2 text-sm">
                    <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="font-semibold text-ink">{f.name}</span>
                      <span className="text-xs text-ink-soft">
                        {KIND_LABELS[f.kind ?? ""] ?? "Field"}
                        {sectionById(f.sectionId) &&
                          ` · ${sectionById(f.sectionId)!.name}`}
                      </span>
                    </span>
                    {f.kind === "choice" &&
                      (options.get(f.id)?.length ?? 0) > 0 && (
                        <Chips items={options.get(f.id)!} />
                      )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {newRoles.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wide text-ink-faint">
                New contact roles
              </h3>
              <Chips items={newRoles.map((r) => r.name)} />
            </div>
          )}

          {existingChoices.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wide text-ink-faint">
                Options for Open to Close choice fields
              </h3>
              <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
                {existingChoices.map((f) => (
                  <li key={f.id} className="flex flex-col px-3 py-2 text-sm">
                    <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="font-semibold text-ink">{f.name}</span>
                      <span className="text-xs text-ink-soft">
                        {sectionById(f.sectionId)?.name}
                      </span>
                    </span>
                    <Chips items={options.get(f.id)!} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
