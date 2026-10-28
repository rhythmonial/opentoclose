import { redirect } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { createClient } from "@/lib/supabase/server";
import { getSandboxTier } from "@/lib/devSandbox";
import type { ContractBlank } from "@/lib/contractBlanks";
import { ContractUploader } from "@/components/ContractUploader";
import { SavedContractDoc } from "@/components/SavedContractDoc";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { deleteContractDocument, finishContractDocs } from "./actions";

const STEP_KEY = "upload_your_contract_docs";

export default async function UploadContractDocsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: profile }, { data: step }] = await Promise.all([
    supabase
      .from("profiles")
      .select("role, client_account_id")
      .eq("id", user.id)
      .single(),
    supabase
      .from("setup_steps")
      .select("title, description")
      .eq("key", STEP_KEY)
      .limit(1)
      .maybeSingle(),
  ]);

  const isStaff = profile?.role === "dev" || profile?.role === "dev_admin";
  const sandboxTier = isStaff ? await getSandboxTier() : null;
  const accountId = isStaff ? null : (profile?.client_account_id ?? null);

  const { data: docs } = accountId
    ? await supabase
        .from("contract_documents")
        .select("*")
        .eq("client_account_id", accountId)
        .order("created_at")
    : { data: [] };

  const { data: signed } =
    docs && docs.length > 0
      ? await supabase.storage
          .from("contract-docs")
          .createSignedUrls(
            docs.map((d) => d.storage_path),
            60 * 60,
          )
      : { data: [] };
  // Scans can't be reviewed; everything else needs every page confirmed.
  const toReview = (docs ?? []).filter((d) => !d.is_scanned && !d.reviewed_at);
  const firstToReview = toReview[0];

  const urlByPath = new Map(
    (signed ?? []).map((s) => [s.path, s.signedUrl] as const),
  );

  return (
    <main className="flex flex-1 justify-center bg-bg px-4 py-12">
      <div className="w-full max-w-4xl">
        <Link
          href={isStaff && !sandboxTier ? "/dashboard/tasks" : "/portal"}
          className="text-sm font-medium text-accent"
        >
          &larr;{" "}
          {isStaff && !sandboxTier ? "Back to editor" : "Back to your setup"}
        </Link>

        {isStaff && (
          <div className="mt-4 rounded-lg border border-accent-soft bg-accent-soft/40 px-4 py-2.5 text-sm font-semibold text-accent">
            Test mode &mdash; drop in any PDF to see what blanks it finds.
            Nothing is uploaded or saved.
          </div>
        )}

        <h1 className="mt-3 font-display text-2xl font-bold text-ink">
          {step?.title ?? "Upload Your Contract Docs"}
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
            Upload the blank versions of the contracts and addenda you use
            most. We&rsquo;ll read each one for its fill-in blanks so we can
            map them to fields in your setup.
          </p>
        )}

        <div className="mt-6">
          <ContractUploader accountId={accountId} testMode={isStaff} />
        </div>

        {docs && docs.length > 0 && (
          <section className="mt-8">
            <h2 className="text-[15px] font-bold text-ink">
              Your uploaded documents ({docs.length})
            </h2>
            <div className="mt-3 flex flex-col gap-3">
              {docs.map((doc) => (
                <SavedContractDoc
                  key={doc.id}
                  id={doc.id}
                  confirmedPages={doc.confirmed_pages}
                  defaultOpen={doc.id === firstToReview?.id}
                  fileName={doc.file_name}
                  url={urlByPath.get(doc.storage_path) ?? null}
                  pageCount={doc.page_count ?? 0}
                  blanks={doc.blanks as ContractBlank[]}
                  isScanned={doc.is_scanned}
                  uploadedOn={new Date(doc.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                  actions={
                    <form action={deleteContractDocument}>
                      <input type="hidden" name="id" value={doc.id} />
                      <ConfirmDeleteButton title={`Delete ${doc.file_name}`} size="sm" />
                    </form>
                  }
                />
              ))}
            </div>

            <form
              action={finishContractDocs}
              className="mt-6 flex flex-col items-center gap-2"
            >
              <button
                type="submit"
                disabled={toReview.length > 0}
                className="rounded-lg bg-accent px-8 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                I&rsquo;m Done Uploading
              </button>
              {toReview.length > 0 && (
                <span className="text-xs text-ink-faint">
                  Confirm every page of{" "}
                  {toReview.length === 1 ? "your document" : `all ${toReview.length} documents`}{" "}
                  to finish.
                </span>
              )}
            </form>
          </section>
        )}
      </div>
    </main>
  );
}
