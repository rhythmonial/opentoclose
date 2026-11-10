import { configuratorAccount } from "@/lib/configuratorAccount";
import { loadFieldUse } from "@/lib/fieldUse";
import { cleanChoiceEdits, orgFields, reconcileLayout } from "@/lib/fieldOrganization";
import { organizeInstructionsPdf } from "@/lib/organizePdf";

// The Organize Your Fields instructions as a PDF, made from how the client
// arranged their fields (staff pass ?client=<account>).
export async function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get("client");
  const { supabase, user, accountId } = await configuratorAccount(
    requested && /^[0-9a-f-]{36}$/i.test(requested) ? requested : null,
  );
  if (!user) return new Response("Sign in to download your instructions.", { status: 401 });
  if (!accountId) return new Response("No client account.", { status: 404 });

  const [{ data: account }, { data: saved }, use] = await Promise.all([
    supabase.from("client_accounts").select("name").eq("id", accountId).maybeSingle(),
    supabase
      .from("client_field_organization")
      .select("layout, choice_edits")
      .eq("client_account_id", accountId)
      .maybeSingle(),
    loadFieldUse(supabase, accountId),
  ]);
  if (!account) return new Response("No client account.", { status: 404 });
  const fields = orgFields(use.inUse, use.newFields, use.custom, use.contractOptions, use.sections);
  const bytes = await organizeInstructionsPdf({
    accountName: account.name,
    layout: reconcileLayout(saved?.layout, fields, use.sections),
    fields,
    sections: use.sections,
    inUse: use.inUse,
    names: use.names,
    choiceEdits: cleanChoiceEdits(saved?.choice_edits, fields),
    placeholders: use.placeholders,
  });
  const fileName = `Organize Your Fields - ${account.name}`.replace(/[^\w .-]/g, "").slice(0, 100);
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
