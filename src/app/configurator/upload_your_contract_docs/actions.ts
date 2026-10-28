"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ContractBlank } from "@/lib/contractBlanks";

const STEP_KEY = "upload_your_contract_docs";
const PAGE = `/configurator/${STEP_KEY}`;

export type SaveResult = { ok: true } | { ok: false; error: string };

// Records a PDF the browser has already uploaded to storage, with the blanks
// it found in it.
export async function saveContractDocument(input: {
  storagePath: string;
  fileName: string;
  fileSize: number;
  pageCount: number;
  blanks: ContractBlank[];
  isScanned: boolean;
}): Promise<SaveResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in again." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("client_account_id")
    .eq("id", user.id)
    .single();
  const accountId = profile?.client_account_id;
  if (!accountId || !input.storagePath.startsWith(`${accountId}/`)) {
    return { ok: false, error: "This upload doesn't belong to your account." };
  }

  const { error } = await supabase.from("contract_documents").insert({
    client_account_id: accountId,
    uploaded_by: user.id,
    storage_path: input.storagePath,
    file_name: input.fileName.slice(0, 200),
    file_size: input.fileSize,
    page_count: input.pageCount,
    blanks: input.blanks,
    blank_count: input.blanks.length,
    is_scanned: input.isScanned,
  });
  if (error) {
    // Don't leave an orphaned file behind.
    await supabase.storage.from("contract-docs").remove([input.storagePath]);
    return { ok: false, error: error.message };
  }

  revalidatePath(PAGE);
  return { ok: true };
}

export async function deleteContractDocument(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");

  const { data: doc } = await supabase
    .from("contract_documents")
    .select("storage_path")
    .eq("id", id)
    .single();
  if (doc) {
    await supabase.storage.from("contract-docs").remove([doc.storage_path]);
    await supabase.from("contract_documents").delete().eq("id", id);
  }

  revalidatePath(PAGE);
}

// Marks the lesson complete once the client is done uploading.
export async function finishContractDocs() {
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

const KINDS = new Set(["field", "underscore", "line", "checkbox", "box", "manual"]);
const clamp = (n: unknown) => Math.min(1, Math.max(0, Number(n) || 0));

// Saves a client's review of one document: the boxes after their edits and
// which pages they've confirmed. Once every page is confirmed the document
// counts as reviewed.
export async function saveContractReview(input: {
  id: string;
  blanks: ContractBlank[];
  confirmedPages: number[];
}): Promise<SaveResult> {
  const supabase = await createClient();

  const { data: doc } = await supabase
    .from("contract_documents")
    .select("page_count")
    .eq("id", input.id)
    .single();
  if (!doc) return { ok: false, error: "Document not found." };
  const pages = doc.page_count ?? 0;

  const blanks: ContractBlank[] = input.blanks
    .slice(0, 3000)
    .filter((b) => KINDS.has(b.kind) && b.page >= 1 && b.page <= pages)
    .map((b) => ({
      page: Math.trunc(b.page),
      kind: b.kind,
      type: b.type === "checkbox" ? ("checkbox" as const) : ("text" as const),
      x: clamp(b.x),
      y: clamp(b.y),
      width: clamp(b.width),
      height: clamp(b.height),
      label: String(b.label ?? "").slice(0, 120),
      after: String(b.after ?? "").slice(0, 120),
      ...(b.fieldName ? { fieldName: String(b.fieldName).slice(0, 120) } : {}),
    }));
  const confirmed = [...new Set(input.confirmedPages.map(Math.trunc))]
    .filter((n) => n >= 1 && n <= pages)
    .sort((a, b) => a - b);

  const { error } = await supabase
    .from("contract_documents")
    .update({
      blanks,
      blank_count: blanks.length,
      confirmed_pages: confirmed,
      reviewed_at: pages > 0 && confirmed.length === pages ? new Date().toISOString() : null,
    })
    .eq("id", input.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(PAGE);
  return { ok: true };
}
