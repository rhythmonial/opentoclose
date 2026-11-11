"use client";

import { useState } from "react";
import { setUrlParam } from "@/lib/urlState";
import { useFormStatus } from "react-dom";
import type { ContractBlank } from "@/lib/contractBlanks";
import type { OtcField } from "@/lib/otcFields";
import { isActive, isComplete, type WorkflowField } from "@/lib/workflowFields";
import { WorkflowFieldPicker } from "@/components/WorkflowFieldPicker";
import { DocumentBoundary } from "@/components/DocumentBoundary";
import { SortableGroup } from "@/components/dnd/SortableGroup";
import type { CustomSection } from "@/lib/otcFields";
import {
  addCustomSection,
  finishWorkflowFields,
  markDocAssigned,
  reorderAssignDocs,
  saveContractLines,
  saveWorkflowFields,
} from "@/app/configurator/assign_your_workflow_fields/actions";

export type WorkspaceDoc = {
  id: string;
  fileName: string;
  url: string;
  pageCount: number;
  blanks: ContractBlank[];
  fields: WorkflowField[];
  reviewed: boolean;
  done: boolean;
};

// Assign Your Fields: the client's contracts in a list (in their
// own order, dragged into place). Clicking one opens just that contract, a
// page at a time, with the fields on the page listed below it; "I'm Done
// With This Page" goes on to the next page, and after the last page, back
// to the list. Once every contract is done, "I'm Done Assigning" finishes
// the lesson.
export function AssignWorkflowWorkspace({
  docs,
  otcFields,
  editing,
  canFinish,
  initialDocId,
  initialPage,
  customSections: initialSections = [],
  intro,
}: {
  docs: WorkspaceDoc[];
  otcFields: OtcField[];
  editing: { accountId: string | null; names: Record<string, string> };
  // Clients finish the lesson; staff only work on the contracts.
  canFinish: boolean;
  // The contract to open first (from the page's address).
  initialDocId?: string | null;
  // The page of it to open on (from the address).
  initialPage?: number;
  // Sections the client added (for new fields).
  customSections?: CustomSection[];
  // The lesson's title and description (on the documents list only).
  intro?: React.ReactNode;
}) {
  const [sections, setSections] = useState(initialSections);
  const addSection = async (name: string, group: string) => {
    const res = await addCustomSection(editing.accountId, name, group);
    const section = res.ok ? res.section : undefined;
    if (!section) return null;
    setSections((all) => (all.some((s) => s.id === section.id) ? all : [...all, section]));
    return section;
  };
  const [fieldsByDoc, setFieldsByDoc] = useState<Record<string, WorkflowField[]>>(() =>
    Object.fromEntries(docs.map((d) => [d.id, d.fields])),
  );
  const [doneIds, setDoneIds] = useState(() => new Set(docs.filter((d) => d.done).map((d) => d.id)));
  const [pages, setPages] = useState<Record<string, number>>(() =>
    initialDocId && initialPage ? { [initialDocId]: initialPage } : {},
  );
  const [openId, setOpenId] = useState<string | null>(
    initialDocId && docs.some((d) => d.id === initialDocId) ? initialDocId : null,
  );
  const [finishing, setFinishing] = useState(false);

  const fieldsOf = (id: string) => fieldsByDoc[id] ?? [];
  const needsIn = (id: string) => fieldsOf(id).filter(isActive).filter((f) => !isComplete(f)).length;
  const pagesIn = (d: WorkspaceDoc) => Math.max(1, d.pageCount);

  // Keeps the open contract in the address, so a reload comes back to it.
  const open = (id: string | null) => {
    setOpenId(id);
    try {
      const url = new URL(window.location.href);
      if (id) url.searchParams.set("doc", id);
      else url.searchParams.delete("doc");
      url.searchParams.delete("page");
      window.history.replaceState(window.history.state, "", url);
    } catch {}
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  };

  const doc = docs.find((d) => d.id === openId);

  if (!doc) {
    const allPicked = docs.flatMap((d) => fieldsOf(d.id)).filter(isActive);
    const allNeeds = allPicked.filter((f) => !isComplete(f)).length;
    const notDone = docs.filter((d) => !doneIds.has(d.id)).length;
    return (
      <div className="flex flex-col gap-3">
        {intro}
        <div className={intro ? "mt-6" : ""}>
          <h2 className="text-[15px] font-bold text-ink">Your documents ({docs.length})</h2>
          <p className="mt-0.5 text-xs text-ink-faint">
            Click a document to assign its fields, one at a time. Drag the handle beside a
            document to put them in the order you like.
          </p>
        </div>
        <SortableGroup
          gapClass="gap-2"
          handleClass="mt-4"
          onReorder={(ids) => reorderAssignDocs(editing.accountId, ids)}
          items={docs.map((d) => {
            const needs = needsIn(d.id);
            const picked = fieldsOf(d.id).filter(isActive).length;
            const done = doneIds.has(d.id);
            return {
              id: d.id,
              node: (
                <button
                  type="button"
                  onClick={() => open(d.id)}
                  className="flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface p-4 text-left hover:border-accent"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">{d.fileName}</span>
                    <span className="block text-xs text-ink-faint">
                      {d.pageCount} page{d.pageCount === 1 ? "" : "s"} &middot; {picked} workflow field
                      {picked === 1 ? "" : "s"}
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    {needs > 0 ? (
                      <span className="rounded-full bg-danger/10 px-2.5 py-0.5 text-xs font-semibold text-danger">
                        {needs} need{needs === 1 ? "s" : ""} an answer
                      </span>
                    ) : done ? (
                      <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-semibold text-success">
                        Assigned
                      </span>
                    ) : (
                      <span className="rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-semibold text-warning">
                        Not done yet
                      </span>
                    )}
                  </span>
                </button>
              ),
            };
          })}
        />

        {canFinish && (
          <form action={finishWorkflowFields} className="mt-4 flex flex-col items-center gap-2">
            <FinishButton disabled={notDone > 0 || allNeeds > 0 || allPicked.length === 0} />
            <span className={`text-xs ${allNeeds > 0 ? "text-danger" : "text-ink-faint"}`}>
              {notDone > 0
                ? `Go through ${notDone === docs.length && notDone > 1 ? "each of your documents" : notDone === 1 ? "1 more document" : `${notDone} more documents`} to finish.`
                : allNeeds > 0
                  ? `${allNeeds} field${allNeeds === 1 ? " still needs" : "s still need"} an answer.`
                  : allPicked.length === 0
                    ? "Pick at least one field to finish."
                    : "Every document is assigned."}
            </span>
          </form>
        )}
      </div>
    );
  }

  const page = Math.min(pages[doc.id] ?? 1, pagesIn(doc));
  const setPage = (n: number) => {
    setPages((prev) => ({ ...prev, [doc.id]: n }));
    setUrlParam("page", n);
  };
  const onPage = (f: WorkflowField) =>
    doc.blanks.some((b) => (b.id === f.id || b.group === f.id) && b.page === page);
  const pageNeeds = fieldsOf(doc.id)
    .filter(isActive)
    .filter((f) => onPage(f) && !isComplete(f)).length;
  const lastPage = page >= pagesIn(doc);

  return (
    <div className="flex flex-col gap-3">
      <div>
        <button
          type="button"
          onClick={() => open(null)}
          className="text-sm font-semibold text-accent"
        >
          &lsaquo; Back to documents
        </button>
      </div>
      {!doc.reviewed && (
        <p className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">
          Some of this document&rsquo;s fields don&rsquo;t have a field type yet, so they may be missing here.
          Finish it in Upload Your Contracts to add them.
        </p>
      )}
      <div className="rounded-xl border border-border bg-surface p-4">
        <h1 className="mb-0.5 truncate font-display text-xl font-bold text-ink">{doc.fileName}</h1>
        <DocumentBoundary>
          <WorkflowFieldPicker
            key={doc.id}
            source={doc.url}
            pageCount={doc.pageCount}
            blanks={doc.blanks}
            initialFields={fieldsOf(doc.id)}
            extraOtcFields={otcFields}
            page={page}
            onPageChange={setPage}
            customSections={sections}
            onAddSection={addSection}
            onChange={(fields) => setFieldsByDoc((prev) => ({ ...prev, [doc.id]: fields }))}
            onSave={(picked) => saveWorkflowFields(doc.id, picked)}
            onLineNumbers={(lines) => saveContractLines(doc.id, lines)}
          />
        </DocumentBoundary>
      </div>


      <div className="mt-4 flex flex-col items-center gap-2">
        <button
          type="button"
          disabled={pageNeeds > 0 || finishing}
          onClick={async () => {
            if (!lastPage) {
              setPage(page + 1);
              requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
              return;
            }
            setFinishing(true);
            const res = await markDocAssigned(editing.accountId, doc.id);
            setFinishing(false);
            if (res.ok) setDoneIds((prev) => new Set(prev).add(doc.id));
            open(null);
          }}
          className="rounded-lg bg-accent px-8 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {finishing ? "Saving…" : "I’m Done With This Page"}
        </button>
        <span className={`text-xs ${pageNeeds > 0 ? "text-danger" : "text-ink-faint"}`}>
          {pageNeeds > 0
            ? `${pageNeeds} field${pageNeeds === 1 ? " on this page still needs" : "s on this page still need"} an answer. They’re outlined in red.`
            : lastPage
              ? "Last page of this document. Next, you’ll go back to your documents."
              : `Next up: page ${page + 1}.`}
        </span>
      </div>
    </div>
  );
}

function FinishButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="rounded-lg bg-accent px-8 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
    >
      {pending ? "Saving…" : "I’m Done Assigning"}
    </button>
  );
}
