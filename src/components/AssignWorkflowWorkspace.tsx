"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import type { ContractBlank } from "@/lib/contractBlanks";
import type { OtcField } from "@/lib/otcFields";
import { isActive, isComplete, type WorkflowField } from "@/lib/workflowFields";
import { WorkflowDocCard } from "@/components/WorkflowDocCard";
import { WorkflowFieldsSummary } from "@/components/WorkflowFieldsSummary";
import { finishWorkflowFields } from "@/app/configurator/assign_your_workflow_fields/actions";

export type WorkspaceDoc = {
  id: string;
  fileName: string;
  url: string;
  pageCount: number;
  blanks: ContractBlank[];
  fields: WorkflowField[];
  reviewed: boolean;
};

// The contracts in Assign Your Workflow Fields, worked through a page at a
// time: the summary below lists the fields on the page being worked on, and
// "I'm Done With This Page" goes on to the next page (then the next
// contract, and on the last page, finishes the lesson).
export function AssignWorkflowWorkspace({
  docs,
  otcFields,
  editing,
  canFinish,
}: {
  docs: WorkspaceDoc[];
  otcFields: OtcField[];
  editing: { accountId: string | null; names: Record<string, string> };
  // Clients finish the lesson; staff only look through the pages.
  canFinish: boolean;
}) {
  const [fieldsByDoc, setFieldsByDoc] = useState<Record<string, WorkflowField[]>>(() =>
    Object.fromEntries(docs.map((d) => [d.id, d.fields])),
  );
  const [pages, setPages] = useState<Record<string, number>>({});
  const [openDocs, setOpenDocs] = useState<Set<string>>(
    () => new Set(docs[0] ? [docs[0].id] : []),
  );
  const [activeId, setActiveId] = useState(docs[0]?.id ?? "");

  const activeIndex = Math.max(
    0,
    docs.findIndex((d) => d.id === activeId),
  );
  const active = docs[activeIndex];
  const pagesIn = (d: WorkspaceDoc) => Math.max(1, d.pageCount);
  const pageOf = (id: string) => pages[id] ?? 1;
  const fieldsOf = (id: string) => fieldsByDoc[id] ?? [];

  const setOpen = (id: string, open: boolean) => {
    setOpenDocs((prev) => {
      const next = new Set(prev);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });
  };
  const goTo = (id: string, page: number) => {
    setActiveId(id);
    setPages((prev) => ({ ...prev, [id]: page }));
    setOpen(id, true);
    requestAnimationFrame(() =>
      document
        .getElementById(`contract-${id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  };

  if (!active) return null;
  const page = pageOf(active.id);
  const onPage = (d: WorkspaceDoc, n: number, f: WorkflowField) =>
    d.blanks.some((b) => (b.id === f.id || b.group === f.id) && b.page === n);
  const pageNeeds = fieldsOf(active.id)
    .filter(isActive)
    .filter((f) => onPage(active, page, f) && !isComplete(f)).length;
  const isLast = activeIndex === docs.length - 1 && page >= pagesIn(active);
  const allPicked = docs.flatMap((d) => fieldsOf(d.id)).filter(isActive);
  const allNeeds = allPicked.filter((f) => !isComplete(f)).length;

  return (
    <div className="flex flex-col gap-3">
      {docs.map((doc) => (
        <WorkflowDocCard
          key={doc.id}
          id={doc.id}
          fileName={doc.fileName}
          url={doc.url}
          pageCount={doc.pageCount}
          blanks={doc.blanks}
          fields={doc.fields}
          otcFields={otcFields}
          reviewed={doc.reviewed}
          open={openDocs.has(doc.id)}
          onToggle={(open) => {
            setOpen(doc.id, open);
            if (open) setActiveId(doc.id);
          }}
          page={pageOf(doc.id)}
          onPageChange={(n) => {
            setActiveId(doc.id);
            setPages((prev) => ({ ...prev, [doc.id]: n }));
          }}
          onFieldsChange={(fields) => {
            setActiveId(doc.id);
            setFieldsByDoc((prev) => ({ ...prev, [doc.id]: fields }));
          }}
        />
      ))}

      <div className="mt-6">
        <WorkflowFieldsSummary
          docs={docs.map((d) => ({
            id: d.id,
            name: d.fileName,
            blanks: d.blanks,
            fields: fieldsOf(d.id),
          }))}
          editing={editing}
          onlyPage={{ docId: active.id, page }}
        />
      </div>

      {!isLast ? (
        <div className="mt-4 flex flex-col items-center gap-2">
          <button
            type="button"
            disabled={pageNeeds > 0}
            onClick={() =>
              page < pagesIn(active)
                ? goTo(active.id, page + 1)
                : (setOpen(active.id, false), goTo(docs[activeIndex + 1].id, 1))
            }
            className="rounded-lg bg-accent px-8 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            I&rsquo;m Done With This Page
          </button>
          <span className={`text-xs ${pageNeeds > 0 ? "text-danger" : "text-ink-faint"}`}>
            {pageNeeds > 0
              ? `${pageNeeds} field${pageNeeds === 1 ? " on this page still needs" : "s on this page still need"} an answer. They’re outlined in red.`
              : page < pagesIn(active)
                ? `Page ${page} of ${pagesIn(active)}. Next up: page ${page + 1}.`
                : `Last page of this contract. Next up: ${docs[activeIndex + 1].fileName}.`}
          </span>
        </div>
      ) : (
        canFinish && (
          <form action={finishWorkflowFields} className="mt-4 flex flex-col items-center gap-2">
            <FinishButton disabled={allPicked.length === 0 || allNeeds > 0} />
            {allPicked.length === 0 ? (
              <span className="text-xs text-ink-faint">Pick at least one field to finish.</span>
            ) : (
              allNeeds > 0 && (
                <span className="text-xs text-danger">
                  {allNeeds} field{allNeeds === 1 ? " still needs" : "s still need"} an answer
                  {pageNeeds < allNeeds ? " on your contracts" : ""}. They&rsquo;re outlined in
                  red.
                </span>
              )
            )}
          </form>
        )
      )}
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
      {pending ? "Saving…" : "I’m Done With This Page"}
    </button>
  );
}
