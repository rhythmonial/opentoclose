"use client";

import type { ContractBlank } from "@/lib/contractBlanks";
import { ContractReviewer } from "@/components/ContractReviewer";
import { saveContractReview } from "@/app/configurator/upload_your_contract_docs/actions";

// One uploaded contract, with its page-by-page review.
export function SavedContractDoc({
  id,
  fileName,
  url,
  pageCount,
  blanks,
  confirmedPages,
  isScanned,
  uploadedOn,
  defaultOpen = false,
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
  defaultOpen?: boolean;
  actions?: React.ReactNode;
}) {
  const reviewed = pageCount > 0 && confirmedPages.length === pageCount;

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{fileName}</p>
          <p className="text-xs text-ink-faint">
            {pageCount} page{pageCount === 1 ? "" : "s"} &middot; Uploaded {uploadedOn}
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
                {confirmedPages.length} of {pageCount} pages confirmed
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
          blanks from. Delete it and upload the original digital PDF if you
          have it.
        </p>
      )}
      {url && !isScanned && (
        <details open={defaultOpen} className="mt-3">
          <summary className="cursor-pointer text-sm font-semibold text-accent">
            {reviewed ? "Review again" : "Review pages"}
          </summary>
          <div className="mt-3">
            <ContractReviewer
              source={url}
              pageCount={pageCount}
              initialBlanks={blanks}
              initialConfirmed={confirmedPages}
              onSave={(next, confirmed) =>
                saveContractReview({ id, blanks: next, confirmedPages: confirmed })
              }
            />
          </div>
        </details>
      )}
    </div>
  );
}
