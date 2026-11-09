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
  NEW_OTC_PREFIX,
  newOtcFieldsFrom,
  otcTargetOf,
  reassignTo,
  withChoiceOf,
  workflowKeys,
  type WorkflowField,
} from "@/lib/workflowFields";
import { cleanFieldNames, OTC_FIELDS } from "@/lib/otcFields";
import { configuratorAccount } from "@/lib/configuratorAccount";
import { progressOwnerId } from "@/lib/accountOwner";
import { cleanOrder } from "@/lib/docOrder";
import { stepClientHref } from "@/lib/stepHref";

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

  // Every contract gone through, and every picked field's type (and
  // follow-up) answered first.
  const { data: docs } = await supabase
    .from("contract_documents")
    .select("workflow_fields, assign_done_at, is_scanned")
    .eq("client_account_id", profile?.client_account_id ?? "");
  if ((docs ?? []).some((d) => !d.is_scanned && !d.assign_done_at)) redirect(PAGE);
  const picked = (docs ?? [])
    .flatMap((d) => (Array.isArray(d.workflow_fields) ? (d.workflow_fields as WorkflowField[]) : []))
    .filter(isActive);
  if (picked.length === 0 || picked.some((f) => !isComplete(f))) redirect(PAGE);

  const path = account?.setup_path ?? "custom";
  const { data: step } = await supabase
    .from("setup_steps")
    .select("id, sort_order")
    .eq("path", path)
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

  // On to the next lesson.
  const { data: next } = step
    ? await supabase
        .from("setup_steps")
        .select("id, key, step_type")
        .eq("path", path)
        .gt("sort_order", step.sort_order)
        .order("sort_order")
        .limit(1)
        .maybeSingle()
    : { data: null };
  redirect(next ? stepClientHref(next) : "/portal");
}

// The account's contracts and the fields the client created on them.
async function accountContracts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  accountId: string,
) {
  const { data } = await supabase
    .from("contract_documents")
    .select("id, blanks, workflow_fields")
    .eq("client_account_id", accountId);
  const docs = (data ?? []).map((d) => {
    const blanks = (Array.isArray(d.blanks) ? d.blanks : []) as ContractBlank[];
    return { id: d.id, blanks, fields: cleanWorkflowFields(d.workflow_fields, workflowKeys(blanks)) };
  });
  return { docs, created: newOtcFieldsFrom(docs.flatMap((d) => d.fields)) };
}

// Saves what the client calls an OTC field (blank goes back to its OTC
// name). Shared with Finalize Your Fields.
export async function saveFieldName(
  accountId: string | null,
  otcId: string,
  name: string,
): Promise<{ ok: boolean; error?: string }> {
  const { supabase, accountId: account } = await configuratorAccount(accountId);
  if (!account) return { ok: false, error: "Not signed in." };
  const { created } = await accountContracts(supabase, account);
  const known = new Map([...OTC_FIELDS, ...created].map((f) => [f.id, f.name] as const));
  if (!known.has(otcId)) return { ok: false, error: "Unknown field." };
  const { data: saved } = await supabase
    .from("client_otc_field_selections")
    .select("field_names")
    .eq("client_account_id", account)
    .maybeSingle();
  const names = cleanFieldNames(saved?.field_names, known);
  const clean = name.trim().slice(0, 120);
  if (clean) names[otcId] = clean;
  else delete names[otcId];
  const { error } = await supabase.from("client_otc_field_selections").upsert(
    {
      client_account_id: account,
      field_names: cleanFieldNames(names, known),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "client_account_id" },
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath(PAGE);
  revalidatePath("/configurator/select_otc_fields");
  return { ok: true };
}

// Points a field the client created at an existing OTC field instead, on
// every contract (or, with no OTC field, leaves it as a new field).
export async function mapCreatedField(
  accountId: string | null,
  createdId: string,
  otcId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { supabase, accountId: account } = await configuratorAccount(accountId);
  if (!account) return { ok: false, error: "Not signed in." };
  const to = OTC_FIELDS.find((f) => f.id === otcId);
  if (!to || !createdId.startsWith(NEW_OTC_PREFIX)) return { ok: false, error: "Unknown field." };
  const { docs } = await accountContracts(supabase, account);
  for (const doc of docs) {
    let changed = false;
    const next = doc.fields.map((f) => {
      if (otcTargetOf(f) !== createdId) return f;
      changed = true;
      return reassignTo(f, to);
    });
    if (!changed) continue;
    const { error } = await supabase
      .from("contract_documents")
      .update({
        blanks: withWorkflowTypes(doc.blanks, next),
        workflow_fields: next,
        workflow_field_ids: next.filter(isActive).map((f) => f.id),
        workflow_fields_updated_at: new Date().toISOString(),
      })
      .eq("id", doc.id);
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath(PAGE);
  return { ok: true };
}

// Saves the client's own order of their contracts in this lesson.
export async function reorderAssignDocs(
  accountId: string | null,
  ids: string[],
): Promise<{ ok: boolean }> {
  const { supabase, accountId: account } = await configuratorAccount(accountId);
  if (!account) return { ok: false };
  const { data: docs } = await supabase
    .from("contract_documents")
    .select("id")
    .eq("client_account_id", account);
  const order = cleanOrder(ids, (docs ?? []).map((d) => d.id));
  if (!order) return { ok: false };
  for (const [i, id] of order.entries()) {
    await supabase.from("contract_documents").update({ assign_order: i }).eq("id", id);
  }
  revalidatePath(PAGE);
  return { ok: true };
}

// Marks a contract done in this lesson (they got through its last page).
export async function markDocAssigned(
  accountId: string | null,
  documentId: string,
): Promise<{ ok: boolean }> {
  const { supabase, accountId: account } = await configuratorAccount(accountId);
  if (!account) return { ok: false };
  const { error } = await supabase
    .from("contract_documents")
    .update({ assign_done_at: new Date().toISOString() })
    .eq("id", documentId)
    .eq("client_account_id", account);
  if (error) return { ok: false };
  revalidatePath(PAGE);
  return { ok: true };
}
