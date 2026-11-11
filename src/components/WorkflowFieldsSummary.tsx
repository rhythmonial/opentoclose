import { fieldLabel, type ContractBlank } from "@/lib/contractBlanks";
import {
  isContactRole,
  kindMatches,
  OTC_FIELDS,
  sectionById,
  type CustomSection,
} from "@/lib/otcFields";
import {
  isActive,
  isComplete,
  newOtcFieldsFrom,
  optionTitlesOf,
  placeholderText,
  type WorkflowField,
} from "@/lib/workflowFields";
import { FieldRenameInput, NewFieldMapper } from "@/components/WorkflowFieldNameCell";

export type SummaryDoc = {
  id: string;
  name: string;
  blanks: ContractBlank[];
  fields: WorkflowField[];
};

// The workflow field type, as the field menu names it.
export function typeLabel(f: WorkflowField) {
  if (f.type === "decimal") {
    return f.decimal_format === "percentage" ? "Percent" : "Dollar";
  }
  if (f.type === "choice")
    return f.choice_role === "option" ? "Choice" : "Choice field";
  return KIND_LABELS[f.type ?? ""] ?? "";
}

// A document's workflow fields in the order they appear on the contract
// (by the first box of each, top to bottom and left to right on each page),
// with the contract's text for each.
export function inContractOrder(doc: SummaryDoc) {
  const boxes = doc.blanks
    .filter((b) => b.id && !b.removed)
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
  currency: "Dollar",
  percentage: "Percent",
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
// With `editing`, each assigned field can be renamed (saved with Finalize
// Your Fields), and a field the client added can be pointed at an Open to
// Close field instead.
// With `onlyPage`, the assigned fields table lists just the fields on that
// page of that contract.
export function WorkflowFieldsSummary({
  docs,
  editing,
  onlyPage,
  customSections = [],
}: {
  docs: SummaryDoc[];
  editing?: {
    accountId: string | null;
    names: Record<string, string>;
    // Applies a change made from the table (assigning a field the client
    // added to an OTC field, or undoing that) to the fields on screen.
    onFieldsChanged?: (change: (fields: WorkflowField[]) => WorkflowField[]) => void;
  };
  onlyPage?: { docId: string; page: number };
  // Sections the client added (for their new fields' section names).
  customSections?: CustomSection[];
}) {
  const sectionOf = (id: string) => sectionById(id) ?? customSections.find((s) => s.id === id);
  const active = docs.flatMap((d) => d.fields).filter(isActive);
  const added = newOtcFieldsFrom(active);
  const otcName = (id?: string) =>
    id ? [...OTC_FIELDS, ...added].find((f) => f.id === id)?.name : undefined;
  const isNewId = (id?: string) =>
    Boolean(id && added.some((f) => f.id === id));
  const onThatPage = (d: SummaryDoc, f: WorkflowField) =>
    d.blanks.some(
      (b) => (b.id === f.id || b.group === f.id) && b.page === onlyPage!.page,
    );
  const assigned = docs
    .filter((d) => !onlyPage || d.id === onlyPage.docId)
    .map((d) => ({
      doc: d,
      rows: inContractOrder(d).filter((r) => !onlyPage || onThatPage(d, r.field)),
    }));
  // One row per field: a choice field's options on one row, their titles
  // separated by commas.
  type Row = {
    field: WorkflowField;
    first: ContractBlank;
    fields: WorkflowField[];
    option: boolean;
    target?: string;
    name?: string;
    titles: string[];
    needs: boolean;
  };
  const tableRows = (list: { field: WorkflowField; first: ContractBlank }[]) => {
    const out: Row[] = [];
    for (const { field: f, first } of list) {
      const option = f.type === "choice" && f.choice_role === "option";
      const target = option
        ? (questionOtc.get(f.question_id ?? "") ?? f.question_id)
        : f.otc_field;
      const name = otcName(target) ?? (option ? f.question_text : undefined);
      const titles = option ? optionTitlesOf(f) : [];
      const same = option && name ? out.find((r) => r.option && r.target === target) : undefined;
      if (same) {
        same.fields.push(f);
        for (const t of titles) if (!same.titles.includes(t)) same.titles.push(t);
        same.needs ||= !isComplete(f);
        continue;
      }
      out.push({
        field: f,
        first,
        fields: [f],
        option,
        target,
        name,
        titles: [...titles],
        needs: !isComplete(f),
      });
    }
    return out;
  };
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
    if (f.choice_role !== "option" || !f.question_id) continue;
    for (const t of optionTitlesOf(f)) addOption(questionOtc.get(f.question_id) ?? f.question_id, t);
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
        {onlyPage ? (
          <>
            The fields you&rsquo;ve assigned on the page you&rsquo;re working on,
            in the order they appear, then the fields, contact roles and choice
            options you&rsquo;ve added on all your contracts. We&rsquo;ll use these
            when we build your account.
          </>
        ) : (
          <>
            Every field you&rsquo;ve assigned, in the order it appears on your
            contract, then the fields, contact roles and choice options you&rsquo;ve
            added. We&rsquo;ll use these when we build your account.
          </>
        )}
      </p>


      <div className="mt-4 flex flex-col gap-4">
        <h3 className="text-xs font-bold uppercase tracking-wide text-ink-faint">
          {onlyPage ? `Assigned fields on page ${onlyPage.page}` : "Assigned fields"}
        </h3>
        {assigned.every((a) => a.rows.length === 0) && (
          <p className="text-sm text-ink-faint">
            {onlyPage
              ? "Nothing on this page yet. Fields you assign here will be listed in contract order."
              : "Nothing yet. Fields you assign will be listed here in contract order."}
          </p>
        )}
        {assigned
          .filter((a) => a.rows.length > 0)
          .map(({ doc, rows }) => (
            <div key={doc.id}>
              {docs.length > 1 && !onlyPage && (
                <p className="mb-1.5 truncate text-sm font-semibold text-ink">
                  {doc.name}
                </p>
              )}
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[30rem] text-left text-sm">
                  <thead className="bg-bg text-xs text-ink-soft">
                    <tr>
                      <th className="w-12 px-3 py-2 font-semibold">Line</th>
                      <th className="px-3 py-2 font-semibold">Field</th>
                      <th className="w-20 px-3 py-2 font-semibold">Type</th>
                      <th className="px-3 py-2 font-semibold">Placeholder</th>
                      {editing && (
                        <th className="w-[11.5rem] px-3 py-2 font-semibold">Rename or assign</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {tableRows(rows).map((row) => {
                      const { field: f, first, target, name, titles, needs } = row;
                      const text = name
                        ? `${name}${titles.length > 0 ? ` → ${titles.join(", ")}` : ""}`
                        : fieldLabel(first);
                      const was = row.fields.find((x) => x.was_new)?.was_new;
                      return (
                        <tr key={f.id}>
                          <td className="whitespace-nowrap px-3 py-2 text-ink-faint">
                            {first.line ?? "—"}
                          </td>
                          {/* The field they picked (and for a choice field,
                              its options); until it has one, the contract's
                              wording, to help find it. */}
                          <td className="max-w-0 px-3 py-2 text-ink">
                            <span className="flex min-w-0 items-center gap-1.5" title={text}>
                              <span className={`min-w-0 truncate ${name ? "" : "text-ink-faint"}`}>
                                {name ? (
                                  <>
                                    {name}
                                    {titles.length > 0 && (
                                      <span className="text-ink-soft"> &rarr; {titles.join(", ")}</span>
                                    )}
                                  </>
                                ) : (
                                  text
                                )}
                              </span>
                              {name && isNewId(target) && (
                                <span className="shrink-0 rounded bg-gold/20 px-1 py-px text-[10px] font-bold uppercase text-ink">
                                  New
                                </span>
                              )}
                              {needs && (
                                <span className="shrink-0 whitespace-nowrap text-xs font-semibold text-danger">
                                  Needs an answer
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-ink-soft">
                            {typeLabel(f)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-xs text-ink-soft">
                            {placeholderText(first.line, f.if_blank) || "—"}
                          </td>
                          {editing && (
                            <td className="px-3 py-1.5">
                              {target && isNewId(target) ? (
                                <NewFieldMapper
                                  accountId={editing.accountId}
                                  createdId={target}
                                  createdName={name ?? ""}
                                  choices={OTC_FIELDS.filter((o) =>
                                    row.option
                                      ? o.kind === "choice"
                                      : kindMatches(o.kind, f.type, f.decimal_format),
                                  )}
                                  onMapped={editing.onFieldsChanged}
                                />
                              ) : target && name && OTC_FIELDS.some((o) => o.id === target) ? (
                                <FieldRenameInput
                                  key={`${target}:${editing.names[target] ?? ""}`}
                                  accountId={editing.accountId}
                                  otcId={target}
                                  otcName={name}
                                  initial={editing.names[target] ?? ""}
                                  revertTo={was}
                                  onReverted={editing.onFieldsChanged}
                                />
                              ) : null}
                            </td>
                          )}
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
                        {sectionOf(f.sectionId) && ` · ${sectionOf(f.sectionId)!.name}`}
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
