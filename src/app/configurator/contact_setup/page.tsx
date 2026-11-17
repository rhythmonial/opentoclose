import type { ContactMapping } from "@/lib/otcContactFields";
import { CombinedContacts } from "@/components/CombinedContacts";
import { loadSetupLesson, SetupShell } from "../_setup/shell";

// Contact Setup: all their contacts combined in Open to Close's columns,
// with the CSV to import.
export default async function ContactSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const { client } = await searchParams;
  const lesson = await loadSetupLesson("contact_setup", client);
  const { supabase, accountId } = lesson;

  let files: { id: string; fileName: string; url: string | null; mapping: ContactMapping }[] = [];
  if (accountId) {
    const { data: rows } = await supabase
      .from("contact_imports")
      .select("id, file_name, storage_path, mapping")
      .eq("client_account_id", accountId)
      .order("created_at");
    const { data: signed } =
      rows && rows.length > 0
        ? await supabase.storage.from("contact-files").createSignedUrls(rows.map((r) => r.storage_path), 60 * 60)
        : { data: [] };
    const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl] as const));
    files = (rows ?? []).map((r) => ({
      id: r.id,
      fileName: r.file_name,
      url: urlByPath.get(r.storage_path) ?? null,
      mapping: (r.mapping ?? {}) as ContactMapping,
    }));
  }

  return (
    <SetupShell
      lesson={lesson}
      fallbackTitle="Contact Setup"
      wide
      blurb="All of your contacts combined in Open to Close's contact import columns. Download the CSV and import it into Open to Close."
    >
      <CombinedContacts files={files} />
    </SetupShell>
  );
}
