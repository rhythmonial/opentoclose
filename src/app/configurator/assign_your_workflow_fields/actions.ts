"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ContractBlank } from "@/lib/contractBlanks";
import { withWorkflowTypes } from "@/lib/fieldTypes";
import {
  choiceGroupOf,
  cleanWorkflowFields,
  isActive,
  isComplete,
  withChoiceOf,
  workflowKeys,
  type WorkflowField,
} from "@/lib/workflowFields";
import { progressOwnerId } from "@/lib/accountOwner";

const STEP_KEY = "assign_your_workflow_fields";
const PAGE = `/configurator/${STEP_KEY}`;

// Saves the fields the client picked for their workflow on a document,
// with each one's type. Only fields that still exist on it are kept.
export async function saveWorkflowFields(
  documentId: string,
  fields: WorkflowField[],
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();

  const { data: doc } = await supabase
    .from("contract_documents")
    .select("blanks, workflow_fields, client_account_id")
    .eq("id", documentId)
    .single();
  if (!doc) return { ok: false, error: "Document not found." };

  const keys = workflowKeys(doc.blanks as ContractBlank[]);
  const kept = cleanWorkflowFields(fields, keys);
  const before = cleanWorkflowFields(doc.workflow_fields, keys);

  const { error } = await supabase
    .from("contract_documents")
    .update({
      // A type changed here shows on the boxes in Upload Your Contracts.
      blanks: withWorkflowTypes(doc.blanks as ContractBlank[], kept),
      workflow_fields: kept,
      workflow_field_ids: kept.filter(isActive).map((f) => f.id),
      workflow_fields_updated_at: new Date().toISOString(),
    })
    .eq("id", documentId);
  if (error) return { ok: false, error: error.message };

  await shareChoiceFields(supabase, doc.client_account_id, documentId, before, kept);

  revalidatePath(PAGE);
  return { ok: true };
}

// Options whose choice field was just picked on one contract: the same
// choice field goes to the options on the account's other contracts that
// shared their old choice field (or its name), and to ones already tied to
// the new choice field that hadn't been confirmed yet.
async function shareChoiceFields(
  supabase: Awaited<ReturnType<typeof createClient>>,
  accountId: string,
  documentId: string,
  before: WorkflowField[],
  after: WorkflowField[],
) {
  const byOldGroup = new Map<string, WorkflowField>();
  const byNewGroup = new Map<string, WorkflowField>();
  for (const f of after) {
    if (!isActive(f) || f.choice_role !== "option" || !f.question_confirmed) continue;
    const was = before.find((b) => b.id === f.id);
    if (was && was.question_id === f.question_id && was.question_confirmed) continue;
    const oldGroup = was ? choiceGroupOf(was) : null;
    const newGroup = choiceGroupOf(f);
    if (oldGroup) byOldGroup.set(oldGroup, f);
    if (newGroup) byNewGroup.set(newGroup, f);
  }
  if (byOldGroup.size === 0 && byNewGroup.size === 0) return;

  const { data: others } = await supabase
    .from("contract_documents")
    .select("id, blanks, workflow_fields")
    .eq("client_account_id", accountId)
    .neq("id", documentId);
  for (const other of others ?? []) {
    const blanks = other.blanks as ContractBlank[];
    const fields = cleanWorkflowFields(other.workflow_fields, workflowKeys(blanks));
    let changed = false;
    const next = fields.map((f) => {
      if (!isActive(f) || f.choice_role !== "option") return f;
      const group = choiceGroupOf(f);
      if (!group) return f;
      const source =
        byOldGroup.get(group) ?? (!f.question_confirmed ? byNewGroup.get(group) : undefined);
      if (!source || (f.question_id === source.question_id && f.question_confirmed)) return f;
      changed = true;
      return withChoiceOf(f, source);
    });
    if (!changed) continue;
    await supabase
      .from("contract_documents")
      .update({
        blanks: withWorkflowTypes(blanks, next),
        workflow_fields: next,
        workflow_field_ids: next.filter(isActive).map((f) => f.id),
        workflow_fields_updated_at: new Date().toISOString(),
      })
      .eq("id", other.id);
  }
}

// Records the contract's line number for each of a document's boxes, read
// from the PDF in the browser (for documents uploaded before line numbers
// were read, or with boxes drawn in by the client).
export async function saveContractLines(
  documentId: string,
  lines: Record<string, number | null>,
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("contract_documents")
    .select("blanks")
    .eq("id", documentId)
    .single();
  if (!doc) return { ok: false };

  const valid = (n: unknown) =>
    typeof n === "number" && Number.isInteger(n) && n > 0 && n < 100000 ? n : null;
  const blanks = (doc.blanks as ContractBlank[]).map((b) =>
    b.id && Object.hasOwn(lines, b.id) ? { ...b, line: valid(lines[b.id]) } : b,
  );

  const { error } = await supabase
    .from("contract_documents")
    .update({ blanks })
    .eq("id", documentId);
  if (error) return { ok: false };
  revalidatePath(PAGE);
  return { ok: true };
}

// Marks the lesson complete once the client has picked their fields.
export async function finishWorkflowFields() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("client_account_id")
    .eq("id", user.id)
    .single();
  const { data: account } = profile?.client_account_id
    ? await supabase
        .from("client_accounts")
        .select("setup_path")
        .eq("id", profile.client_account_id)
        .single()
    : { data: null };

  // Every picked field needs its type (and follow-up) answered first.
  const { data: docs } = await supabase.from("contract_documents").select("workflow_fields");
  const picked = (docs ?? [])
    .flatMap((d) => (Array.isArray(d.workflow_fields) ? (d.workflow_fields as WorkflowField[]) : []))
    .filter(isActive);
  if (picked.length === 0 || picked.some((f) => !isComplete(f))) redirect(PAGE);

  const { data: step } = await supabase
    .from("setup_steps")
    .select("id")
    .eq("path", account?.setup_path ?? "custom")
    .eq("key", STEP_KEY)
    .maybeSingle();

  if (step) {
    // Progress is shared by the whole account, kept under the owner.
    await supabase.from("client_step_status").upsert(
      {
        client_id: await progressOwnerId(supabase, user.id),
        step_id: step.id,
        status: "approved",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "client_id,step_id" },
    );
  }

  redirect("/portal");
}
