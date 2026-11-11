import Link from "next/link";
import { notFound } from "next/navigation";
import { SavedContractDoc } from "@/components/SavedContractDoc";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { deleteContractDocument } from "../actions";
import { loadUploadDocs, typedBlanks } from "../load";

// One uploaded contract on its own page (/doc1, /doc2… in the client's
// upload order), with its page-by-page review.
export default async function UploadedContractPage({
  params,
  searchParams,
}: {
  params: Promise<{ doc: string }>;
  searchParams: Promise<{ client?: string; page?: string }>;
}) {
  const [{ doc: slug }, { client, page: openPage }] = await Promise.all([params, searchParams]);
  const { staffClient, docs, urlOf, listHref, docHref } = await loadUploadDocs(client);
  const n = Number(/^doc(\d+)$/.exec(slug)?.[1] ?? 0);
  const doc = docs[n - 1];
  if (!doc) notFound();

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
            fileName={doc.file_name}
            url={urlOf(doc)}
            pageCount={doc.page_count ?? 0}
            blanks={typedBlanks(doc)}
            nextDocHref={n < docs.length ? docHref(n) : null}
            initialPage={Number(openPage) || 1}
            isScanned={doc.is_scanned}
            uploadedOn={new Date(doc.created_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
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
