import { redirect } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { createClient } from "@/lib/supabase/server";
import { requireStepAccess } from "@/lib/stepAccess";
import { getSandboxTier } from "@/lib/devSandbox";
import type { ContractBlank } from "@/lib/contractBlanks";
import { AssignWorkflowWorkspace } from "@/components/AssignWorkflowWorkspace";
import { inAssignOrder } from "@/lib/docOrder";
import { newOtcFieldsFrom, type WorkflowField } from "@/lib/workflowFields";
import { WorkflowFieldsTester } from "@/components/WorkflowFieldsTester";
import { cleanFieldNames, OTC_FIELDS } from "@/lib/otcFields";

const STEP_KEY = "assign_your_workflow_fields";

export default async function AssignWorkflowFieldsPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; doc?: string }>;
}) {
  await requireStepAccess(STEP_KEY);
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
  // Staff open a client's work from that client's page (?client=<account>).
  const { client, doc: openDoc } = await searchParams;
  const { data: staffClient } =
    isStaff && client && /^[0-9a-f-]{36}$/i.test(client)
      ? await supabase.from("client_accounts").select("id, name").eq("id", client).maybeSingle()
      : { data: null };
  const accountId = isStaff ? (staffClient?.id ?? null) : (profile?.client_account_id ?? null);
  // Staff with no client picked get the test mode.
  const testMode = isStaff && !staffClient;

  // Scans have no fields to pick from.
  const { data: unordered } = accountId
    ? await supabase
        .from("contract_documents")
        .select("*")
        .eq("client_account_id", accountId)
        .eq("is_scanned", false)
        .order("created_at")
    : { data: [] };
  // In their own order here (which starts from their upload order).
  const docs = unordered ? inAssignOrder(unordered) : unordered;

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
  // Fields the client created, on any contract (removed fields included, so
  // a created choice field stays available after its option is removed).
  const addedOtcFields = newOtcFieldsFrom((docs ?? []).flatMap(fieldsOf));
  // What they'd like fields called (shared with Finalize Your Fields).
  const { data: selection } = accountId
    ? await supabase
        .from("client_otc_field_selections")
        .select("field_names")
        .eq("client_account_id", accountId)
        .maybeSingle()
    : { data: null };
  const fieldNames = cleanFieldNames(
    selection?.field_names,
    new Map([...OTC_FIELDS, ...addedOtcFields].map((f) => [f.id, f.name] as const)),
  );

  return (
    <main className="flex flex-1 justify-center bg-bg px-4 py-12">
      <div className="w-full max-w-4xl">
        <Link
          href={
            staffClient
              ? `/dashboard/clients/${staffClient.id}`
              : isStaff && !sandboxTier
                ? "/dashboard/tasks"
                : "/portal"
          }
          className="text-sm font-medium text-accent"
        >
          &larr;{" "}
          {staffClient
            ? `Back to ${staffClient.name}`
            : isStaff && !sandboxTier
              ? "Back to editor"
              : "Back to your setup"}
        </Link>

        {testMode && (
          <div className="mt-4 rounded-lg border border-accent-soft bg-accent-soft/40 px-4 py-2.5 text-sm font-semibold text-accent">
            Test mode &mdash; clients see the contracts they uploaded here. Try
            it with any PDF below; nothing is uploaded or saved.
          </div>
        )}
        {staffClient && (
          <div className="mt-4 rounded-lg border border-accent-soft bg-accent-soft/40 px-4 py-2.5 text-sm font-semibold text-accent">
            Viewing {staffClient.name}&rsquo;s workflow fields &mdash; changes you make are
            saved to their account.
          </div>
        )}

        <h1 className="mt-3 font-display text-2xl font-bold text-ink">
          {step?.title ?? "Assign Your Fields"}
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
          {testMode ? (
            <WorkflowFieldsTester />
          ) : staffClient && (!docs || docs.length === 0) ? (
            <div className="rounded-xl border border-border bg-surface p-6 text-sm text-ink-soft">
              {staffClient.name} hasn&rsquo;t uploaded any contracts yet.
            </div>
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
            <AssignWorkflowWorkspace
              docs={docs.flatMap((doc) => {
                const url = urlByPath.get(doc.storage_path);
                return url
                  ? [
                      {
                        id: doc.id,
                        fileName: doc.file_name,
                        url,
                        pageCount: doc.page_count ?? 0,
                        blanks: doc.blanks as ContractBlank[],
                        fields: fieldsOf(doc),
                        reviewed: Boolean(doc.reviewed_at),
                        done: Boolean(doc.assign_done_at),
                      },
                    ]
                  : [];
              })}
              otcFields={addedOtcFields}
              editing={{ accountId: staffClient?.id ?? null, names: fieldNames }}
              canFinish={!isStaff}
              initialDocId={openDoc ?? null}
            />
          )}
        </div>
      </div>
    </main>
  );
}
