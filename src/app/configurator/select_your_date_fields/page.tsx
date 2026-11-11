import { redirect } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { createClient } from "@/lib/supabase/server";
import { requireStepAccess } from "@/lib/stepAccess";
import { getSandboxTier } from "@/lib/devSandbox";
import {
  cleanCustomFields,
  cleanOtcSelection,
  OTC_FIELDS,
  sectionById,
  type OtcField,
} from "@/lib/otcFields";
import {
  isActive,
  newOtcFieldsFrom,
  otcTargetOf,
  placeholderText,
  type WorkflowField,
} from "@/lib/workflowFields";
import { calcComplete, cleanCalc, type DateCalc } from "@/lib/dateCalculations";
import { buildDateRows, type DateOption } from "@/lib/dateRows";
import { inUploadOrder } from "@/lib/docOrder";
import type { ContractBlank } from "@/lib/contractBlanks";
import { inContractOrder } from "@/components/WorkflowFieldsSummary";
import { DateFieldsConfigurator, type NumberOption } from "@/components/DateFieldsConfigurator";
import { finishDateFields } from "./actions";

const STEP_KEY = "select_your_date_fields";

export default async function SelectYourDateFieldsPage({
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

  const [{ data: docs }, { data: saved }, { data: selection }] = accountId
    ? await Promise.all([
        supabase
          .from("contract_documents")
          .select("blanks, workflow_fields, created_at, upload_order")
          .eq("client_account_id", accountId)
          .eq("is_scanned", false),
        supabase.from("date_calculations").select("*").eq("client_account_id", accountId),
        supabase
          .from("client_otc_field_selections")
          .select("fields, custom_fields")
          .eq("client_account_id", accountId)
          .maybeSingle(),
      ])
    : [{ data: [] }, { data: [] }, { data: null }];

  // Which fields are on the client's contracts, and the dates and number
  // fields they created (while assigning, or in Customize Your Fields).
  const assigned = (docs ?? [])
    .flatMap((d) => (Array.isArray(d.workflow_fields) ? (d.workflow_fields as WorkflowField[]) : []))
    .filter(isActive);
  const onContract = new Set(assigned.map(otcTargetOf).filter((id): id is string => Boolean(id)));
  const custom = cleanCustomFields(selection?.custom_fields);
  const selected = new Set([...cleanOtcSelection(selection?.fields ?? []), ...custom.map((f) => f.id)]);
  const all: OtcField[] = [...OTC_FIELDS, ...newOtcFieldsFrom(assigned), ...custom];
  const options = (kind: "date" | "number"): DateOption[] =>
    all
      .filter((f) => f.kind === kind)
      .map((f) => ({ id: f.id, name: f.name, section: sectionById(f.sectionId)?.name ?? "Your new fields" }));
  const numbers = options("number");

  const calcs = (saved ?? [])
    .map((c) => cleanCalc(c as Partial<DateCalc>))
    .filter((c): c is DateCalc => Boolean(c));
  // Where each field first appears on the contracts (in their upload order,
  // top to bottom).
  const contractOrder = new Map<string, number>();
  // Days fields with a value for when they're left blank: their placeholder
  // text (the date's Days stays blank).
  const blankNotes: Record<string, string> = {};
  for (const d of inUploadOrder(docs ?? [])) {
    const doc = {
      id: "",
      name: "",
      blanks: (Array.isArray(d.blanks) ? d.blanks : []) as ContractBlank[],
      fields: Array.isArray(d.workflow_fields) ? (d.workflow_fields as WorkflowField[]) : [],
    };
    for (const { field, first } of inContractOrder(doc)) {
      const target = otcTargetOf(field);
      if (target && !contractOrder.has(target)) contractOrder.set(target, contractOrder.size);
      if (target && field.type === "number" && field.if_blank && !blankNotes[target]) {
        blankNotes[target] = placeholderText(first.line, field.if_blank);
      }
    }
  }
  const built = buildDateRows({
    dates: options("date"),
    numbers,
    onContract,
    selected,
    saved: calcs,
    contractOrder,
  });
  const numberOptions: NumberOption[] = numbers.map((n) => ({
    ...n,
    group: onContract.has(n.id) ? "contract" : selected.has(n.id) ? "selected" : "other",
  }));
  // With what will be saved on arrival.
  const byId = new Map([...calcs, ...built.auto].map((c) => [c.otc_field, c] as const));
  const ready = [...byId.values()].filter((c) => c.enabled).every(calcComplete);

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
              Test mode &mdash; clients see their own dates here. Changes you make are saved to
              the client you pick.
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
          {step?.title ?? "Select Your Date Fields"}
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
            Dates written on your contract are entered as they are. Every other date your team
            tracks is worked out from another date: so many calendar or business days before or
            after which date. Put 0 in Days for the same day as that date, or leave Days blank if
            it varies and choose the number field that holds it (like Inspection Period - Days).
          </p>
        )}

        <div className="mt-6">
          {isStaff && !accountId ? (
            <p className="rounded-xl border border-border bg-surface p-6 text-sm text-ink-soft">
              Choose a client above to see their dates.
            </p>
          ) : (
            <DateFieldsConfigurator
              accountId={isStaff ? accountId : null}
              rows={built.rows}
              dates={built.dates}
              numbers={numberOptions}
              initial={calcs}
              auto={built.auto}
              blankNotes={blankNotes}
            />
          )}
        </div>

        {!isStaff && (
          <form action={finishDateFields} className="mt-8 flex flex-col items-center gap-2">
            <button
              type="submit"
              disabled={!ready}
              className="rounded-lg bg-accent px-8 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              I&rsquo;m Done Selecting Dates
            </button>
            {!ready && (
              <span className="text-xs text-ink-faint">
                Fill in everything for each date that&rsquo;s worked out (missing parts are outlined
                in red).
              </span>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
