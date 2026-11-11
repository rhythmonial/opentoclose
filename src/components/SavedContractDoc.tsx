"use client";

import { useState } from "react";
import Link from "next/link";
import type { ContractBlank } from "@/lib/contractBlanks";
import { ContractReviewer } from "@/components/ContractReviewer";
import { DocumentBoundary } from "@/components/DocumentBoundary";
import { saveContractReview } from "@/app/configurator/upload_your_contract_docs/actions";

// One uploaded contract on its own page, with its page-by-page review.
export function SavedContractDoc({
  id,
  fileName,
  url,
  pageCount,
  blanks,
  confirmedPages,
  isScanned,
  uploadedOn,
  backHref,
  nextHref,
  actions,
}: {
  id: string;
  fileName: string;
  url: string | null;
  pageCount: number;
  blanks: ContractBlank[];
  confirmedPages: number[];
  isScanned: boolean;
  uploadedOn: string;
  // The documents list, and the next document still to review.
  backHref: string;
  nextHref?: string | null;
  actions?: React.ReactNode;
}) {
  // What's been saved here since the page loaded (the page's copy catches
  // up after).
  const [latest, setLatest] = useState<{
    blanks: ContractBlank[];
    confirmed: number[];
  } | null>(null);
  const current = latest ?? { blanks, confirmed: confirmedPages };
  const reviewed = pageCount > 0 && current.confirmed.length === pageCount;
  // Pages confirmed as they're confirmed in the reviewer.
  const [live, setLive] = useState<number[] | null>(null);
  const confirmedCount = (live ?? current.confirmed).length;
  // Reviewing a reviewed document again starts from the page they pick,
  // which goes back to unconfirmed; confirming it saves and comes back to
  // the pages.
  const [again, setAgain] = useState<{
    page: number;
    confirmed: number[];
  } | null>(null);
  const [saving, setSaving] = useState(false);
  async function reviewPage(n: number) {
    const confirmed = current.confirmed.filter((p) => p !== n);
    setSaving(true);
    await saveContractReview({
      id,
      blanks: current.blanks,
      confirmedPages: confirmed,
    });
    setSaving(false);
    setLatest({ blanks: current.blanks, confirmed });
    setLive(null);
    setAgain({ page: n, confirmed });
  }

  return (
    <div
      data-contract-doc
      className="scroll-mt-4 rounded-xl border border-border bg-surface p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="truncate font-display text-xl font-bold text-ink">
            {fileName}
          </h1>
          <p className="text-xs text-ink-faint">
            {pageCount} page{pageCount === 1 ? "" : "s"} &middot; Uploaded{" "}
            {uploadedOn}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!isScanned &&
            (reviewed ? (
              <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-semibold text-success">
                Reviewed
              </span>
            ) : (
              <span className="rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-semibold text-warning">
                {confirmedCount} of {pageCount} pages confirmed
              </span>
            ))}
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-accent"
            >
              Open PDF
            </a>
          )}
          {actions}
        </div>
      </div>
      {isScanned && (
        <p className="mt-2 text-sm text-warning">
          This looks like a scanned copy, so there&rsquo;s no text to read
          blanks from. Delete it and upload the original digital PDF if you have
          it.
        </p>
      )}
      {url && !isScanned && (
        <div className="mt-4">
          {reviewed && !again ? (
            <div className="rounded-lg border border-success/30 bg-success-soft/60 p-4">
              <p className="text-sm font-semibold text-success">
                This document has been reviewed.
              </p>
              <p className="mt-0.5 text-sm text-ink-soft">
                Pick a page to review again. It goes back to unconfirmed until
                you confirm it.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    disabled={saving}
                    onClick={() => reviewPage(n)}
                    className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-ink hover:border-accent hover:text-accent disabled:opacity-50"
                  >
                    Page {n}
                  </button>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Link
                  href={backHref}
                  className="rounded-lg border border-accent px-4 py-2 text-sm font-semibold text-accent hover:bg-accent-soft/50"
                >
                  &lsaquo; Back to documents
                </Link>
                {nextHref && (
                  <Link
                    href={nextHref}
                    className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white"
                  >
                    Next document &rsaquo;
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <DocumentBoundary>
              <ContractReviewer
                key={again ? `again-${again.page}` : "review"}
                source={url}
                pageCount={pageCount}
                initialBlanks={current.blanks}
                initialConfirmed={again?.confirmed ?? current.confirmed}
                initialPage={again?.page ?? 1}
                onSave={(next, confirmed) =>
                  saveContractReview({
                    id,
                    blanks: next,
                    confirmedPages: confirmed,
                  })
                }
                onConfirmedChange={setLive}
                onAllConfirmed={(next, confirmed) => {
                  setLatest({ blanks: next, confirmed });
                  setLive(null);
                  setAgain(null);
                }}
              />
            </DocumentBoundary>
          )}
        </div>
      )}
    </div>
  );
}
