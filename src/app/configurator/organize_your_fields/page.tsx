import { redirect } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { createClient } from "@/lib/supabase/server";
import { requireStepAccess } from "@/lib/stepAccess";
import { getSandboxTier } from "@/lib/devSandbox";
import { stepClientHref } from "@/lib/stepHref";
import { SYSTEM_REQUIRED_IDS } from "@/lib/otcFields";
import { loadFieldUse, type FieldUse } from "@/lib/fieldUse";
import { orgFields, reconcileLayout } from "@/lib/fieldOrganization";
import { FieldOrganizer } from "@/components/FieldOrganizer";
import { finishOrganizeFields } from "./actions";

const STEP_KEY = "organize_your_fields";

export default async function OrganizeYourFieldsPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; done?: string }>;
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
  const { client, done } = await searchParams;

  // Staff pick a client to see or help with theirs.
  const { data: clients } = isStaff
    ? await supabase.from("client_accounts").select("id, name").order("name")
    : { data: [] };
  const accountId = isStaff
    ? (clients ?? []).some((c) => c.id === client)
      ? client!
      : null
    : (profile?.client_account_id ?? null);

  // Without a client (staff testing), the fields every account starts with.
  const use: FieldUse = accountId
    ? await loadFieldUse(supabase, accountId)
    : { inUse: new Set(SYSTEM_REQUIRED_IDS), newFields: [], custom: [], names: {} };
  const fields = orgFields(use.inUse, use.newFields, use.custom);
  const [{ data: saved }, { data: account }] = accountId
    ? await Promise.all([
        supabase
          .from("client_field_organization")
          .select("layout, done_at")
          .eq("client_account_id", accountId)
          .maybeSingle(),
        supabase.from("client_accounts").select("setup_path").eq("id", accountId).maybeSingle(),
      ])
    : [{ data: null }, { data: null }];
  const layout = reconcileLayout(saved?.layout, fields);
  const pdfHref = `/configurator/${STEP_KEY}/instructions${isStaff && accountId ? `?client=${accountId}` : ""}`;

  // The lesson after this one, for when they're done.
  const { data: thisStep } = await supabase
    .from("setup_steps")
    .select("sort_order")
    .eq("path", account?.setup_path ?? "custom")
    .eq("key", STEP_KEY)
    .maybeSingle();
  const { data: next } = thisStep
    ? await supabase
        .from("setup_steps")
        .select("id, key, step_type")
        .eq("path", account?.setup_path ?? "custom")
        .gt("sort_order", thisStep.sort_order)
        .order("sort_order")
        .limit(1)
        .maybeSingle()
    : { data: null };
  const finished = Boolean(saved?.done_at);

  return (
    <main className="flex flex-1 justify-center bg-bg px-4 py-12">
      <div className="w-full max-w-5xl">
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
                ? "Changes you make are saved to this client."
                : "Test mode — clients organize the fields they use here. Nothing is saved; pick a client to see theirs."}
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
            {accountId && (
              <a href={pdfHref} className="ml-auto text-xs font-semibold text-accent underline">
                Download their instructions (PDF)
              </a>
            )}
          </div>
        )}

        <h1 className="mt-3 font-display text-2xl font-bold text-ink">
          {step?.title ?? "Organize Your Fields"}
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
            Here are the fields you chose in Finalize Your Fields, in Open to Close&rsquo;s field
            groups. Put them in the order your team would like to see them: drag sections up or
            down within a group, move a section to another group, and drag fields within their
            section. When you&rsquo;re done, you&rsquo;ll get step-by-step instructions (a PDF) for
            setting them up this way, with a list of the fields you don&rsquo;t use to archive.
          </p>
        )}

        {!isStaff && finished && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-success/30 bg-success-soft px-4 py-3 text-sm">
            <span className="font-semibold text-success">
              {done ? "Nice work! Your fields are organized." : "You've organized your fields."}{" "}
              <span className="font-normal text-ink-soft">
                Your instructions are ready. If you change anything below, download them again.
              </span>
            </span>
            <span className="flex items-center gap-3">
              <a
                href={pdfHref}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white"
              >
                Download instructions (PDF)
              </a>
              {next && (
                <Link href={stepClientHref(next)} className="text-sm font-semibold text-accent">
                  Next lesson &rsaquo;
                </Link>
              )}
            </span>
          </div>
        )}

        <div className="mt-6">
          <FieldOrganizer
            key={accountId ?? "test"}
            accountId={isStaff ? accountId : null}
            canSave={Boolean(accountId)}
            fields={fields}
            names={use.names}
            initialLayout={layout}
          />
        </div>

        {!isStaff && accountId && (
          <form action={finishOrganizeFields} className="mt-8 flex flex-col items-center gap-2">
            <button
              type="submit"
              className="rounded-lg bg-accent px-8 py-2.5 text-sm font-semibold text-white"
            >
              I&rsquo;m Done Organizing My Fields
            </button>
            <span className="text-xs text-ink-faint">
              You&rsquo;ll get your step-by-step instructions as a PDF.
            </span>
          </form>
        )}
      </div>
    </main>
  );
}
