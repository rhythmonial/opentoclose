import { loadFieldUse } from "@/lib/fieldUse";
import {
  choiceOptions,
  cleanChoiceEdits,
  ORG_GROUPS,
  ORG_SECTIONS,
  orgFields,
  reconcileLayout,
} from "@/lib/fieldOrganization";
import { CopyButton, CopyIcon } from "@/components/CopyButton";
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
                          // Its options: Open to Close's own, then the new ones to add.
                          const kept =
                            f.kind === "choice" ? choiceOptions(f, edits[f.id]).filter((o) => !o.removed) : [];
                          const otcOptions = kept.filter((o) => !o.isNew).map((o) => o.title);
                          const newOptions = kept.filter((o) => o.isNew).map((o) => o.title);
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
                              {otcOptions.length > 0 && (
                                <p className="mt-1.5 pl-8 text-xs text-ink-soft">
                                  <span className="font-semibold">Open to Close options:</span>{" "}
                                  {otcOptions.join(", ")}
                                </p>
                              )}
                              {newOptions.length > 0 && (
                                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-8">
                                  <span className="text-xs font-semibold text-ink-soft">New options:</span>
                                  {newOptions.map((o) => (
                                    <span
                                      key={o}
                                      className="inline-flex items-center gap-0.5 rounded-full border border-gold/50 bg-gold/10 py-0.5 pl-2 pr-1 text-xs text-ink"
                                    >
                                      {o}
                                      <CopyIcon text={o} />
                                    </span>
                                  ))}
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
