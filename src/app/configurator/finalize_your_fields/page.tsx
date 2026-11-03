import { redirect } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { createClient } from "@/lib/supabase/server";
import { getSandboxTier } from "@/lib/devSandbox";
import type { ContractBlank } from "@/lib/contractBlanks";
import { FinalizeFields } from "@/components/FinalizeFields";
import { isActive, isComplete, type WorkflowField } from "@/lib/workflowFields";
import { finishFinalizingFields } from "./actions";

const STEP_KEY = "finalize_your_fields";

export default async function FinalizeYourFieldsPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: step }] = await Promise.all([
    supabase.from("profiles").select("role, client_account_id").eq("id", user.id).single(),
    supabase
      .from("setup_steps")
      .select("title, description")
      .eq("key", STEP_KEY)
      .limit(1)
      .maybeSingle(),
  ]);

  const isStaff = profile?.role === "dev" || profile?.role === "dev_admin";
  const sandboxTier = isStaff ? await getSandboxTier() : null;
  const { client } = await searchParams;

  // Staff pick a client (one with contracts) to see or help with theirs.
  const { data: clients } = isStaff
    ? await supabase
        .from("client_accounts")
        .select("id, name, contract_documents!inner(id)")
        .order("name")
    : { data: [] };
  const accountId = isStaff
    ? (clients ?? []).some((c) => c.id === client)
      ? client!
      : null
    : (profile?.client_account_id ?? null);

  const { data: docs } = accountId
    ? await supabase
        .from("contract_documents")
        .select("id, file_name, blanks, workflow_fields")
        .eq("client_account_id", accountId)
        .eq("is_scanned", false)
        .order("created_at")
    : { data: [] };

  const summaryDocs = (docs ?? []).map((d) => ({
    id: d.id,
    name: d.file_name,
    blanks: d.blanks as ContractBlank[],
    fields: Array.isArray(d.workflow_fields) ? (d.workflow_fields as WorkflowField[]) : [],
  }));
  const fields = summaryDocs.flatMap((d) => d.fields).filter(isActive);
  const ready = fields.length > 0 && fields.every(isComplete);

  return (
    <main className="flex flex-1 justify-center bg-bg px-4 py-12">
      <div className="w-full max-w-6xl">
        <Link
          href={isStaff && !sandboxTier ? "/dashboard/tasks" : "/portal"}
          className="text-sm font-medium text-accent"
        >
          &larr; {isStaff && !sandboxTier ? "Back to editor" : "Back to your setup"}
        </Link>

        {isStaff && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-accent-soft bg-accent-soft/40 px-4 py-2.5 text-sm text-accent">
            <span className="font-semibold">
              Test mode &mdash; clients see their own fields here. Changes you make are saved
              to the client you pick.
            </span>
            <form className="flex items-center gap-2">
              <select
                name="client"
                defaultValue={accountId ?? ""}
                className="rounded-md border border-border bg-surface px-2 py-1 text-sm text-ink"
              >
                <option value="">Choose a client&hellip;</option>
                {(clients ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button type="submit" className="rounded-md bg-accent px-3 py-1 text-xs font-semibold text-white">
                Show
              </button>
            </form>
          </div>
        )}

        <h1 className="mt-3 font-display text-2xl font-bold text-ink">
          {step?.title ?? "Finalize Your Fields"}
        </h1>
        {step?.description ? (
          <div
            className="mt-1.5 max-w-3xl text-sm leading-relaxed text-ink-soft
              [&_p]:mt-2 [&_strong]:font-bold [&_strong]:text-ink [&_em]:italic
              [&_a]:font-semibold [&_a]:text-accent [&_a]:underline
              [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mt-2 [&_ol]:list-decimal [&_ol]:pl-5
              [&_li]:mt-1 first:[&>*]:mt-0"
          >
            <ReactMarkdown>{step.description}</ReactMarkdown>
          </div>
        ) : (
          <p className="mt-1.5 max-w-3xl text-sm text-ink-soft">
            Here&rsquo;s every field you assigned, grouped by the Open to Close field it fills.
            Contracts often name the same thing differently (a &ldquo;Contract Date&rdquo; may
            be your &ldquo;Effective Date&rdquo;), so check for fields that should be one, and
            reassign them. Reassigning a whole group merges it into the field you pick.
          </p>
        )}

        <div className="mt-6">
          {isStaff && !accountId ? (
            <p className="rounded-xl border border-border bg-surface p-6 text-sm text-ink-soft">
              Choose a client above to see their fields.
            </p>
          ) : (
            <FinalizeFields accountId={isStaff ? accountId : null} docs={summaryDocs} />
          )}
        </div>

        {!isStaff && fields.length > 0 && (
          <form action={finishFinalizingFields} className="mt-8 flex flex-col items-center gap-2">
            <button
              type="submit"
              disabled={!ready}
              className="rounded-lg bg-accent px-8 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              My Fields Are Final
            </button>
            {!ready && (
              <span className="text-xs text-danger">
                Every field needs an Open to Close field (and every choice option a title) first.
              </span>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
