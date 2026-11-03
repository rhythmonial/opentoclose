import { redirect } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { createClient } from "@/lib/supabase/server";
import { getSandboxTier } from "@/lib/devSandbox";
import { OTC_FIELDS } from "@/lib/otcFields";
import { isActive, newOtcFieldsFrom, type WorkflowField } from "@/lib/workflowFields";
import type { PlannedTask, TaskSide } from "@/lib/taskPlans";
import { TaskPlanner } from "@/components/TaskPlanner";
import { finishTaskPlans } from "./actions";

const STEP_KEY = "plan_your_task_templates";

export default async function PlanYourTaskTemplatesPage({
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

  const [{ data: saved }, { data: docs }, { data: addedDates }] = accountId
    ? await Promise.all([
        supabase
          .from("client_task_plans")
          .select("*")
          .eq("client_account_id", accountId)
          .order("sort_order"),
        supabase
          .from("contract_documents")
          .select("workflow_fields")
          .eq("client_account_id", accountId),
        // Dates the client added in Select Your Date Fields.
        supabase
          .from("date_calculations")
          .select("field_name")
          .eq("client_account_id", accountId)
          .not("field_name", "is", null),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const tasks: PlannedTask[] = (saved ?? []).map((r) => ({
    id: r.id,
    side: r.side as TaskSide,
    template: r.template,
    name: r.name,
    notes: r.notes,
    critical: r.critical,
    recurDays: r.recur_days,
    dueDays: r.due_days,
    timeFrame: r.time_frame as PlannedTask["timeFrame"],
    timing: r.timing as PlannedTask["timing"],
    dateField: r.date_field,
    parentTask: r.parent_task,
    sortOrder: r.sort_order,
  }));

  // Date fields to suggest: OTC's, plus any the client added.
  const assigned = (docs ?? [])
    .flatMap((d) => (Array.isArray(d.workflow_fields) ? (d.workflow_fields as WorkflowField[]) : []))
    .filter(isActive);
  const dateOptions = [
    ...new Set([
      ...OTC_FIELDS.filter((f) => f.kind === "date").map((f) => f.name),
      ...newOtcFieldsFrom(assigned)
        .filter((f) => f.kind === "date")
        .map((f) => f.name),
      ...(addedDates ?? []).map((d) => d.field_name!).filter(Boolean),
    ]),
  ];

  return (
    <main className="flex flex-1 justify-center bg-bg px-4 py-12">
      <div className="w-full max-w-6xl">
        <Link
          href={isStaff && !sandboxTier ? "/dashboard/tasks" : "/portal"}
          className="text-sm font-medium text-accent"
        >
          &larr; {isStaff && !sandboxTier ? "Back to editor" : "Back to your setup"}
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
              dateOptions={dateOptions}
            />
          ) : (
            <p className="rounded-xl border border-border bg-surface p-6 text-sm text-ink-soft">
              {isStaff
                ? "Choose a client above to see their task templates."
                : "Your account isn't set up yet."}
            </p>
          )}
        </div>

        {!isStaff && accountId && (
          <form action={finishTaskPlans} className="mt-8 flex justify-center">
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
