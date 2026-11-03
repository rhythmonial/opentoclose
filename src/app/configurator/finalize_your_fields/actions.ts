"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ContractBlank } from "@/lib/contractBlanks";
import type { OtcField } from "@/lib/otcFields";
import {
  cleanWorkflowFields,
  isActive,
  isComplete,
  otcTargetOf,
  reassignTo,
  workflowKeys,
  type WorkflowField,
} from "@/lib/workflowFields";

const STEP_KEY = "finalize_your_fields";
const PAGE = `/configurator/${STEP_KEY}`;

// The account whose fields are being finalized: a client's own, or (for
// staff helping a client) the one asked for.
async function accountFor(requested: string | null) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, accountId: null };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, client_account_id")
    .eq("id", user.id)
    .single();
  const isStaff = profile?.role === "dev" || profile?.role === "dev_admin";
  return {
    supabase,
    user,
    accountId: isStaff ? requested : (profile?.client_account_id ?? null),
  };
}

// Reassigns workflow fields to another OTC field: every field assigned to
// `from` (to merge two OTC fields that are really the same one), or just
// one field.
export async function reassignFields(input: {
  accountId: string | null;
  from?: string;
  field?: { documentId: string; fieldId: string };
  to: OtcField;
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, accountId } = await accountFor(input.accountId);
  if (!accountId) return { ok: false, error: "Not signed in." };
  if (!input.from && !input.field) return { ok: false, error: "Nothing to reassign." };

  const { data: docs } = await supabase
    .from("contract_documents")
    .select("id, blanks, workflow_fields")
    .eq("client_account_id", accountId);

  for (const doc of docs ?? []) {
    const fields = Array.isArray(doc.workflow_fields)
      ? (doc.workflow_fields as WorkflowField[])
      : [];
    let changed = false;
    const next = fields.map((f) => {
      const match = input.field
        ? doc.id === input.field.documentId && f.id === input.field.fieldId
        : isActive(f) && otcTargetOf(f) === input.from;
      if (!match) return f;
      changed = true;
      return reassignTo(f, input.to);
    });
    if (!changed) continue;

    const kept = cleanWorkflowFields(next, workflowKeys(doc.blanks as ContractBlank[]));
    const { error } = await supabase
      .from("contract_documents")
      .update({
        workflow_fields: kept,
        workflow_field_ids: kept.filter(isActive).map((f) => f.id),
        workflow_fields_updated_at: new Date().toISOString(),
      })
      .eq("id", doc.id);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath(PAGE);
  revalidatePath("/configurator/assign_your_workflow_fields");
  return { ok: true };
}

// Marks the lesson complete once every field is assigned.
export async function finishFinalizingFields() {
  const { supabase, user, accountId } = await accountFor(null);
  if (!user) redirect("/login");
  if (!accountId) redirect("/portal");

  const { data: docs } = await supabase
    .from("contract_documents")
    .select("workflow_fields")
    .eq("client_account_id", accountId);
  const fields = (docs ?? [])
    .flatMap((d) => (Array.isArray(d.workflow_fields) ? (d.workflow_fields as WorkflowField[]) : []))
    .filter(isActive);
  if (fields.length === 0 || fields.some((f) => !isComplete(f))) redirect(PAGE);

  const { data: account } = await supabase
    .from("client_accounts")
    .select("setup_path")
    .eq("id", accountId)
    .single();
  const { data: step } = await supabase
    .from("setup_steps")
    .select("id")
    .eq("path", account?.setup_path ?? "custom")
    .eq("key", STEP_KEY)
    .maybeSingle();
  if (step) {
    await supabase.from("client_step_status").upsert(
      {
        client_id: user.id,
        step_id: step.id,
        status: "approved",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "client_id,step_id" },
    );
  }
  redirect("/portal");
}
