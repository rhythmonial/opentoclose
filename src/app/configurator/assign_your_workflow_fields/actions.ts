"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ContractBlank } from "@/lib/contractBlanks";

const STEP_KEY = "assign_your_workflow_fields";
const PAGE = `/configurator/${STEP_KEY}`;

// Saves which of a document's fields the client wants their workflow to
// track. Only ids of fields that still exist on the document are kept.
export async function saveWorkflowFields(
  documentId: string,
  fieldIds: string[],
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();

  const { data: doc } = await supabase
    .from("contract_documents")
    .select("blanks")
    .eq("id", documentId)
    .single();
  if (!doc) return { ok: false, error: "Document not found." };

  const existing = new Set(
    (doc.blanks as ContractBlank[]).map((b) => b.id).filter(Boolean),
  );
  const kept = [...new Set(fieldIds)].filter((id) => existing.has(id));

  const { error } = await supabase
    .from("contract_documents")
    .update({
      workflow_field_ids: kept,
      workflow_fields_updated_at: new Date().toISOString(),
    })
    .eq("id", documentId);
  if (error) return { ok: false, error: error.message };

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
