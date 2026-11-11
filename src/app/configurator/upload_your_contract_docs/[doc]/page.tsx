import Link from "next/link";
import { notFound } from "next/navigation";
import type { ContractBlank } from "@/lib/contractBlanks";
import { withWorkflowTypes } from "@/lib/fieldTypes";
import { cleanWorkflowFields, workflowKeys } from "@/lib/workflowFields";
import { SavedContractDoc } from "@/components/SavedContractDoc";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { deleteContractDocument } from "../actions";
import { loadUploadDocs } from "../load";

// One uploaded contract on its own page (/doc1, /doc2… in the client's
// upload order), with its page-by-page review.
export default async function UploadedContractPage({
  params,
  searchParams,
}: {
  params: Promise<{ doc: string }>;
  searchParams: Promise<{ client?: string }>;
}) {
  const [{ doc: slug }, { client }] = await Promise.all([params, searchParams]);
  const { staffClient, docs, urlOf, listHref, docHref } = await loadUploadDocs(client);
  const n = Number(/^doc(\d+)$/.exec(slug)?.[1] ?? 0);
  const doc = docs[n - 1];
  if (!doc) notFound();
  const next = docs.slice(n).find((d) => !d.is_scanned && !d.reviewed_at);

  return (
    <main className="flex flex-1 justify-center bg-bg px-4 py-12">
      <div className="w-full max-w-4xl">
        <Link href={listHref} className="text-sm font-semibold text-accent">
          &lsaquo; Back to documents
        </Link>

        {staffClient && (
          <div className="mt-4 rounded-lg border border-accent-soft bg-accent-soft/40 px-4 py-2.5 text-sm font-semibold text-accent">
            Viewing {staffClient.name}&rsquo;s contracts &mdash; changes you make are saved to
            their account.
          </div>
        )}

        <div className="mt-4">
          <SavedContractDoc
            key={doc.id}
            id={doc.id}
            confirmedPages={doc.confirmed_pages}
            fileName={doc.file_name}
            url={urlOf(doc)}
            pageCount={doc.page_count ?? 0}
            // With the types picked for its workflow fields (from before
            // types were chosen here).
            blanks={withWorkflowTypes(
              doc.blanks as ContractBlank[],
              cleanWorkflowFields(doc.workflow_fields, workflowKeys(doc.blanks as ContractBlank[])),
            )}
            isScanned={doc.is_scanned}
            uploadedOn={new Date(doc.created_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
            nextHref={next ? docHref(docs.indexOf(next)) : null}
            actions={
              <form action={deleteContractDocument}>
                <input type="hidden" name="id" value={doc.id} />
                <input type="hidden" name="back" value={listHref} />
                <ConfirmDeleteButton title={`Delete ${doc.file_name}`} size="sm" />
              </form>
            }
          />
        </div>
      </div>
    </main>
  );
}
