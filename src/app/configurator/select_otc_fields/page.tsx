import { redirect } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { createClient } from "@/lib/supabase/server";
import { getSandboxTier } from "@/lib/devSandbox";
import {
  cleanFieldNames,
  cleanGroupsDone,
  cleanOtcSelection,
  isContactRole,
  OTC_FIELDS,
  SELECTABLE_GROUPS,
} from "@/lib/otcFields";
import { fieldLabel, type ContractBlank } from "@/lib/contractBlanks";
import { isActive, newOtcFieldsFrom, otcTargetOf, type WorkflowField } from "@/lib/workflowFields";
import { inContractOrder } from "@/components/WorkflowFieldsSummary";
import { OtcFieldSelector, type ContractFieldOption } from "@/components/OtcFieldSelector";
import { finishSelectOtcFields } from "./actions";

const STEP_KEY = "select_otc_fields";

export default async function SelectOtcFieldsPage({
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

  // Staff pick a client to see or help with theirs.
  const { data: clients } = isStaff
    ? await supabase.from("client_accounts").select("id, name").order("name")
    : { data: [] };
  const accountId = isStaff
    ? (clients ?? []).some((c) => c.id === client)
      ? client!
      : null
    : (profile?.client_account_id ?? null);

  const [{ data: saved }, { data: docs }] = accountId
    ? await Promise.all([
        supabase
          .from("client_otc_field_selections")
          .select("fields, field_names, groups_done")
          .eq("client_account_id", accountId)
          .maybeSingle(),
        supabase
          .from("contract_documents")
          .select("id, file_name, blanks, workflow_fields")
          .eq("client_account_id", accountId)
          .eq("is_scanned", false)
          .order("created_at"),
      ])
    : [{ data: null }, { data: [] }];
  const selected = cleanOtcSelection(saved?.fields ?? []);

  // The fields assigned in Assign Your Workflow Fields: each OTC field and
  // where it's on the contracts (in contract order), plus fields the client
  // added there.
  const summaryDocs = (docs ?? []).map((d) => ({
    id: d.id,
    name: d.file_name.replace(/\.pdf$/i, ""),
    blanks: (Array.isArray(d.blanks) ? d.blanks : []) as ContractBlank[],
    fields: Array.isArray(d.workflow_fields) ? (d.workflow_fields as WorkflowField[]) : [],
  }));
  const assigned: Record<string, string[]> = {};
  for (const doc of summaryDocs) {
    for (const { field, first } of inContractOrder(doc)) {
      const target = otcTargetOf(field);
      if (!target) continue;
      const where = `${summaryDocs.length > 1 ? `${doc.name}, ` : ""}${
        first.line ? `line ${first.line}` : `page ${first.page}`
      }: ${fieldLabel(first)}`;
      (assigned[target] ??= []).push(where);
    }
  }
  const newFields = newOtcFieldsFrom(
    summaryDocs.flatMap((d) => d.fields).filter(isActive),
  ).filter((f) => !isContactRole(f) && assigned[f.id]);
  const names = cleanFieldNames(
    saved?.field_names,
    new Map([...OTC_FIELDS, ...newFields].map((f) => [f.id, f.name] as const)),
  );

  // Contract fields not assigned to an OTC field yet, in contract order:
  // ones picked in Assign Your Workflow Fields without an OTC field, then
  // the other blanks (not checkboxes) on the contracts.
  const picked: ContractFieldOption[] = [];
  const others: ContractFieldOption[] = [];
  for (const doc of summaryDocs) {
    const byKey = new Map(doc.fields.map((f) => [f.id, f] as const));
    const seen = new Set<string>();
    const boxes = doc.blanks
      .filter((b) => b.id)
      .sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x);
    for (const b of boxes) {
      const key = b.group ?? b.id!;
      if (seen.has(key)) continue;
      seen.add(key);
      const field = byKey.get(key);
      const active = field && isActive(field);
      if (active && otcTargetOf(field)) continue;
      const option = Boolean(active && field.type === "choice" && field.choice_role === "option");
      if (!active && b.type === "checkbox") continue;
      (active ? picked : others).push({
        documentId: doc.id,
        key,
        label: `${summaryDocs.length > 1 ? `${doc.name}, ` : ""}${
          b.line ? `Line ${b.line}` : `Page ${b.page}`
        }: ${fieldLabel(b)}`,
        picked: Boolean(active),
        option,
      });
    }
  }
  const contractFields = [...picked, ...others];
  const groupsDone = cleanGroupsDone(saved?.groups_done);
  const allDone = groupsDone.length === SELECTABLE_GROUPS.length;

  return (
    <main className="flex flex-1 justify-center bg-bg px-4 py-12">
      <div className="w-full max-w-5xl">
        <Link
          href={
            isStaff && !sandboxTier
              ? accountId
                ? `/dashboard/clients/${accountId}`
                : "/dashboard/tasks"
              : "/portal"
          }
          className="text-sm font-medium text-accent"
        >
          &larr;{" "}
          {isStaff && !sandboxTier
            ? accountId
              ? `Back to ${(clients ?? []).find((c) => c.id === accountId)?.name ?? "client"}`
              : "Back to editor"
            : "Back to your setup"}
        </Link>

        {isStaff && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-accent-soft bg-accent-soft/40 px-4 py-2.5 text-sm text-accent">
            <span className="font-semibold">
              Test mode &mdash; clients check their own fields here. Changes you make are saved
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
              <button
                type="submit"
                className="rounded-md bg-accent px-3 py-1 text-xs font-semibold text-white"
              >
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
            Here are all of Open to Close&rsquo;s fields, laid out like OTC&rsquo;s Field
            Editor. The ones you assigned in Assign Your Workflow Fields are already checked.
            If a field is on your contract but wasn&rsquo;t assigned, pick it from the
            field&rsquo;s &ldquo;Assign field&rdquo; menu. Check any other field
            your team needs, even if it isn&rsquo;t on your contracts; those are listed as
            fields needed. If you&rsquo;d like a field displayed under another name, type it
            in. A <span className="font-bold text-danger">*</span> marks a field Open to Close
            requires. Check off each group when you&rsquo;re done with it.
          </p>
        )}

        <div className="mt-6">
          {accountId ? (
            <OtcFieldSelector
              key={accountId}
              accountId={isStaff ? accountId : null}
              initial={{ fields: selected, names, groupsDone }}
              contractFields={contractFields}
              assigned={assigned}
              newFields={newFields}
            />
          ) : (
            <p className="rounded-xl border border-border bg-surface p-6 text-sm text-ink-soft">
              {isStaff
                ? "Choose a client above to see their fields."
                : "Your account isn't set up yet."}
            </p>
          )}
        </div>

        {!isStaff && accountId && (
          <form action={finishSelectOtcFields} className="mt-8 flex flex-col items-center gap-2">
            <button
              type="submit"
              disabled={!allDone}
              className="rounded-lg bg-accent px-8 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              I&rsquo;m Done Selecting Fields
            </button>
            {!allDone && (
              <span className="text-xs text-ink-faint">
                Check off each field group when you&rsquo;ve gone through it (
                {groupsDone.length} of {SELECTABLE_GROUPS.length} done).
              </span>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
