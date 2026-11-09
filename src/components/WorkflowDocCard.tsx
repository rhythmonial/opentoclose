"use client";

import type { ContractBlank } from "@/lib/contractBlanks";
import type { WorkflowField } from "@/lib/workflowFields";
import type { OtcField } from "@/lib/otcFields";
import { WorkflowFieldPicker } from "@/components/WorkflowFieldPicker";
import {
  saveContractLines,
  saveWorkflowFields,
} from "@/app/configurator/assign_your_workflow_fields/actions";
import { DocumentBoundary } from "@/components/DocumentBoundary";

// One uploaded contract in Assign Your Workflow Fields.
export function WorkflowDocCard({
  id,
  fileName,
  url,
  pageCount,
  blanks,
  fields,
  otcFields,
  reviewed,
  defaultOpen,
}: {
  id: string;
  fileName: string;
  url: string;
  pageCount: number;
  blanks: ContractBlank[];
  fields: WorkflowField[];
  // OTC fields the client has added on any of their contracts.
  otcFields: OtcField[];
  reviewed: boolean;
  defaultOpen: boolean;
}) {
  return (
    <details open={defaultOpen} className="rounded-xl border border-border bg-surface p-4">
      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
        <span className="min-w-0 truncate text-sm font-semibold text-ink">{fileName}</span>
        <span className="text-xs text-ink-faint">
          {pageCount} page{pageCount === 1 ? "" : "s"} &middot; {blanks.length} fields
        </span>
      </summary>
      {!reviewed && (
        <p className="mt-3 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">
          This document&rsquo;s review isn&rsquo;t finished yet, so some fields
          may be missing. Finish it in Upload Your Contracts to add them.
        </p>
      )}
      <div className="mt-3">
        <DocumentBoundary>
          <WorkflowFieldPicker
            source={url}
            pageCount={pageCount}
            blanks={blanks}
            initialFields={fields}
            extraOtcFields={otcFields}
            onSave={(picked) => saveWorkflowFields(id, picked)}
            onLineNumbers={(lines) => saveContractLines(id, lines)}
          />
        </DocumentBoundary>
      </div>
    </details>
  );
}
