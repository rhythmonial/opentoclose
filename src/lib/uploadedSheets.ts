import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { UploadedSheet } from "@/components/UploadMapper";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// The message or task files an account uploaded in Setup Prep, with links
// to read them.
export async function loadUploadedSheets(
  supabase: Supabase,
  accountId: string | null,
  kind: "messages" | "tasks",
): Promise<UploadedSheet[]> {
  if (!accountId) return [];
  const { data: rows } = await supabase
    .from("prep_file_uploads")
    .select("id, file_name, storage_path, columns, row_count, mapping")
    .eq("client_account_id", accountId)
    .eq("kind", kind)
    .order("created_at");
  if (!rows || rows.length === 0) return [];
  const { data: signed } = await supabase.storage.from("contact-files").createSignedUrls(
    rows.map((r) => r.storage_path),
    60 * 60,
  );
  const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl] as const));
  return rows.map((r) => ({
    id: r.id,
    fileName: r.file_name,
    columns: r.columns,
    rowCount: r.row_count,
    mapping: (r.mapping ?? {}) as UploadedSheet["mapping"],
    url: urlByPath.get(r.storage_path) ?? null,
  }));
}
