import { MessageSetupTable } from "@/components/MessageSetupTable";
import { loadSetupLesson, SetupShell } from "../_setup/shell";

// Message Setup: all the templates they're using (their own and the samples
// they checked), combined, with the CSV to import into Open to Close.
export default async function MessageSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const { client } = await searchParams;
  const lesson = await loadSetupLesson("message_setup", client);
  const { supabase, accountId } = lesson;

  const { data: rows } = accountId
    ? await supabase
        .from("client_email_templates")
        .select("title, subject, body, to_roles, cc_roles, bcc_roles, file_roles, sample_key, created_at")
        .eq("client_account_id", accountId)
        .eq("include", true)
        .order("created_at")
    : { data: [] };
  // Their own first, then the samples they're using, each A to Z.
  const templates = [...(rows ?? [])]
    .sort((a, b) => Number(Boolean(a.sample_key)) - Number(Boolean(b.sample_key)) || a.title.localeCompare(b.title))
    .map((r) => ({
      title: r.title,
      subject: r.subject,
      body: r.body,
      to: r.to_roles,
      cc: r.cc_roles,
      bcc: r.bcc_roles,
      files: r.file_roles,
    }));

  return (
    <SetupShell
      lesson={lesson}
      fallbackTitle="Message Setup"
      wide
      blurb="Every message template you're using, in one list. Click a title to read it, then download the CSV and import it into Open to Close."
    >
      <MessageSetupTable templates={templates} />
    </SetupShell>
  );
}
