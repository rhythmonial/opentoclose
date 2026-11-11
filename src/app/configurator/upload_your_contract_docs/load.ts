import { redirect } from "next/navigation";
import { inUploadOrder } from "@/lib/docOrder";
import { createClient } from "@/lib/supabase/server";
import { requireStepAccess } from "@/lib/stepAccess";
import { getSandboxTier } from "@/lib/devSandbox";

export const STEP_KEY = "upload_your_contract_docs";
export const UPLOAD_PAGE = `/configurator/${STEP_KEY}`;

// What Upload Your Contracts shows: who's looking (a client, or staff on a
// client's page with ?client=<account>, or staff testing), the lesson, and
// the client's contracts in their upload order with links to open them.
export async function loadUploadDocs(client: string | undefined) {
  await requireStepAccess(STEP_KEY);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: step }] = await Promise.all([
    supabase.from("profiles").select("role, client_account_id").eq("id", user.id).single(),
    supabase
      .from("setup_steps")
      .select("title, description")
      .eq("key", STEP_KEY)
      .limit(1)
      .maybeSingle(),
  ]);

  const isStaff = profile?.role === "dev" || profile?.role === "dev_admin";
  const sandboxTier = isStaff ? await getSandboxTier() : null;
  const { data: staffClient } =
    isStaff && client && /^[0-9a-f-]{36}$/i.test(client)
      ? await supabase.from("client_accounts").select("id, name").eq("id", client).maybeSingle()
      : { data: null };
  const accountId = isStaff ? (staffClient?.id ?? null) : (profile?.client_account_id ?? null);

  const { data: unordered } = accountId
    ? await supabase
        .from("contract_documents")
        .select("*")
        .eq("client_account_id", accountId)
        .order("created_at")
    : { data: [] };
  const docs = inUploadOrder(unordered ?? []);

  const { data: signed } =
    docs.length > 0
      ? await supabase.storage.from("contract-docs").createSignedUrls(
          docs.map((d) => d.storage_path),
          60 * 60,
        )
      : { data: [] };
  const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl] as const));

  // Staff keep the client in the address as they go between pages.
  const query = staffClient ? `?client=${staffClient.id}` : "";
  // Each document's page: /doc1, /doc2… in their upload order.
  const docHref = (index: number) => `${UPLOAD_PAGE}/doc${index + 1}${query}`;

  return {
    user,
    step,
    isStaff,
    sandboxTier,
    staffClient,
    accountId,
    // Staff with no client picked get the test mode.
    testMode: isStaff && !staffClient,
    docs,
    urlOf: (d: { storage_path: string }) => urlByPath.get(d.storage_path) ?? null,
    listHref: `${UPLOAD_PAGE}${query}`,
    docHref,
  };
}

export const isReviewed = (d: { is_scanned: boolean; reviewed_at: string | null }) =>
  !d.is_scanned && Boolean(d.reviewed_at);
