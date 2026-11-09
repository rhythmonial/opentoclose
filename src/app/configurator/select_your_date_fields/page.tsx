import { redirect } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { createClient } from "@/lib/supabase/server";
import { requireStepAccess } from "@/lib/stepAccess";
import { getSandboxTier } from "@/lib/devSandbox";
import { OTC_FIELDS, sectionById, type OtcField } from "@/lib/otcFields";
import {
  isActive,
  NEW_OTC_PREFIX,
  newOtcFieldsFrom,
  type WorkflowField,
} from "@/lib/workflowFields";
import { calcComplete, cleanCalc, type DateCalc } from "@/lib/dateCalculations";
import { DateFieldsConfigurator, type FieldOption } from "@/components/DateFieldsConfigurator";
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

  const [{ data: docs }, { data: saved }] = accountId
    ? await Promise.all([
        supabase
          .from("contract_documents")
          .select("workflow_fields")
          .eq("client_account_id", accountId),
        supabase.from("date_calculations").select("*").eq("client_account_id", accountId),
      ])
    : [{ data: [] }, { data: [] }];

  // The client's assigned fields mark which OTC fields are on their
  // contracts, and add the date and number fields they created.
  const assigned = (docs ?? [])
    .flatMap((d) => (Array.isArray(d.workflow_fields) ? (d.workflow_fields as WorkflowField[]) : []))
    .filter(isActive);
  const onContract = new Set(assigned.map((f) => f.otc_field).filter(Boolean));
  const all: OtcField[] = [...OTC_FIELDS, ...newOtcFieldsFrom(assigned)];
  const options = (kind: "date" | "number"): FieldOption[] =>
    all
      .filter((f) => f.kind === kind)
      .map((f) => ({
        id: f.id,
        name: f.name,
        section: sectionById(f.sectionId)?.name ?? "Your new fields",
        onContract: onContract.has(f.id),
      }));

  // Dates the client added here.
  const known = new Set(all.map((f) => f.id));
  const addedDates: FieldOption[] = (saved ?? [])
    .filter((c) => c.otc_field.startsWith(NEW_OTC_PREFIX) && c.field_name && !known.has(c.otc_field))
    .map((c) => ({
      id: c.otc_field,
      name: c.field_name!,
      section: "Dates you added",
      onContract: false,
      added: true,
    }));

  const calcs = (saved ?? [])
    .map((c) => cleanCalc(c as Partial<DateCalc>))
    .filter((c): c is DateCalc => Boolean(c));
  const checked = calcs.filter((c) => c.enabled);
  const ready = checked.length > 0 && checked.every(calcComplete);

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
            Check each date your team tracks that&rsquo;s worked out from another date, then
            say how: so many calendar or business days before or after which date. If the
            number of days is a blank on the contract that the agent fills in, check that box
            and choose the number field it goes in.
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
              dates={[...options("date"), ...addedDates]}
              numbers={options("number")}
              initial={calcs}
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
                Check at least one date and fill in everything for each one you check.
              </span>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
