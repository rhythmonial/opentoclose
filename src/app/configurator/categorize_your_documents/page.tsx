import { redirect } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { createClient } from "@/lib/supabase/server";
import { requireStepAccess } from "@/lib/stepAccess";
import { getSandboxTier } from "@/lib/devSandbox";
import { CUSTOM_PREFIX, type CategoryColor, type DocCategory } from "@/lib/documentCategories";
import { DocumentCategorizer, type CategorizedDoc } from "@/components/DocumentCategorizer";
import { finishCategorizing } from "./actions";

const STEP_KEY = "categorize_your_documents";

export default async function CategorizeYourDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
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
  const { client } = await searchParams;

  // Staff pick a client to see or help with theirs.
  const { data: clients } = isStaff
    ? await supabase.from("client_accounts").select("id, name").order("name")
    : { data: [] };
  const accountId = isStaff
    ? (clients ?? []).some((c) => c.id === client)
      ? client!
      : null
    : (profile?.client_account_id ?? null);

  const [{ data: contracts }, { data: saved }, { data: custom }] = accountId
    ? await Promise.all([
        supabase
          .from("contract_documents")
          .select("id, file_name")
          .eq("client_account_id", accountId)
          .order("created_at"),
        supabase
          .from("prep_documents")
          .select("*")
          .eq("client_account_id", accountId)
          .order("created_at"),
        supabase
          .from("document_categories")
          .select("id, name, color")
          .eq("client_account_id", accountId),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  // Uploaded contracts first (with what's been saved for them), then the
  // documents added by name.
  const byContract = new Map(
    (saved ?? []).filter((d) => d.contract_document_id).map((d) => [d.contract_document_id!, d]),
  );
  const docs: CategorizedDoc[] = [
    ...(contracts ?? []).map((c) => {
      const s = byContract.get(c.id);
      return {
        key: `contract-${c.id}`,
        id: s?.id ?? null,
        contractDocumentId: c.id,
        name: c.file_name,
        categories: s?.categories ?? [],
        sides: s?.sides ?? [],
      };
    }),
    ...(saved ?? [])
      .filter((d) => !d.contract_document_id)
      .map((d) => ({
        key: d.id,
        id: d.id,
        contractDocumentId: null,
        name: d.name,
        categories: d.categories,
        sides: d.sides,
      })),
  ];
  const customCategories: DocCategory[] = (custom ?? []).map((c) => ({
    id: `${CUSTOM_PREFIX}${c.id}`,
    name: c.name,
    color: c.color as CategoryColor,
  }));
  const ready =
    docs.length > 0 && docs.every((d) => d.categories.length > 0 && d.sides.length > 0);

  return (
    <main className="flex flex-1 justify-center bg-bg px-4 py-12">
      <div className="w-full max-w-4xl">
        <Link
          href={
            isStaff && !sandboxTier
              ? accountId
                ? `/dashboard/clients/${accountId}`
                : "/dashboard/tasks"
              : "/portal"
          }
          className="text-sm font-medium text-accent"
        >
          &larr;{" "}
          {isStaff && !sandboxTier
            ? accountId
              ? `Back to ${(clients ?? []).find((c) => c.id === accountId)?.name ?? "client"}`
              : "Back to editor"
            : "Back to your setup"}
        </Link>

        {isStaff && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-accent-soft bg-accent-soft/40 px-4 py-2.5 text-sm text-accent">
            <span className="font-semibold">
              Test mode &mdash; clients see their own documents here. Changes you make are
              saved to the client you pick.
            </span>
            <form className="flex items-center gap-2">
              <select
                name="client"
                defaultValue={accountId ?? ""}
                className="rounded-md border border-border bg-surface px-2 py-1 text-sm text-ink"
              >
                <option value="">Choose a client&hellip;</option>
                {(clients ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="rounded-md bg-accent px-3 py-1 text-xs font-semibold text-white"
              >
                Show
              </button>
            </form>
          </div>
        )}

        <h1 className="mt-3 font-display text-2xl font-bold text-ink">
          {step?.title ?? "Categorize Your Documents"}
        </h1>
        {step?.description ? (
          <div
            className="mt-1.5 text-sm leading-relaxed text-ink-soft
              [&_p]:mt-2 [&_strong]:font-bold [&_strong]:text-ink [&_em]:italic
              [&_a]:font-semibold [&_a]:text-accent [&_a]:underline
              [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mt-2 [&_ol]:list-decimal [&_ol]:pl-5
              [&_li]:mt-1 first:[&>*]:mt-0"
          >
            <ReactMarkdown>{step.description}</ReactMarkdown>
          </div>
        ) : (
          <p className="mt-1.5 text-sm text-ink-soft">
            Give each of your documents one or more categories, and check whether it&rsquo;s
            used on the seller, buyer and/or listing side. Add any documents that aren&rsquo;t
            listed, and add your own categories if you need more.
          </p>
        )}

        <div className="mt-6">
          {isStaff && !accountId ? (
            <p className="rounded-xl border border-border bg-surface p-6 text-sm text-ink-soft">
              Choose a client above to see their documents.
            </p>
          ) : (
            <DocumentCategorizer
              key={accountId ?? "none"}
              accountId={isStaff ? accountId : null}
              initialDocs={docs}
              initialCustom={customCategories}
            />
          )}
        </div>

        {!isStaff && (
          <form action={finishCategorizing} className="mt-8 flex flex-col items-center gap-2">
            <button
              type="submit"
              disabled={!ready}
              className="rounded-lg bg-accent px-8 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              I&rsquo;m Done Categorizing
            </button>
            {!ready && (
              <span className="text-xs text-ink-faint">
                Every document needs at least one category and one side.
              </span>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
