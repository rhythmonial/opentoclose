"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { approveStep, configuratorAccount } from "@/lib/configuratorAccount";
import { suggestMapping } from "@/lib/otcContactFields";
import { UPLOAD_LESSONS, type UploadKind } from "@/lib/uploadLessons";

const UUID = /^[0-9a-f-]{36}$/i;
type Result = { ok: boolean; error?: string; id?: string };

const isKind = (k: string): k is UploadKind => k in UPLOAD_LESSONS;

// Records a file the browser uploaded in Upload Your Contacts / Messages /
// Tasks. Contacts go with the contact lists (matched in Prep Your
// Contacts); messages and tasks are kept for Prep Your Messages / Tasks.
export async function recordUpload(
  kind: string,
  accountId: string | null,
  file: { fileName: string; storagePath: string; columns: string[]; rowCount: number },
): Promise<Result> {
  if (!isKind(kind)) return { ok: false, error: "Unknown upload." };
  const { supabase, user, accountId: account } = await configuratorAccount(accountId);
  if (!user || !account) return { ok: false, error: "Not signed in." };
  if (!file.storagePath.startsWith(`${account}/`)) return { ok: false, error: "Wrong folder." };
  const columns = file.columns.slice(0, 200).map((c) => String(c).slice(0, 200));
  const base = {
    client_account_id: account,
    file_name: file.fileName.slice(0, 200),
    storage_path: file.storagePath,
    columns,
    row_count: Math.max(0, Math.trunc(file.rowCount) || 0),
    uploaded_by: user.id,
  };
  const { data, error } =
    kind === "contacts"
      ? await supabase
          .from("contact_imports")
          .insert({ ...base, mapping: suggestMapping(columns) })
          .select("id")
          .single()
      : await supabase
          .from("prep_file_uploads")
          .insert({ ...base, kind })
          .select("id")
          .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath(UPLOAD_LESSONS[kind].page);
  return { ok: true, id: data.id };
}

// Deletes an uploaded file.
export async function removeUpload(kind: string, accountId: string | null, id: string): Promise<Result> {
  if (!isKind(kind) || !UUID.test(id)) return { ok: false };
  const { supabase, accountId: account } = await configuratorAccount(accountId);
  if (!account) return { ok: false };
  const table = kind === "contacts" ? "contact_imports" : "prep_file_uploads";
  const { data: row } = await supabase
    .from(table)
    .select("storage_path")
    .eq("id", id)
    .eq("client_account_id", account)
    .single();
  if (!row) return { ok: false };
  await supabase.storage.from("contact-files").remove([row.storage_path]);
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(UPLOAD_LESSONS[kind].page);
  return { ok: true };
}

// Finishes the lesson once there's at least one file.
export async function finishUpload(formData: FormData) {
  const kind = String(formData.get("kind") ?? "");
  if (!isKind(kind)) redirect("/portal");
  const { supabase, user, accountId } = await configuratorAccount(null);
  if (!user) redirect("/login");
  if (!accountId) redirect("/portal");
  const { count } =
    kind === "contacts"
      ? await supabase
          .from("contact_imports")
          .select("id", { count: "exact", head: true })
          .eq("client_account_id", accountId)
      : await supabase
          .from("prep_file_uploads")
          .select("id", { count: "exact", head: true })
          .eq("client_account_id", accountId)
          .eq("kind", kind);
  if (!count) redirect(UPLOAD_LESSONS[kind].page);
  await approveStep(supabase, user.id, accountId, UPLOAD_LESSONS[kind].stepKey);
  redirect("/portal");
}
