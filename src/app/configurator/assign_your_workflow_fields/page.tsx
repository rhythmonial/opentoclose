import { redirect } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { createClient } from "@/lib/supabase/server";
import { getSandboxTier } from "@/lib/devSandbox";
import type { ContractBlank } from "@/lib/contractBlanks";
import { WorkflowDocCard } from "@/components/WorkflowDocCard";
import { isComplete, type WorkflowField } from "@/lib/workflowFields";
import { WorkflowFieldsTester } from "@/components/WorkflowFieldsTester";
import { finishWorkflowFields } from "./actions";

const STEP_KEY = "assign_your_workflow_fields";

export default async function AssignWorkflowFieldsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: profile }, { data: step }] = await Promise.all([
    supabase
      .from("profiles")
      .select("role, client_account_id")
      .eq("id", user.id)
      .single(),
    supabase
      .from("setup_steps")
      .select("title, description")
      .eq("key", STEP_KEY)
      .limit(1)
      .maybeSingle(),
  ]);

  const isStaff = profile?.role === "dev" || profile?.role === "dev_admin";
  const sandboxTier = isStaff ? await getSandboxTier() : null;
  const accountId = isStaff ? null : (profile?.client_account_id ?? null);

  // Scans have no fields to pick from.
  const { data: docs } = accountId
    ? await supabase
        .from("contract_documents")
        .select("*")
        .eq("client_account_id", accountId)
        .eq("is_scanned", false)
        .order("created_at")
    : { data: [] };

  const { data: signed } =
    docs && docs.length > 0
      ? await supabase.storage
          .from("contract-docs")
          .createSignedUrls(
            docs.map((d) => d.storage_path),
            60 * 60,
          )
      : { data: [] };
  const urlByPath = new Map(
    (signed ?? []).map((s) => [s.path, s.signedUrl] as const),
  );
  const fieldsOf = (d: { workflow_fields: unknown }) =>
    Array.isArray(d.workflow_fields) ? (d.workflow_fields as WorkflowField[]) : [];
  const picked = (docs ?? []).flatMap(fieldsOf);
  const pickedCount = picked.length;
  const needsAnswer = picked.filter((f) => !isComplete(f)).length;

  return (
    <main className="flex flex-1 justify-center bg-bg px-4 py-12">
      <div className="w-full max-w-4xl">
        <Link
          href={isStaff && !sandboxTier ? "/dashboard/tasks" : "/portal"}
          className="text-sm font-medium text-accent"
        >
          &larr;{" "}
          {isStaff && !sandboxTier ? "Back to editor" : "Back to your setup"}
        </Link>

        {isStaff && (
          <div className="mt-4 rounded-lg border border-accent-soft bg-accent-soft/40 px-4 py-2.5 text-sm font-semibold text-accent">
            Test mode &mdash; clients see the contracts they uploaded here. Try
            it with any PDF below; nothing is uploaded or saved.
          </div>
        )}

        <h1 className="mt-3 font-display text-2xl font-bold text-ink">
          {step?.title ?? "Assign Your Workflow Fields"}
        </h1>
        {step?.description ? (
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
            Go through each of your contracts and click every field your team
            needs to track while a transaction is in progress, like the
            closing date, purchase price, or inspection period. These become
            the workflow fields in your Open to Close setup.
          </p>
        )}

        <div className="mt-6">
          {isStaff ? (
            <WorkflowFieldsTester />
          ) : !docs || docs.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface p-6 text-sm text-ink-soft">
              You haven&rsquo;t uploaded any contracts yet. Upload them in the{" "}
              <Link
                href="/configurator/upload_your_contract_docs"
                className="font-semibold text-accent"
              >
                Upload Your Contracts
              </Link>{" "}
              lesson first, then come back here to pick your workflow fields.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {docs.map((doc, i) => {
                const url = urlByPath.get(doc.storage_path);
                if (!url) return null;
                return (
                  <WorkflowDocCard
                    key={doc.id}
                    id={doc.id}
                    fileName={doc.file_name}
                    url={url}
                    pageCount={doc.page_count ?? 0}
                    blanks={doc.blanks as ContractBlank[]}
                    fields={fieldsOf(doc)}
                    reviewed={Boolean(doc.reviewed_at)}
                    defaultOpen={i === 0}
                  />
                );
              })}

              <form
                action={finishWorkflowFields}
                className="mt-4 flex flex-col items-center gap-2"
              >
                <button
                  type="submit"
                  disabled={pickedCount === 0 || needsAnswer > 0}
                  className="rounded-lg bg-accent px-8 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  I&rsquo;m Done Picking Fields
                </button>
                {pickedCount === 0 ? (
                  <span className="text-xs text-ink-faint">
                    Pick at least one field to finish.
                  </span>
                ) : (
                  needsAnswer > 0 && (
                    <span className="text-xs text-danger">
                      {needsAnswer} field{needsAnswer === 1 ? " still needs" : "s still need"} an
                      answer. They&rsquo;re outlined in red.
                    </span>
                  )
                )}
              </form>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
