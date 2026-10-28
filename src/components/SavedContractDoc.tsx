"use client";

import type { ContractBlank } from "@/lib/contractBlanks";
import { ContractPreview } from "@/components/ContractPreview";

// One uploaded contract, with its blanks reviewable on demand.
export function SavedContractDoc({
  fileName,
  url,
  pageCount,
  blanks,
  isScanned,
  uploadedOn,
  actions,
}: {
  fileName: string;
  url: string | null;
  pageCount: number;
  blanks: ContractBlank[];
  isScanned: boolean;
  uploadedOn: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{fileName}</p>
          <p className="text-xs text-ink-faint">
            {pageCount} page{pageCount === 1 ? "" : "s"} &middot; {blanks.length} blank
            {blanks.length === 1 ? "" : "s"} found &middot; Uploaded {uploadedOn}
          </p>
        </div>
        <div className="flex items-center gap-2">
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
          blanks from. Upload the original digital PDF if you have it.
        </p>
      )}
      {url && !isScanned && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-semibold text-accent">
            Review blanks
          </summary>
          <div className="mt-3">
            <ContractPreview source={url} blanks={blanks} pageCount={pageCount} />
          </div>
        </details>
      )}
    </div>
  );
}
