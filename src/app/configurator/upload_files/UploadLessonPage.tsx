import { redirect } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { createClient } from "@/lib/supabase/server";
import { requireStepAccess } from "@/lib/stepAccess";
import { getSandboxTier } from "@/lib/devSandbox";
import { UPLOAD_LESSONS, type UploadKind } from "@/lib/uploadLessons";
import { FileUploadLesson } from "@/components/FileUploadLesson";
import { finishUpload } from "./actions";

// Upload Your Contacts / Messages / Tasks (Setup Prep): upload files only.
export async function UploadLessonPage({ kind, client }: { kind: UploadKind; client?: string }) {
  const lesson = UPLOAD_LESSONS[kind];
  await requireStepAccess(lesson.stepKey);
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
      .eq("key", lesson.stepKey)
      .limit(1)
      .maybeSingle(),
  ]);
  const isStaff = profile?.role === "dev" || profile?.role === "dev_admin";
  const sandboxTier = isStaff ? await getSandboxTier() : null;

  // Staff pick a client to see or help with theirs.
  const { data: clients } = isStaff
    ? await supabase.from("client_accounts").select("id, name").order("name")
    : { data: [] };
  const accountId = isStaff
    ? (clients ?? []).some((c) => c.id === client)
      ? client!
      : null
    : (profile?.client_account_id ?? null);

  const rows = accountId
    ? kind === "contacts"
      ? ((
          await supabase
            .from("contact_imports")
            .select("id, file_name, storage_path, columns, row_count")
            .eq("client_account_id", accountId)
            .order("created_at")
        ).data ?? [])
      : ((
          await supabase
            .from("prep_file_uploads")
            .select("id, file_name, storage_path, columns, row_count")
            .eq("client_account_id", accountId)
            .eq("kind", kind)
            .order("created_at")
        ).data ?? [])
    : [];
  const { data: signed } =
    rows.length > 0
      ? await supabase.storage.from("contact-files").createSignedUrls(
          rows.map((r) => r.storage_path),
          60 * 60,
        )
      : { data: [] };
  const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl] as const));

  return (
    <main className="flex flex-1 justify-center bg-bg px-4 py-12">
      <div className="w-full max-w-3xl">
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
              {accountId
                ? "Files you upload are saved to this client."
                : "Pick a client to see or add their files."}
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
              <button type="submit" className="rounded-md bg-accent px-3 py-1 text-xs font-semibold text-white">
                Show
              </button>
            </form>
          </div>
        )}

        <h1 className="mt-3 font-display text-2xl font-bold text-ink">{step?.title ?? lesson.title}</h1>
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
          <p className="mt-1.5 text-sm text-ink-soft">{lesson.blurb}</p>
        )}

        <div className="mt-6">
          {accountId ? (
            <FileUploadLesson
              key={accountId}
              kind={kind}
              accountId={accountId}
              isStaff={isStaff}
              initialFiles={rows.map((r) => ({
                id: r.id,
                fileName: r.file_name,
                rowCount: r.row_count,
                columns: r.columns.length,
                url: urlByPath.get(r.storage_path) ?? null,
              }))}
            />
          ) : (
            <p className="rounded-xl border border-border bg-surface p-6 text-sm text-ink-soft">
              Choose a client above to see their files.
            </p>
          )}
        </div>

        {!isStaff && (
          <form action={finishUpload} className="mt-8 flex flex-col items-center gap-2">
            <input type="hidden" name="kind" value={kind} />
            <button
              type="submit"
              disabled={rows.length === 0}
              className="rounded-lg bg-accent px-8 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              I&rsquo;m Done Uploading
            </button>
            {rows.length === 0 && (
              <span className="text-xs text-ink-faint">Upload at least one file to finish.</span>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
