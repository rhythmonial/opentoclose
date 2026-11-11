"use client";

import { useState } from "react";
import Link from "next/link";
import type { ContractBlank } from "@/lib/contractBlanks";
import { ContractReviewer } from "@/components/ContractReviewer";
import { DocumentBoundary } from "@/components/DocumentBoundary";
import { DocTitle } from "@/components/DocTitle";
import { saveContractReview } from "@/app/configurator/upload_your_contract_docs/actions";

// One uploaded contract on its own page, with its page-by-page review.
// Clicking its name renames it.
export function SavedContractDoc({
  id,
  fileName,
  url,
  pageCount,
  blanks,
  confirmedPages,
  isScanned,
  uploadedOn,
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
  // The next document still to review.
  nextHref?: string | null;
  actions?: React.ReactNode;
}) {
  // A document reviewed before it was opened starts on its pages to pick
  // from; otherwise the review stays open (confirming the last page doesn't
  // close it).
  const [reviewedAtOpen] = useState(pageCount > 0 && confirmedPages.length === pageCount);
  // Reviewing a reviewed document again starts from the page they pick,
  // which goes back to unconfirmed.
  const [again, setAgain] = useState<{ page: number; confirmed: number[] } | null>(null);
  // Pages confirmed as they're confirmed in the reviewer.
  const [live, setLive] = useState<number[] | null>(null);
  const confirmedCount = (live ?? again?.confirmed ?? confirmedPages).length;
  const reviewed = pageCount > 0 && confirmedCount === pageCount;
  const [saving, setSaving] = useState(false);

  async function reviewPage(n: number) {
    const confirmed = confirmedPages.filter((p) => p !== n);
    setSaving(true);
    await saveContractReview({ id, blanks, confirmedPages: confirmed });
    setSaving(false);
    setLive(null);
    setAgain({ page: n, confirmed });
  }

  return (
    <div data-contract-doc className="scroll-mt-4 rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="min-w-0">
            <DocTitle
              id={id}
              name={fileName}
              clickToRename
              className="font-display text-xl font-bold text-ink"
            />
          </h1>
          <p className="text-xs text-ink-faint">
            {pageCount} page{pageCount === 1 ? "" : "s"} &middot; Uploaded {uploadedOn}
          </p>
          {!isScanned && (
            <span
              className={`mt-1.5 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                reviewed ? "bg-success-soft text-success" : "bg-warning-soft text-warning"
              }`}
            >
              {reviewed ? "Reviewed" : `${confirmedCount} of ${pageCount} pages confirmed`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open PDF"
              title="Open PDF"
              className="rounded p-1 text-accent hover:bg-accent-soft/60"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </a>
          )}
          {actions}
        </div>
      </div>
      {isScanned && (
        <p className="mt-2 text-sm text-warning">
          This looks like a scanned copy, so there&rsquo;s no text to read blanks from. Delete it
          and upload the original digital PDF if you have it.
        </p>
      )}
      {url && !isScanned && (
        <div className="mt-4">
          {reviewedAtOpen && !again ? (
            <div className="rounded-lg border border-success/30 bg-success-soft/60 p-4">
              <p className="text-sm font-semibold text-success">This document has been reviewed.</p>
              <p className="mt-0.5 text-sm text-ink-soft">
                Pick a page to review again. It goes back to unconfirmed until you confirm it.
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
              {nextHref && (
                <Link
                  href={nextHref}
                  className="mt-4 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white"
                >
                  Next document &rsaquo;
                </Link>
              )}
            </div>
          ) : (
            <DocumentBoundary>
              <ContractReviewer
                key={again ? `again-${again.page}` : "review"}
                source={url}
                pageCount={pageCount}
                initialBlanks={blanks}
                initialConfirmed={again?.confirmed ?? confirmedPages}
                initialPage={again?.page ?? 1}
                onSave={(next, confirmed) => saveContractReview({ id, blanks: next, confirmedPages: confirmed })}
                onConfirmedChange={setLive}
              />
            </DocumentBoundary>
          )}
        </div>
      )}
    </div>
  );
}
