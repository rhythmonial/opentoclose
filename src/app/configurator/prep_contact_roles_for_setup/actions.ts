"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { approveStep, configuratorAccount } from "@/lib/configuratorAccount";
import { isTarget, type ContactMapping } from "@/lib/otcContactFields";

const STEP_KEY = "prep_contact_roles_for_setup";
const PAGE = `/configurator/${STEP_KEY}`;
const UUID = /^[0-9a-f-]{36}$/i;

type Result = { ok: boolean; error?: string; id?: string };

// Keeps only matches for the file's own columns, to OTC fields, each OTC
// field used once.
function cleanMapping(columns: string[], mapping: ContactMapping): ContactMapping {
  const used = new Set<string>();
  const out: ContactMapping = {};
  for (const col of columns) {
    const v = mapping[col];
    out[col] = isTarget(v) && !used.has(v) ? v : null;
    if (out[col]) used.add(out[col]!);
  }
  return out;
}

// Records a contacts file the browser has uploaded, with its columns and
// the suggested matches.
export async function recordContactFile(
  accountId: string | null,
  file: {
    fileName: string;
    storagePath: string;
    columns: string[];
    rowCount: number;
    mapping: ContactMapping;
  },
): Promise<Result> {
  const { supabase, user, accountId: account } = await configuratorAccount(accountId);
  if (!user || !account) return { ok: false, error: "Not signed in." };
  if (!file.storagePath.startsWith(`${account}/`)) return { ok: false, error: "Wrong folder." };
  const columns = file.columns.slice(0, 200).map((c) => String(c).slice(0, 200));

  const { data, error } = await supabase
    .from("contact_imports")
    .insert({
      client_account_id: account,
      file_name: file.fileName.slice(0, 200),
      storage_path: file.storagePath,
      columns,
      row_count: Math.max(0, Math.trunc(file.rowCount) || 0),
      mapping: cleanMapping(columns, file.mapping),
      uploaded_by: user.id,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath(PAGE);
  return { ok: true, id: data.id };
}

// Saves how a file's columns match OTC's contact import fields.
export async function saveContactMapping(
  accountId: string | null,
  id: string,
  mapping: ContactMapping,
): Promise<Result> {
  const { supabase, accountId: account } = await configuratorAccount(accountId);
  if (!account || !UUID.test(id)) return { ok: false, error: "Not signed in." };
  const { data: row } = await supabase
    .from("contact_imports")
    .select("columns")
    .eq("id", id)
    .eq("client_account_id", account)
    .single();
  if (!row) return { ok: false, error: "File not found." };

  const { error } = await supabase
    .from("contact_imports")
    .update({ mapping: cleanMapping(row.columns, mapping), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(PAGE);
  return { ok: true };
}

// Deletes an uploaded contacts file and its matches.
export async function removeContactFile(accountId: string | null, id: string): Promise<Result> {
  const { supabase, accountId: account } = await configuratorAccount(accountId);
  if (!account || !UUID.test(id)) return { ok: false };
  const { data: row } = await supabase
    .from("contact_imports")
    .select("storage_path")
    .eq("id", id)
    .eq("client_account_id", account)
    .single();
  if (!row) return { ok: false };
  await supabase.storage.from("contact-files").remove([row.storage_path]);
  const { error } = await supabase.from("contact_imports").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(PAGE);
  return { ok: true };
}

// Marks the lesson complete once there's a file and every file has its
// names matched.
export async function finishContacts() {
  const { supabase, user, accountId } = await configuratorAccount(null);
  if (!user) redirect("/login");
  if (!accountId) redirect("/portal");

  const { data: files } = await supabase
    .from("contact_imports")
    .select("mapping")
    .eq("client_account_id", accountId);
  const named = (m: unknown) => {
    const targets = Object.values((m ?? {}) as ContactMapping);
    return targets.some((t) => t === "First Name" || t === "Last Name" || t === "__full_name" || t === "Business Name");
  };
  if (!files || files.length === 0 || !files.every((f) => named(f.mapping))) redirect(PAGE);

  await approveStep(supabase, user.id, accountId, STEP_KEY);
  redirect("/portal");
}
