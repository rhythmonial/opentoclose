import { isContactRole, OTC_FIELDS, sectionById } from "@/lib/otcFields";
import { isActive, newOtcFieldsFrom, type WorkflowField } from "@/lib/workflowFields";

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

// Everything a client added that Open to Close doesn't have yet (fields,
// contact roles) and the options they titled for each choice field, from
// every contract, kept for building their OTC account later.
export function NewFieldsSummary({ fields }: { fields: WorkflowField[] }) {
  const active = fields.filter(isActive);
  const added = newOtcFieldsFrom(active);
  const newFields = added.filter((f) => !isContactRole(f));
  const newRoles = added.filter((f) => isContactRole(f));

  // Option titles under each choice field, in the order they were added.
  const options = new Map<string, string[]>();
  for (const f of active) {
    if (f.choice_role !== "option" || !f.question_id || !f.option_title) continue;
    const list = options.get(f.question_id) ?? [];
    if (!list.includes(f.option_title)) list.push(f.option_title);
    options.set(f.question_id, list);
  }
  const existingChoices = OTC_FIELDS.filter((f) => options.has(f.id));
  const empty = newFields.length === 0 && newRoles.length === 0 && existingChoices.length === 0;

  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h2 className="font-display text-lg font-bold text-ink">New fields &amp; choice options</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Fields and contact roles you&rsquo;ve added that aren&rsquo;t in Open to Close yet, and
        the options for each choice field. We&rsquo;ll use these when we build your account.
      </p>

      {empty ? (
        <p className="mt-4 text-sm text-ink-faint">
          Nothing yet. New fields you add and choice options you title will be listed here.
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-5">
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
                        {sectionById(f.sectionId) && ` · ${sectionById(f.sectionId)!.name}`}
                      </span>
                    </span>
                    {f.kind === "choice" && (options.get(f.id)?.length ?? 0) > 0 && (
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
                      <span className="text-xs text-ink-soft">{sectionById(f.sectionId)?.name}</span>
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
