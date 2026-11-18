import { loadFieldUse } from "@/lib/fieldUse";
import {
  cleanChoiceEdits,
  keptOptions,
  ORG_GROUPS,
  ORG_SECTIONS,
  orgFields,
  reconcileLayout,
} from "@/lib/fieldOrganization";
import { CopyButton } from "@/components/CopyButton";
import { loadSetupLesson, SetupShell } from "../_setup/shell";

const KIND_LABELS: Record<string, string> = {
  text: "Text",
  text_area: "Text Area",
  currency: "Dollar",
  percentage: "Percentage",
  date: "Date",
  number: "Number",
  choice: "Choice",
};

// Field Setup: every field group, section and field they use, in the order
// they organized them, with each choice field's options, to build in Open
// to Close's field editor.
export default async function FieldSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const { client } = await searchParams;
  const lesson = await loadSetupLesson("field_setup", client);
  const { supabase, accountId } = lesson;

  let content: React.ReactNode = null;
  if (accountId) {
    const use = await loadFieldUse(supabase, accountId);
    const fields = orgFields(use.inUse, use.newFields, use.custom, use.contractOptions, use.sections);
    const { data: saved } = await supabase
      .from("client_field_organization")
      .select("layout, choice_edits")
      .eq("client_account_id", accountId)
      .maybeSingle();
    const layout = reconcileLayout(saved?.layout, fields, use.sections);
    const edits = cleanChoiceEdits(saved?.choice_edits, fields);
    const fieldById = new Map(fields.map((f) => [f.id, f] as const));
    const sectionName = (id: string) => use.sections.find((s) => s.id === id)?.name ?? id;

    content = (
      <div className="flex flex-col gap-6">
        {layout
          .filter((g) => g.sections.some((s) => s.fields.length > 0))
          .map((g) => (
            <section key={g.group} className="rounded-xl border border-border bg-surface">
              <h2 className="flex items-center justify-between gap-2 border-b border-border-soft bg-navy px-4 py-2.5 font-display text-base font-bold text-white first:rounded-t-xl">
                <span>Field group: {g.group}</span>
                {/* Only names they'll type in (new ones) get a copy button. */}
                {!ORG_GROUPS.includes(g.group) && <CopyButton text={g.group} />}
              </h2>
              <div className="flex flex-col divide-y divide-border-soft">
                {g.sections
                  .filter((s) => s.fields.length > 0)
                  .map((s) => (
                    <div key={s.id} className="px-4 py-3">
                      <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
                        Section: {sectionName(s.id)}
                        {!ORG_SECTIONS.some((o) => o.id === s.id) && <CopyButton text={sectionName(s.id)} />}
                      </h3>
                      <ol className="mt-2 flex flex-col gap-1.5">
                        {s.fields.map((id, i) => {
                          const f = fieldById.get(id);
                          if (!f) return null;
                          const name = use.names[id] ?? f.name;
                          const options = f.kind === "choice" ? keptOptions(f, edits) : [];
                          return (
                            <li key={id} className="rounded-lg border border-border bg-bg px-3 py-2 text-sm">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="w-6 shrink-0 text-xs text-ink-faint">{i + 1}.</span>
                                <span className="font-semibold text-ink">{name}</span>
                                {f.kind && (
                                  <span className="text-xs text-ink-soft">({KIND_LABELS[f.kind] ?? f.kind})</span>
                                )}
                                {f.isNew && (
                                  <span className="rounded bg-gold/20 px-1.5 py-px text-[10px] font-bold uppercase text-ink">
                                    Create
                                  </span>
                                )}
                                {use.names[id] && use.names[id] !== f.name && (
                                  <span className="text-xs text-ink-faint">renamed from {f.name}</span>
                                )}
                                {(f.isNew || name !== f.name) && (
                                  <span className="ml-auto">
                                    <CopyButton text={name} />
                                  </span>
                                )}
                              </div>
                              {options.length > 0 && (
                                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-8">
                                  <span className="text-xs font-semibold text-ink-soft">Options:</span>
                                  {options.map((o) => (
                                    <span
                                      key={o}
                                      className="rounded-full border border-border bg-surface px-2 py-0.5 text-xs text-ink"
                                    >
                                      {o}
                                    </span>
                                  ))}
                                  <CopyButton text={options.join("\n")} label="Copy options" />
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ol>
                    </div>
                  ))}
              </div>
            </section>
          ))}
      </div>
    );
  }

  return (
    <SetupShell
      lesson={lesson}
      fallbackTitle="Field Setup"
      blurb="Every field group, section and field you're using, in the order you organized them, with each choice field's options. Build them in Open to Close's field editor from top to bottom."
    >
      {content}
    </SetupShell>
  );
}
