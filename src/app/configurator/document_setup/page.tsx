import { CUSTOM_PREFIX, STARTER_CATEGORIES } from "@/lib/documentCategories";
import { allSides, sideAbbreviations } from "@/lib/docSides";
import { inUploadOrder } from "@/lib/docOrder";
import { CopyIcon } from "@/components/CopyButton";
import { CheckedCopyName, SetupCheckbox } from "@/components/SetupChecks";
import { loadSetupLesson, SetupShell } from "../_setup/shell";

// Document Setup: their documents organized by document template, one per
// side and category ("B Inspection Documents"), each with its clean name
// ("Inspection Documents") and its documents, all copyable for building
// in Open to Close.
export default async function DocumentSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const { client } = await searchParams;
  const lesson = await loadSetupLesson("document_setup", client);
  const { supabase, accountId, isStaff } = lesson;

  let content: React.ReactNode = null;
  if (accountId) {
    const [{ data: contracts }, { data: prep }, { data: custom }, { data: checks }] = await Promise.all([
      supabase
        .from("contract_documents")
        .select("id, file_name, side, upload_order, created_at")
        .eq("client_account_id", accountId),
      supabase.from("prep_documents").select("contract_document_id, categories").eq("client_account_id", accountId),
      supabase.from("document_categories").select("id, name").eq("client_account_id", accountId),
      supabase
        .from("client_setup_checks")
        .select("checked")
        .eq("client_account_id", accountId)
        .eq("step_key", "document_setup")
        .maybeSingle(),
    ]);
    const checked = new Set(checks?.checked ?? []);
    const check = (key: string) => ({
      accountId: isStaff ? accountId : null,
      stepKey: "document_setup",
      checkKey: key,
      initialChecked: checked.has(key),
    });
    const categoryName = (id: string) =>
      STARTER_CATEGORIES.find((c) => c.id === id)?.name ??
      (custom ?? []).find((c) => `${CUSTOM_PREFIX}${c.id}` === id)?.name ??
      null;
    const categoryOf = new Map(
      (prep ?? []).filter((p) => p.contract_document_id).map((p) => [p.contract_document_id!, p.categories?.[0] ?? null] as const),
    );
    const docs = inUploadOrder(contracts ?? []);
    const sides = allSides(docs.map((d) => d.side));
    const abbr = sideAbbreviations(sides);
    const docName = (f: string) => f.replace(/\.pdf$/i, "");

    // One template per side and category, in side order then A to Z.
    const templates = new Map<string, { side: string; category: string; docs: string[] }>();
    const unsorted: string[] = [];
    for (const d of docs) {
      const cat = categoryOf.get(d.id);
      const category = cat ? categoryName(cat) : null;
      if (!d.side || !category) {
        unsorted.push(docName(d.file_name));
        continue;
      }
      const key = `${d.side}\u0000${category}`;
      const t = templates.get(key) ?? { side: d.side, category, docs: [] };
      t.docs.push(docName(d.file_name));
      templates.set(key, t);
    }
    const list = [...templates.values()].sort(
      (a, b) => sides.indexOf(a.side) - sides.indexOf(b.side) || a.category.localeCompare(b.category),
    );

    content = (
      <div className="flex flex-col gap-4">
        {list.length === 0 && (
          <p className="rounded-xl border border-border bg-surface p-6 text-sm text-ink-soft">
            No document templates yet. Give your contracts a side in Upload Your Contracts and a
            category in Categorize Your Documents.
          </p>
        )}
        {list.map((t) => {
          const clean = `${t.category} Documents`;
          const full = `${abbr[t.side] ?? t.side.charAt(0)} ${clean}`;
          return (
            <section key={`${t.side}-${t.category}`} className="rounded-xl border border-border bg-surface">
              <div className="flex flex-col gap-1.5 border-b border-border-soft px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="w-24 text-xs font-semibold uppercase tracking-wide text-ink-faint">Template</span>
                  <CheckedCopyName
                    {...check(`t:${full}`)}
                    name={full}
                    className="font-display text-base font-bold text-ink"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="w-24 text-xs font-semibold uppercase tracking-wide text-ink-faint">Folder name</span>
                  <span className="inline-flex items-center gap-1.5 leading-none">
                    {/* Lines up with the template name (past its checkbox). */}
                    <span className="w-3.5" aria-hidden />
                    <span className="text-sm text-ink">{clean}</span>
                    <CopyIcon text={clean} />
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-[1fr_7rem] gap-2 border-b border-border-soft bg-bg px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                <span>Document</span>
                <span className="text-center">Doc Features</span>
              </div>
              <ul className="flex flex-col divide-y divide-border-soft">
                {t.docs.map((d) => (
                  <li key={d} className="grid grid-cols-[1fr_7rem] items-center gap-2 px-4 py-2 text-sm">
                    <CheckedCopyName {...check(`d:${full}:${d}`)} name={d} className="text-ink" />
                    <span className="flex justify-center">
                      <SetupCheckbox {...check(`f:${full}:${d}`)} label={`${d} doc features`} />
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
        {unsorted.length > 0 && (
          <p className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">
            Still needing a side or category: {unsorted.join(", ")}.
          </p>
        )}
      </div>
    );
  }

  return (
    <SetupShell
      lesson={lesson}
      fallbackTitle="Document Setup"
      blurb="Your documents organized by document template, one for each side and category. Copy each template's name (with its side's prefix), its folder name and its documents into Open to Close. Each box checks off when you copy; check Doc Features once a document's features are set."
    >
      {content}
    </SetupShell>
  );
}
