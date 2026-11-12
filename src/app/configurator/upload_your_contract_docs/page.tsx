import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { SortableGroup } from "@/components/dnd/SortableGroup";
import { ContractUploader } from "@/components/ContractUploader";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { DocTitle } from "@/components/DocTitle";
import { deleteContractDocument, finishContractDocs, reorderUploadDocs } from "./actions";
import { loadUploadDocs } from "./load";
import { DocSideSelect } from "@/components/DocSideSelect";
import { allSides } from "@/lib/docSides";

export default async function UploadContractDocsPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const { client } = await searchParams;
  const { step, isStaff, sandboxTier, staffClient, accountId, testMode, docs, docHref } =
    await loadUploadDocs(client);

  // Each contract needs its side (buyer, seller, transaction, listing…).
  const toReview = docs.filter((d) => !d.side);
  const sides = allSides(docs.map((d) => d.side));

  const title = (
    <h1 className="font-display text-2xl font-bold text-ink">
      {step?.title ?? "Upload Your Contract Docs"}
    </h1>
  );
  const description = step?.description ? (
    <div
      className="mt-1.5 text-sm leading-relaxed text-ink-soft
        [&_p]:mt-2 [&_strong]:font-bold [&_strong]:text-ink [&_em]:italic
        [&_a]:font-semibold [&_a]:text-accent [&_a]:underline
        [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mt-2 [&_ol]:list-decimal [&_ol]:pl-5
        [&_li]:mt-1 first:[&>*]:mt-0"
    >
      <ReactMarkdown>{step.description}</ReactMarkdown>
    </div>
  ) : (
    <p className="mt-1.5 text-sm text-ink-soft">
      Upload the blank versions of your contracts and addenda (PDFs only, up to 25 MB each).
      We&rsquo;ll read each one for its fill-in blanks to map them to fields in your setup.
    </p>
  );

  return (
    <main className="flex flex-1 justify-center bg-bg px-4 py-12">
      <div className="w-full max-w-4xl">
        <Link
          href={
            staffClient
              ? `/dashboard/clients/${staffClient.id}`
              : isStaff && !sandboxTier
                ? "/dashboard/tasks"
                : "/portal"
          }
          className="text-sm font-medium text-accent"
        >
          &larr;{" "}
          {staffClient
            ? `Back to ${staffClient.name}`
            : isStaff && !sandboxTier
              ? "Back to editor"
              : "Back to your setup"}
        </Link>

        {testMode && (
          <div className="mt-4 rounded-lg border border-accent-soft bg-accent-soft/40 px-4 py-2.5 text-sm font-semibold text-accent">
            Test mode &mdash; drop in any PDF to see what blanks it finds.
            Nothing is uploaded or saved.
          </div>
        )}
        {staffClient && (
          <div className="mt-4 rounded-lg border border-accent-soft bg-accent-soft/40 px-4 py-2.5 text-sm font-semibold text-accent">
            Viewing {staffClient.name}&rsquo;s contracts &mdash; changes you make are saved to
            their account.
          </div>
        )}

        <div className="mt-3">
          {/* Only the client uploads their own contracts. */}
          {staffClient ? (
            <>
              {title}
              {description}
            </>
          ) : (
            <ContractUploader accountId={accountId} testMode={isStaff} title={title}>
              {description}
            </ContractUploader>
          )}
        </div>

        {staffClient && docs.length === 0 && (
          <p className="mt-6 rounded-xl border border-border bg-surface p-6 text-sm text-ink-soft">
            {staffClient.name} hasn&rsquo;t uploaded any contracts yet.
          </p>
        )}

        {docs.length > 0 && (
          <section className="mt-8">
            <h2 className="text-[15px] font-bold text-ink">
              {staffClient ? "Their" : "Your"} uploaded documents ({docs.length})
            </h2>
            <p className="mt-0.5 text-xs text-ink-faint">
              Pick each document&rsquo;s side. Click a document to remove any fields you don&rsquo;t
              want to track, or the pencil to rename it. Drag the handle beside a document to put them in
              the order you like.
            </p>
            <div className="mt-3">
              <SortableGroup
                gapClass="gap-2"
                handleClass="mt-4"
                onReorder={reorderUploadDocs.bind(null, staffClient?.id ?? null)}
                items={docs.map((doc, i) => {
                  const pages = doc.page_count ?? 0;
                  return {
                    id: doc.id,
                    node: (
                      <div className="flex items-stretch gap-2">
                        {/* The whole card opens the document; the pencil renames it. */}
                        <div className="relative flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface p-4 hover:border-accent">
                          <Link
                            href={docHref(i)}
                            aria-label={`Open ${doc.file_name}`}
                            className="absolute inset-0 rounded-xl"
                          />
                          <span className="pointer-events-none relative min-w-0">
                            <DocTitle
                              id={doc.id}
                              name={doc.file_name}
                              className="text-sm font-semibold text-ink"
                            />
                            <span className="block text-xs text-ink-faint">
                              {pages} page{pages === 1 ? "" : "s"} &middot; Uploaded{" "}
                              {new Date(doc.created_at).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </span>
                          </span>
                          <span className="relative flex items-center gap-2">
                            {doc.is_scanned && (
                              <span className="pointer-events-none rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-semibold text-warning">
                                Scanned copy
                              </span>
                            )}
                            <DocSideSelect docId={doc.id} value={doc.side} sides={sides} />
                          </span>
                        </div>
                        <form action={deleteContractDocument} className="flex items-center">
                          <input type="hidden" name="id" value={doc.id} />
                          <ConfirmDeleteButton title={`Delete ${doc.file_name}`} size="sm" />
                        </form>
                      </div>
                    ),
                  };
                })}
              />
            </div>

            {!isStaff && (
              <form action={finishContractDocs} className="mt-6 flex flex-col items-center gap-2">
                <button
                  type="submit"
                  disabled={toReview.length > 0}
                  className="rounded-lg bg-accent px-8 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  I&rsquo;m Done Uploading
                </button>
                {toReview.length > 0 && (
                  <span className="text-xs text-ink-faint">
                    Pick a side for{" "}
                    {toReview.length === 1 ? "1 more document" : `${toReview.length} more documents`}{" "}
                    to finish.
                  </span>
                )}
              </form>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
