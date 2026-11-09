import { redirect } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { createClient } from "@/lib/supabase/server";
import { requireStepAccess } from "@/lib/stepAccess";
import { getSandboxTier } from "@/lib/devSandbox";
import { isContactRole, OTC_FIELDS } from "@/lib/otcFields";
import { isActive, newOtcFieldsFrom, type WorkflowField } from "@/lib/workflowFields";
import { SAMPLE_EMAIL_TEMPLATES } from "@/lib/sampleEmailTemplates";
import {
  EMAIL_COPY_ROLES,
  fromSample,
  guessAttachments,
  type EmailTemplate,
} from "@/lib/emailTemplates";
import { EmailTemplatesConfigurator } from "@/components/EmailTemplatesConfigurator";
import { finishEmailTemplates } from "./actions";

const STEP_KEY = "sample_email_templates";

export default async function SampleEmailTemplatesPage({
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

  const [{ data: saved }, { data: docs }, { data: prepDocs }] = accountId
    ? await Promise.all([
        supabase
          .from("client_email_templates")
          .select("*")
          .eq("client_account_id", accountId)
          .order("created_at"),
        supabase
          .from("contract_documents")
          .select("id, file_name, workflow_fields")
          .eq("client_account_id", accountId)
          .order("created_at"),
        supabase
          .from("prep_documents")
          .select("name, contract_document_id, categories, sides")
          .eq("client_account_id", accountId)
          .order("created_at"),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  // The client's own templates first, then every sample (their copy, if
  // they've changed it).
  const toTemplate = (r: NonNullable<typeof saved>[number]): EmailTemplate => ({
    id: r.id,
    sampleKey: r.sample_key,
    include: r.include,
    title: r.title,
    subject: r.subject,
    body: r.body,
    to: r.to_roles,
    cc: r.cc_roles,
    bcc: r.bcc_roles,
    files: r.file_roles,
  });
  // Documents, by the names templates attach them by, with their categories
  // and sides (from Categorize Your Documents).
  const docName = (fileName: string) => fileName.replace(/\.pdf$/i, "");
  const contractName = new Map((docs ?? []).map((d) => [d.id, docName(d.file_name)] as const));
  const categorized = (prepDocs ?? []).map((d) => ({
    name: d.contract_document_id ? (contractName.get(d.contract_document_id) ?? d.name) : d.name,
    categories: d.categories,
    sides: d.sides,
  }));
  const defaultFiles = Object.fromEntries(
    SAMPLE_EMAIL_TEMPLATES.map((s) => [s.key, guessAttachments(s.title, categorized)] as const),
  );

  const bySample = new Map(
    (saved ?? []).filter((r) => r.sample_key).map((r) => [r.sample_key!, r] as const),
  );
  const templates: EmailTemplate[] = [
    ...(saved ?? []).filter((r) => !r.sample_key).map(toTemplate),
    ...SAMPLE_EMAIL_TEMPLATES.map((s) => {
      const r = bySample.get(s.key);
      return r ? toTemplate(r) : fromSample(s, defaultFiles[s.key]);
    }),
  ];

  // To / Cc / Bcc: OTC's contact roles plus any the client added, and the
  // CC / BCC on ALL roles. Attach:
  // their documents (uploaded contracts, and ones added by name).
  const assigned = (docs ?? [])
    .flatMap((d) => (Array.isArray(d.workflow_fields) ? (d.workflow_fields as WorkflowField[]) : []))
    .filter(isActive);
  const roleOptions = [
    ...new Set([
      ...OTC_FIELDS.filter(isContactRole).map((f) => f.name),
      ...newOtcFieldsFrom(assigned)
        .filter(isContactRole)
        .map((f) => f.name),
      ...EMAIL_COPY_ROLES,
    ]),
  ];
  const fileOptions = [
    ...new Set([
      ...(docs ?? []).map((d) => docName(d.file_name)),
      ...(prepDocs ?? []).filter((d) => !d.contract_document_id).map((d) => d.name),
    ]),
  ];

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
              Test mode &mdash; clients choose and edit their own templates here. Changes you
              make are saved to the client you pick.
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
          {step?.title ?? "Sample Email Templates"}
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
            Here are our sample email templates. Uncheck any you won&rsquo;t use, and open one
            to read it or make it yours: change the wording, choose who it goes to (To, Cc and
            Bcc) and which documents go with it. Highlighted words like{" "}
            <span className="rounded bg-accent-soft/70 px-1 font-mono text-[0.8em] text-accent">
              closing date
            </span>{" "}
            fill in automatically from the transaction.
          </p>
        )}

        <div className="mt-6">
          {accountId ? (
            <EmailTemplatesConfigurator
              key={accountId}
              accountId={isStaff ? accountId : null}
              initial={templates}
              roleOptions={roleOptions}
              fileOptions={fileOptions}
              defaultFiles={defaultFiles}
            />
          ) : (
            <p className="rounded-xl border border-border bg-surface p-6 text-sm text-ink-soft">
              {isStaff
                ? "Choose a client above to see their templates."
                : "Your account isn't set up yet."}
            </p>
          )}
        </div>

        {!isStaff && accountId && (
          <form action={finishEmailTemplates} className="mt-8 flex justify-center">
            <button
              type="submit"
              className="rounded-lg bg-accent px-8 py-2.5 text-sm font-semibold text-white"
            >
              I&rsquo;m Done With My Email Templates
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
