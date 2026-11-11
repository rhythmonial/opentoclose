"use client";

import { useState } from "react";
import { fieldsNeedingType, type ContractBlank } from "@/lib/contractBlanks";
import { ContractReviewer } from "@/components/ContractReviewer";
import { DocumentBoundary } from "@/components/DocumentBoundary";
import { DocTitle } from "@/components/DocTitle";
import { saveContractReview } from "@/app/configurator/upload_your_contract_docs/actions";

// One uploaded contract on its own page, with its review. Clicking its name
// renames it. Once every field has a type, Confirm marks it reviewed (a
// field that loses its type, or a new box, takes that back).
export function SavedContractDoc({
  id,
  fileName,
  url,
  pageCount,
  blanks,
  confirmedPages,
  isScanned,
  uploadedOn,
  nextDocHref,
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
  // The next document in their list.
  nextDocHref?: string | null;
  actions?: React.ReactNode;
}) {
  const [confirmed, setConfirmed] = useState(pageCount > 0 && confirmedPages.length === pageCount);
  const [left, setLeft] = useState(() => fieldsNeedingType(blanks).left);
  // A field needing a type again takes the confirmation back.
  const fieldsLeft = (n: number) => {
    setLeft(n);
    if (n > 0) setConfirmed(false);
  };
  const canReview = Boolean(url) && !isScanned;

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
                confirmed ? "bg-success-soft text-success" : "bg-warning-soft text-warning"
              }`}
            >
              {confirmed
                ? "Reviewed"
                : left > 0
                  ? `${left} field${left === 1 ? " needs" : "s need"} a field type`
                  : "Ready to confirm"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {canReview &&
            (confirmed ? (
              <button
                type="button"
                onClick={() => setConfirmed(false)}
                title="Confirmed. Click to undo."
                className="rounded-lg border border-success/40 bg-success-soft px-3 py-1.5 text-sm font-semibold text-success"
              >
                Confirmed ✓
              </button>
            ) : (
              <button
                type="button"
                disabled={left > 0}
                onClick={() => setConfirmed(true)}
                title={
                  left > 0
                    ? `Give every field a type first (${left} left, outlined in red or yellow).`
                    : "Confirm this document is ready."
                }
                className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Confirm
              </button>
            ))}
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
      {canReview && url && (
        <div className="mt-4">
          <DocumentBoundary>
            <ContractReviewer
              source={url}
              pageCount={pageCount}
              initialBlanks={blanks}
              confirmed={confirmed}
              onFieldsLeft={fieldsLeft}
              nextDocHref={nextDocHref}
              onSave={(next, pages) => saveContractReview({ id, blanks: next, confirmedPages: pages })}
            />
          </DocumentBoundary>
        </div>
      )}
    </div>
  );
}
