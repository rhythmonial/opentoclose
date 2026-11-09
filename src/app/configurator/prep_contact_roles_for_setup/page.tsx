import { redirect } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { createClient } from "@/lib/supabase/server";
import { getSandboxTier } from "@/lib/devSandbox";
import type { ContactMapping } from "@/lib/otcContactFields";
import { ContactPrep, type ContactFile } from "@/components/ContactPrep";
import { finishContacts } from "./actions";

const STEP_KEY = "prep_contact_roles_for_setup";

export default async function PrepYourContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
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

  const { data: rows } = accountId
    ? await supabase
        .from("contact_imports")
        .select("*")
        .eq("client_account_id", accountId)
        .order("created_at")
    : { data: [] };
  const { data: signed } =
    rows && rows.length > 0
      ? await supabase.storage.from("contact-files").createSignedUrls(
          rows.map((r) => r.storage_path),
          60 * 60,
        )
      : { data: [] };
  const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl] as const));

  const files: ContactFile[] = (rows ?? []).map((r) => ({
    id: r.id,
    fileName: r.file_name,
    columns: r.columns,
    rowCount: r.row_count,
    mapping: (r.mapping ?? {}) as ContactMapping,
    url: urlByPath.get(r.storage_path) ?? null,
  }));
  const named = (m: ContactMapping) =>
    Object.values(m).some(
      (t) => t === "First Name" || t === "Last Name" || t === "__full_name" || t === "Business Name",
    );
  const ready = files.length > 0 && files.every((f) => named(f.mapping));

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
              Test mode &mdash; clients upload and match their own contacts here. Pick a client
              to see theirs, or to upload for them.
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
          {step?.title ?? "Prep Your Contacts"}
        </h1>
        {step?.description ? (
          <div
            className="mt-1.5 max-w-3xl text-sm leading-relaxed text-ink-soft
              [&_p]:mt-2 [&_strong]:font-bold [&_strong]:text-ink [&_em]:italic
              [&_a]:font-semibold [&_a]:text-accent [&_a]:underline
              [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mt-2 [&_ol]:list-decimal [&_ol]:pl-5
              [&_li]:mt-1 first:[&>*]:mt-0"
          >
            <ReactMarkdown>{step.description}</ReactMarkdown>
          </div>
        ) : (
          <p className="mt-1.5 max-w-3xl text-sm text-ink-soft">
            Upload your contacts in whatever format you have them: an export from your CRM,
            email or phone, or a spreadsheet. Then match each of your columns to the Open to
            Close field it belongs in. We&rsquo;ve matched the ones we could; check them and
            fill in the rest. Anything set to &ldquo;Don&rsquo;t import&rdquo; is left out.
          </p>
        )}

        <div className="mt-6">
          {accountId ? (
            <ContactPrep
              key={accountId}
              accountId={accountId}
              isStaff={isStaff}
              initialFiles={files}
            />
          ) : (
            <p className="rounded-xl border border-border bg-surface p-6 text-sm text-ink-soft">
              {isStaff
                ? "Choose a client above to see their contacts."
                : "Your account isn't set up yet."}
            </p>
          )}
        </div>

        {!isStaff && accountId && (
          <form action={finishContacts} className="mt-8 flex flex-col items-center gap-2">
            <button
              type="submit"
              disabled={!ready}
              className="rounded-lg bg-accent px-8 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              I&rsquo;m Done With My Contacts
            </button>
            {!ready && (
              <span className="text-xs text-ink-faint">
                Upload at least one file, and match a name column in each.
              </span>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
