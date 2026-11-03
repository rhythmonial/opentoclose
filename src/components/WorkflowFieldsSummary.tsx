import { fieldLabel, type ContractBlank } from "@/lib/contractBlanks";
import { isContactRole, OTC_FIELDS, sectionById } from "@/lib/otcFields";
import {
  isActive,
  isComplete,
  newOtcFieldsFrom,
  type WorkflowField,
} from "@/lib/workflowFields";

export type SummaryDoc = {
  id: string;
  name: string;
  blanks: ContractBlank[];
  fields: WorkflowField[];
};

// The workflow field type, as the field menu names it.
function typeLabel(f: WorkflowField) {
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
function inContractOrder(doc: SummaryDoc) {
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

  // Option titles under each choice field, in the order they were added.
  const options = new Map<string, string[]>();
  for (const f of active) {
    if (f.choice_role !== "option" || !f.question_id || !f.option_title)
      continue;
    const list = options.get(f.question_id) ?? [];
    if (!list.includes(f.option_title)) list.push(f.option_title);
    options.set(f.question_id, list);
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
                <table className="w-full min-w-[34rem] text-left text-sm">
                  <thead className="bg-bg text-xs text-ink-soft">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Line</th>
                      <th className="px-3 py-2 font-semibold">Page</th>
                      <th className="px-3 py-2 font-semibold">
                        Contract field
                      </th>
                      <th className="px-3 py-2 font-semibold">Type</th>
                      <th className="px-3 py-2 font-semibold">Open to Close</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.map(({ field: f, first }) => {
                      const option =
                        f.type === "choice" && f.choice_role === "option";
                      const target = option ? f.question_id : f.otc_field;
                      const name =
                        otcName(target) ??
                        (option ? f.question_text : undefined);
                      return (
                        <tr key={f.id} className="align-top">
                          <td className="px-3 py-2 text-ink-faint">{first.line ?? "—"}</td>
                          <td className="px-3 py-2 text-ink-soft">
                            {first.page}
                          </td>
                          <td className="px-3 py-2 text-ink">
                            {fieldLabel(first)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-ink-soft">
                            {typeLabel(f)}
                          </td>
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
                            ) : null}
                            {!isComplete(f) && (
                              <span className="text-xs font-semibold text-danger">
                                {name ? " · " : ""}Needs an answer
                              </span>
                            )}
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
