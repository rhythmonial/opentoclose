"use client";

import { useState } from "react";
import { fieldsNeedingType, type ContractBlank } from "@/lib/contractBlanks";
import { ContractReviewer } from "@/components/ContractReviewer";
import { DocumentBoundary } from "@/components/DocumentBoundary";
import { DocTitle } from "@/components/DocTitle";
import { saveContractReview } from "@/app/configurator/upload_your_contract_docs/actions";

// One uploaded contract on its own page, with its review. Clicking its name
// renames it. It's completed once every field has a type.
// field that loses its type, or a new box, takes that back).
export function SavedContractDoc({
  id,
  fileName,
  url,
  pageCount,
  blanks,
  isScanned,
  uploadedOn,
  nextDocHref,
  initialPage = 1,
  actions,
  deleteOnly = false,
}: {
  id: string;
  fileName: string;
  url: string | null;
  pageCount: number;
  blanks: ContractBlank[];
  isScanned: boolean;
  uploadedOn: string;
  // The next document in their list.
  nextDocHref?: string | null;
  // The page to open on (from the address).
  initialPage?: number;
  actions?: React.ReactNode;
  // Upload Your Contracts: only removing fields (types come in Assign).
  deleteOnly?: boolean;
}) {
  const [left, setLeft] = useState(() => fieldsNeedingType(blanks).left);
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
          {!isScanned && !deleteOnly && (
            <span
              className={`mt-1.5 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                left === 0 ? "bg-success-soft text-success" : "bg-danger/10 text-danger"
              }`}
            >
              {left === 0 ? "Completed" : `${left} field${left === 1 ? " needs" : "s need"} a field type`}
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
      {canReview && url && (
        <div className="mt-4">
          <DocumentBoundary>
            <ContractReviewer
              source={url}
              pageCount={pageCount}
              initialBlanks={blanks}
              onFieldsLeft={setLeft}
              nextDocHref={nextDocHref}
              initialPage={initialPage}
              syncPage
              deleteOnly={deleteOnly}
              onSave={(next) => saveContractReview({ id, blanks: next })}
            />
          </DocumentBoundary>
        </div>
      )}
    </div>
  );
}
