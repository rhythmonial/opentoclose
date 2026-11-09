import { redirect } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { createClient } from "@/lib/supabase/server";
import { requireStepAccess } from "@/lib/stepAccess";
import { getSandboxTier } from "@/lib/devSandbox";
import { OTC_FIELDS, sectionById } from "@/lib/otcFields";
import {
  isActive,
  NEW_OTC_PREFIX,
  newOtcFieldsFrom,
  type WorkflowField,
} from "@/lib/workflowFields";
import { customSide, fromRow, type PlannedTask } from "@/lib/taskPlans";
import type { DateGroup } from "@/components/TaskPlanner";
import { TaskPlanner } from "@/components/TaskPlanner";
import { SAMPLE_EMAIL_TEMPLATES } from "@/lib/sampleEmailTemplates";
import { finishTaskPlans } from "./actions";

const STEP_KEY = "plan_your_task_templates";

export default async function PlanYourTaskTemplatesPage({
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

  const [
    { data: saved },
    { data: docs },
    { data: prepDates },
    { data: addedSides },
    { data: emails },
    { data: prepDocs },
  ] = accountId
    ? await Promise.all([
        supabase
          .from("client_task_plans")
          .select("*")
          .eq("client_account_id", accountId)
          .order("sort_order"),
        supabase
          .from("contract_documents")
          .select("file_name, workflow_fields")
          .eq("client_account_id", accountId)
          .order("created_at"),
        // For dates the client added in Select Your Date Fields.
        supabase
          .from("date_calculations")
          .select("otc_field, field_name")
          .eq("client_account_id", accountId),
        supabase
          .from("client_task_sides")
          .select("id, label, prefix")
          .eq("client_account_id", accountId)
          .order("sort_order"),
        // The email templates the client kept in Sample Email Templates.
        supabase
          .from("client_email_templates")
          .select("title, sample_key")
          .eq("client_account_id", accountId)
          .eq("include", true)
          .order("created_at"),
        // Documents added by name in Categorize Your Documents.
        supabase
          .from("prep_documents")
          .select("name, contract_document_id")
          .eq("client_account_id", accountId)
          .order("created_at"),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }];

  const tasks: PlannedTask[] = (saved ?? []).map(fromRow);

  // Emails a task can send: the client's own templates, then the samples
  // they kept, in the order Sample Email Templates lists them.
  const sampleOrder = new Map(SAMPLE_EMAIL_TEMPLATES.map((t, i) => [t.key, i] as const));
  const emailOptions = [
    ...new Set(
      [...(emails ?? [])]
        .sort(
          (a, b) =>
            (a.sample_key ? (sampleOrder.get(a.sample_key) ?? 9999) : -1) -
            (b.sample_key ? (sampleOrder.get(b.sample_key) ?? 9999) : -1),
        )
        .map((e) => e.title),
    ),
  ];
  const sent = new Set(tasks.flatMap((t) => t.emails));
  const withoutTask = emailOptions.filter((t) => !sent.has(t)).length;
  // Documents a task can attach: the same ones email templates attach
  // (uploaded contracts, and ones added by name).
  const documentOptions = [
    ...new Set([
      ...(docs ?? []).map((d) => d.file_name.replace(/\.pdf$/i, "")),
      ...(prepDocs ?? []).filter((d) => !d.contract_document_id).map((d) => d.name),
    ]),
  ];

  // Date Field choices: every date, not just the ones auto-calculated in
  // Select Your Date Fields. OTC's dates by section, in OTC's order, then
  // date fields the client added (assigning their contracts, or in date
  // prep).
  const assigned = (docs ?? [])
    .flatMap((d) => (Array.isArray(d.workflow_fields) ? (d.workflow_fields as WorkflowField[]) : []))
    .filter(isActive);
  const dateGroups: DateGroup[] = [];
  const seen = new Set<string>();
  const add = (section: string, name: string) => {
    if (!name || seen.has(name)) return;
    seen.add(name);
    const group = dateGroups.find((g) => g.section === section);
    if (group) group.names.push(name);
    else dateGroups.push({ section, names: [name] });
  };
  for (const f of OTC_FIELDS) {
    if (f.kind === "date") add(sectionById(f.sectionId)?.name ?? "Open to Close", f.name);
  }
  for (const f of newOtcFieldsFrom(assigned)) {
    if (f.kind === "date") add("Your new fields", f.name);
  }
  for (const d of prepDates ?? []) {
    if (d.otc_field.startsWith(NEW_OTC_PREFIX) && d.field_name) add("Your new fields", d.field_name);
  }

  return (
    <main className="flex flex-1 justify-center bg-bg px-4 py-12">
      <div className="w-full max-w-6xl">
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
              Test mode &mdash; clients plan their own task templates here. Changes you make are
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
          {step?.title ?? "Plan Your Task Templates"}
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
            Plan the tasks your team does on every buyer, seller and listing file. Group them
            into templates (like &ldquo;B - General&rdquo; and &ldquo;B - Loan&rdquo;), mark
            the critical and recurring ones, and set when each is due: so many days before or
            after a date, the same day as it, or when another task (its parent) is completed.
          </p>
        )}

        <div className="mt-6">
          {accountId ? (
            <TaskPlanner
              key={accountId}
              accountId={isStaff ? accountId : null}
              initial={tasks}
              dateGroups={dateGroups}
              customSides={(addedSides ?? []).map(customSide)}
              emailOptions={emailOptions}
              documentOptions={documentOptions}
            />
          ) : (
            <p className="rounded-xl border border-border bg-surface p-6 text-sm text-ink-soft">
              {isStaff
                ? "Choose a client above to see their task templates."
                : "Your account isn't set up yet."}
            </p>
          )}
        </div>

        {!isStaff && accountId && withoutTask > 0 && (
          <p className="mt-8 text-center text-sm text-warning">
            {withoutTask} of your email templates {withoutTask === 1 ? "isn’t" : "aren’t"} on a
            task yet. Open to Close only sends an email from a task.
          </p>
        )}
        {!isStaff && accountId && (
          <form
            action={finishTaskPlans}
            className={`${withoutTask > 0 ? "mt-3" : "mt-8"} flex justify-center`}
          >
            <button
              type="submit"
              disabled={tasks.length === 0}
              className="rounded-lg bg-accent px-8 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              I&rsquo;m Done Planning My Tasks
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
