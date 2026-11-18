import { loadFieldUse } from "@/lib/fieldUse";
import { choiceOptions, cleanChoiceEdits, orgFields } from "@/lib/fieldOrganization";
import { CONTACT_ROLES_SECTION, OTC_FIELDS } from "@/lib/otcFields";
import { contractLines } from "@/lib/placeholders";
import { spotLabel } from "@/lib/placeholders";
import { CUSTOM_PREFIX, STARTER_CATEGORIES } from "@/lib/documentCategories";
import { allSides, sideAbbreviations } from "@/lib/docSides";
import { inUploadOrder } from "@/lib/docOrder";
import { loadSetupTasks } from "@/lib/taskSetup";
import {
  cleanIds,
  cleanIntakeTriggers,
  docTemplateLabel,
  taskTemplateLabel,
} from "@/lib/intakeForm";
import { IntakeFormPlanner, type IntakeField } from "@/components/IntakeFormPlanner";
import { loadSetupLesson, SetupShell } from "../_setup/shell";
import { finishIntakeForm } from "./actions";

const KIND_LABELS: Record<string, string> = {
  text: "Text",
  text_area: "Text Area",
  currency: "Dollar",
  percentage: "Percentage",
  date: "Date",
  number: "Number",
  choice: "Choice",
};

// Prep Your Intake Form: their contract fields in the order they're on the
// contracts (plus fields they add), which are required, and the document
// and task templates each field brings in on which answers.
export default async function PrepYourIntakeFormPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const { client } = await searchParams;
  const lesson = await loadSetupLesson("prep_your_intake_form", client);
  const { supabase, accountId, isStaff } = lesson;

  let content: React.ReactNode = null;
  if (accountId) {
    const [use, { data: docs }, { data: org }, { data: saved }, { data: prep }, { data: categories }, tasks] =
      await Promise.all([
        loadFieldUse(supabase, accountId),
        supabase
          .from("contract_documents")
          .select("id, blanks, workflow_fields, created_at, upload_order, file_name, side")
          .eq("client_account_id", accountId)
          .eq("is_scanned", false),
        supabase.from("client_field_organization").select("choice_edits").eq("client_account_id", accountId).maybeSingle(),
        supabase.from("client_intake_forms").select("*").eq("client_account_id", accountId).maybeSingle(),
        supabase.from("prep_documents").select("contract_document_id, categories").eq("client_account_id", accountId),
        supabase.from("document_categories").select("id, name").eq("client_account_id", accountId),
        loadSetupTasks(supabase, accountId),
      ]);

    // Every field they could put on the form, with its kind and (for a
    // choice field) the options they kept in Organize Your Fields.
    const builtIn = OTC_FIELDS.filter((f) => f.sectionId !== CONTACT_ROLES_SECTION);
    const every = orgFields(
      new Set(builtIn.map((f) => f.id)),
      use.newFields,
      use.custom,
      use.contractOptions,
      use.sections,
    );
    const edits = cleanChoiceEdits(org?.choice_edits, every);
    const sectionName = (id: string) => use.sections.find((s) => s.id === id)?.name ?? "";
    const fields: IntakeField[] = every.map((f) => ({
      id: f.id,
      name: use.names[f.id] ?? f.name,
      kind: f.kind ? (KIND_LABELS[f.kind] ?? f.kind) : "",
      section: sectionName(f.sectionId),
      options:
        f.kind === "choice"
          ? choiceOptions(f, edits[f.id]).filter((o) => !o.removed).map((o) => o.title)
          : null,
    }));
    const known = new Set(fields.map((f) => f.id));

    // Contract fields in the order they're on the contracts: by document
    // (upload order), page, then line number.
    const lines = contractLines(docs ?? []);
    const docOrder = inUploadOrder(docs ?? []).map((d) => d.file_name.replace(/\.pdf$/i, ""));
    const contractIds = Object.keys(lines)
      .filter((id) => known.has(id))
      .map((id, i) => ({ id, i, at: lines[id] }))
      .sort(
        (a, b) =>
          docOrder.indexOf(a.at.doc ?? "") - docOrder.indexOf(b.at.doc ?? "") ||
          (a.at.page ?? 0) - (b.at.page ?? 0) ||
          (a.at.line !== null && b.at.line !== null ? a.at.line - b.at.line : a.i - b.i),
      )
      .map((x) => x.id);
    const spots = Object.fromEntries(
      contractIds.flatMap((id) => (spotLabel(lines[id]) ? [[id, spotLabel(lines[id])!]] : [])),
    );

    // Document templates (a side and category each, as in Document Setup)
    // and task templates (Plan Your Tasks).
    const categoryName = (id: string) =>
      STARTER_CATEGORIES.find((c) => c.id === id)?.name ??
      (categories ?? []).find((c) => `${CUSTOM_PREFIX}${c.id}` === id)?.name ??
      null;
    const categoryOf = new Map(
      (prep ?? []).filter((p) => p.contract_document_id).map((p) => [p.contract_document_id!, p.categories?.[0] ?? null]),
    );
    const sides = allSides((docs ?? []).map((d) => d.side));
    const abbr = sideAbbreviations(sides);
    const docTemplates = [
      ...new Map(
        inUploadOrder(docs ?? []).flatMap((d) => {
          const cat = categoryOf.get(d.id);
          const name = cat ? categoryName(cat) : null;
          if (!d.side || !name) return [];
          return [[`${d.side}\u0000${name}`, { side: d.side, name }] as const];
        }),
      ).values(),
    ]
      .sort((a, b) => sides.indexOf(a.side) - sides.indexOf(b.side) || a.name.localeCompare(b.name))
      .map((t) => docTemplateLabel(`${abbr[t.side] ?? t.side.charAt(0)} ${t.name} Documents`));
    const taskTemplates = [...new Set(tasks.map((t) => t.templateName))].map(taskTemplateLabel);

    content = (
      <>
        <IntakeFormPlanner
          key={accountId}
          accountId={isStaff ? accountId : null}
          fields={fields}
          contractIds={contractIds}
          spots={spots}
          initialAdded={cleanIds(saved?.added).filter((id) => known.has(id) && !contractIds.includes(id))}
          initialRequired={cleanIds(saved?.required)}
          initialTriggers={cleanIntakeTriggers(saved?.triggers)}
          templates={[...taskTemplates, ...docTemplates]}
        />
        {!isStaff && (
          <form action={finishIntakeForm} className="mt-8 flex justify-center">
            <button type="submit" className="rounded-lg bg-accent px-8 py-2.5 text-sm font-semibold text-white">
              I&rsquo;m Done Prepping My Intake Form
            </button>
          </form>
        )}
      </>
    );
  }

  return (
    <SetupShell
      lesson={lesson}
      wide
      fallbackTitle="Prep Your Intake Form"
      blurb="Your contract fields in the order they're on your contracts. Add any other fields your intake form needs and check the ones that must be filled in. Then pick the document and task templates a field brings in, and which answers bring them in (for example, Inspections Waived = No brings in your inspection templates)."
    >
      {content}
    </SetupShell>
  );
}
