import { redirect } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { createClient } from "@/lib/supabase/server";
import { requireStepAccess } from "@/lib/stepAccess";
import { getSandboxTier } from "@/lib/devSandbox";
import {
  CONTACT_ROLES_SECTION,
  isSystemRequired,
  sectionsWith,
  NOT_DAYS_FIELDS,
  OTC_CHOICE_OPTIONS,
  cleanCustomFields,
  cleanCustomSections,
  cleanFieldNames,
  cleanGroupsDone,
  cleanOtcSelection,
  isContactRole,
  OTC_FIELDS,
  SELECTABLE_GROUPS,
} from "@/lib/otcFields";
import { fieldLabel, type ContractBlank } from "@/lib/contractBlanks";
import { isActive, newOtcFieldsFrom, otcTargetOf, type WorkflowField } from "@/lib/workflowFields";
import { inContractOrder } from "@/components/WorkflowFieldsSummary";
import { OtcFieldSelector } from "@/components/OtcFieldSelector";
import { ResetFinalizeButton } from "@/components/ResetFinalizeButton";
import { cleanPlaceholders, contractLines, placeholderOf, spotLabel } from "@/lib/placeholders";
import { DatePairsSelector } from "@/components/DatePairsSelector";
import { loadFieldUse } from "@/lib/fieldUse";
import { finishSelectOtcFields } from "./actions";
import { finishSelectYourDates } from "@/app/configurator/select_your_dates/actions";

// Customize Your Fields, and (mode "dates") Select Your Dates: the same
// page, the second listing only date and number fields.
export async function FieldsPage({
  searchParams,
  mode,
}: {
  searchParams: Promise<{ client?: string; group?: string }>;
  mode: "fields" | "dates";
}) {
  const dates = mode === "dates";
  const STEP_KEY = dates ? "select_your_dates" : "select_otc_fields";
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
  const { client, group: openGroup } = await searchParams;

  // Staff pick a client to see or help with theirs.
  const { data: clients } = isStaff
    ? await supabase.from("client_accounts").select("id, name").order("name")
    : { data: [] };
  const accountId = isStaff
    ? (clients ?? []).some((c) => c.id === client)
      ? client!
      : null
    : (profile?.client_account_id ?? null);

  const [{ data: saved }, { data: docs }] = accountId
    ? await Promise.all([
        supabase
          .from("client_otc_field_selections")
          .select("fields, field_names, groups_done, custom_fields, custom_sections, placeholders, numbers_not_dates, number_ties, choices_done, calc_dates")
          .eq("client_account_id", accountId)
          .maybeSingle(),
        supabase
          .from("contract_documents")
          .select("id, file_name, blanks, workflow_fields, created_at, upload_order")
          .eq("client_account_id", accountId)
          .eq("is_scanned", false)
          .order("created_at"),
      ])
    : [{ data: null }, { data: [] }];
  const selected = cleanOtcSelection(saved?.fields ?? []);

  // The fields assigned in Assign Your Fields: each OTC field and
  // where it's on the contracts (in contract order), plus fields the client
  // added there.
  const summaryDocs = (docs ?? []).map((d) => ({
    id: d.id,
    name: d.file_name.replace(/\.pdf$/i, ""),
    blanks: (Array.isArray(d.blanks) ? d.blanks : []) as ContractBlank[],
    fields: Array.isArray(d.workflow_fields) ? (d.workflow_fields as WorkflowField[]) : [],
  }));
  const assigned: Record<string, string[]> = {};
  // Each place it's on the contracts, to reassign one when it's on more
  // than one.
  const spotsOf: Record<string, { docId: string; key: string; label: string; text: string }[]> = {};

  for (const doc of summaryDocs) {
    for (const { field, first } of inContractOrder(doc)) {
      const target = otcTargetOf(field);
      if (!target) continue;
      const where = `${summaryDocs.length > 1 ? `${doc.name}, ` : ""}${
        first.line ? `line ${first.line}` : `page ${first.page}`
      }: ${fieldLabel(first)}`;
      (assigned[target] ??= []).push(where);
      (spotsOf[target] ??= []).push({
        docId: doc.id,
        key: field.id,
        label: `${doc.name} ${first.line ? `#${first.line}` : `p.${first.page}`}`,
        text: fieldLabel(first),
      });
    }
  }
  const newFields = newOtcFieldsFrom(
    summaryDocs.flatMap((d) => d.fields).filter(isActive),
  ).filter((f) => !isContactRole(f) && assigned[f.id]);
  const custom = cleanCustomFields(saved?.custom_fields);
  const names = cleanFieldNames(
    saved?.field_names,
    new Map([...OTC_FIELDS, ...newFields, ...custom].map((f) => [f.id, f.name] as const)),
  );

  // Each field's line on the contracts (for its placeholder), and OTC
  // fields that were fields they added and then pointed at them (↺ puts
  // the added field back).
  const lines = contractLines(docs ?? []);
  // Where each first is: its contract's name and line ("Purchase Agreement #134").
  const firstSpot = Object.fromEntries(
    Object.entries(lines).flatMap(([id, at]) => (spotLabel(at) ? [[id, spotLabel(at)!]] : [])),
  );
  const wasNew: Record<string, { id: string; name: string }> = {};
  for (const f of summaryDocs.flatMap((d) => d.fields).filter(isActive)) {
    const target = otcTargetOf(f);
    if (target && f.was_new) wasNew[target] = { id: f.was_new.id, name: f.was_new.name };
  }

  // Each choice field's options: Open to Close's, the ones on their
  // contracts, and the ones they've added.
  const [use, { data: org }, { data: calcs }] = accountId
    ? await Promise.all([
        loadFieldUse(supabase, accountId),
        supabase
          .from("client_field_organization")
          .select("choice_edits")
          .eq("client_account_id", accountId)
          .maybeSingle(),
        supabase
          .from("date_calculations")
          .select("otc_field, number_field, enabled, field_name, time_frame")
          .eq("client_account_id", accountId),
      ])
    : [null, { data: null }, { data: [] }];
  // Number fields: the date each is the days for, and ones that aren't
  // any date's; and dates they added in Calculate Your Dates.
  // Ties picked here count; ones Calculate Your Dates made on its own
  // (a "... Days" field and its "... Date") are suggestions.
  const suggestedDates: Record<string, string> = {};
  for (const c of calcs ?? []) if (c.enabled && c.number_field) suggestedDates[c.number_field] = c.otc_field;
  const dateOf: Record<string, string> = {};
  for (const [n, d] of Object.entries((saved?.number_ties ?? {}) as Record<string, unknown>)) {
    if (typeof d === "string") dateOf[n] = d;
  }
  // How each date's days are counted (Select Your Dates).
  const timeFrames: Record<string, string> = {};
  for (const c of calcs ?? []) if (c.time_frame) timeFrames[c.otc_field] = c.time_frame;
  const addedDates = (calcs ?? [])
    .filter((c) => c.otc_field.startsWith("new-otc:") && c.field_name)
    .map((c) => ({ id: c.otc_field, name: c.field_name! }));
  const notDates = [
    ...new Set([
      ...(Array.isArray(saved?.numbers_not_dates) ? saved.numbers_not_dates : []).filter(
        (x): x is string => typeof x === "string",
      ),
      // Year Built isn't a date's days.
      ...NOT_DAYS_FIELDS,
    ]),
  ];
  const edits = (org?.choice_edits ?? {}) as Record<string, { added?: string[]; removed?: string[] }>;
  const choices: Record<string, { defaults: string[]; contract: string[]; added: string[]; removed: string[] }> = {};
  for (const f of [...OTC_FIELDS, ...newFields]) {
    if (f.kind !== "choice") continue;
    const defaults = OTC_CHOICE_OPTIONS[f.id] ?? [];
    const seen = (t: string, list: string[]) => list.some((x) => x.toLowerCase() === t.toLowerCase());
    const contract = (use?.contractOptions[f.id] ?? []).filter((t) => !seen(t, defaults));
    const added = (Array.isArray(edits[f.id]?.added) ? edits[f.id].added! : []).filter(
      (t) => typeof t === "string" && !seen(t, [...defaults, ...contract]),
    );
    const removed = (Array.isArray(edits[f.id]?.removed) ? edits[f.id].removed! : []).filter(
      (t) => typeof t === "string",
    );
    choices[f.id] = { defaults, contract, added, removed };
  }

  // Select Your Dates: the date and number fields, in their sections, and
  // which they use (checked in Customize Your Fields).
  const pairSections = sectionsWith(cleanCustomSections(saved?.custom_sections))
    .filter((s) => s.id !== CONTACT_ROLES_SECTION)
    .map((s) => ({ id: s.id, name: s.name, group: s.group }));
  const pairFields = [
    ...OTC_FIELDS.filter((f) => f.sectionId !== CONTACT_ROLES_SECTION),
    ...newFields,
    ...custom,
  ]
    .filter((f) => f.kind === "date" || f.kind === "number")
    .map((f) => ({ id: f.id, name: f.name, sectionId: f.sectionId, kind: f.kind }));
  const selectedSet = new Set(selected);
  const inUse = (id: string) =>
    isSystemRequired(id) ||
    Boolean(assigned[id]) ||
    selectedSet.has(id) ||
    custom.some((f) => f.id === id) ||
    newFields.some((f) => f.id === id);

  const groupsDone = cleanGroupsDone(saved?.groups_done);
  const allDone = groupsDone.length === SELECTABLE_GROUPS.length;

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
              Test mode &mdash; clients check their own fields here. Changes you make are saved
              to the client you pick.
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

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-2xl font-bold text-ink">
            {step?.title ?? (dates ? "Select Your Dates" : "Customize Your Fields")}
          </h1>
          {accountId && !dates && <ResetFinalizeButton accountId={isStaff ? accountId : null} />}
        </div>
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
        ) : dates ? (
          <p className="mt-1.5 text-sm text-ink-soft">
            Here are the dates and number fields you use, each date beside the number field
            that holds its days. Check a date to have it calculated, then pick its number field.
            A number field without a date needs its date picked (or marked as not a date&rsquo;s
            days). Choose how each date&rsquo;s days are counted.
          </p>
        ) : (
          <p className="mt-1.5 text-sm text-ink-soft">
            Here are all of Open to Close&rsquo;s fields, laid out like OTC&rsquo;s Field
            Editor. The ones you assigned in Assign Your Fields are already checked.
            Check any other field
            your team needs, even if it isn&rsquo;t on your contracts; those are listed as
            fields needed. If you&rsquo;d like a field displayed under another name, type it
            in. A <span className="font-bold text-danger">*</span> marks a field Open to Close
            requires.
          </p>
        )}

        <div className="mt-6">
          {accountId && dates ? (
            <DatePairsSelector
              key={accountId}
              accountId={isStaff ? accountId : null}
              sections={pairSections}
              dates={pairFields.filter((f) => f.kind === "date" && inUse(f.id))}
              numbers={pairFields.filter((f) => f.kind === "number" && inUse(f.id))}
              allDates={[
                ...pairFields.filter((f) => f.kind === "date"),
                ...addedDates
                  .filter((d) => !pairFields.some((f) => f.id === d.id))
                  .map((d) => ({ ...d, sectionId: "" })),
              ]}
              allNumbers={pairFields.filter((f) => f.kind === "number")}
              initialTies={dateOf}
              suggestedDates={suggestedDates}
              initialNotDates={notDates}
              initialCalcDates={(Array.isArray(saved?.calc_dates) ? saved.calc_dates : []).filter(
                (x): x is string => typeof x === "string",
              )}
              timeFrames={timeFrames}
              spots={firstSpot}
              placeholders={Object.fromEntries(
                pairFields
                  .filter((f) => f.kind === "number")
                  .map((f) => [f.id, placeholderOf(f.id, lines, cleanPlaceholders(saved?.placeholders))]),
              )}
              lines={Object.fromEntries(Object.entries(lines).map(([id, at]) => [id, at.line]))}
              names={names}
              initialGroup={openGroup}
            />
          ) : accountId ? (
            <OtcFieldSelector
              key={accountId}
              accountId={isStaff ? accountId : null}
              initial={{ fields: selected, names, groupsDone, custom }}
              initialGroup={openGroup}
              showSummary={isStaff}
              customSections={cleanCustomSections(saved?.custom_sections)}
              assigned={assigned}
              firstSpot={firstSpot}
              spotsOf={spotsOf}
              newFields={newFields}
              lines={lines}
              savedPlaceholders={cleanPlaceholders(saved?.placeholders)}
              wasNew={wasNew}
              choices={choices}
              choicesDone={(Array.isArray(saved?.choices_done) ? saved.choices_done : []).filter(
                (x): x is string => typeof x === "string",
              )}
              dateOf={dateOf}
              suggestedDates={suggestedDates}
              addedDates={addedDates}
              notDates={notDates}
              mode={mode}
              timeFrames={timeFrames}
            />
          ) : (
            <p className="rounded-xl border border-border bg-surface p-6 text-sm text-ink-soft">
              {isStaff
                ? "Choose a client above to see their fields."
                : "Your account isn't set up yet."}
            </p>
          )}
        </div>

        {!isStaff && accountId && dates && (
          <form action={finishSelectYourDates} className="mt-8 flex flex-col items-center gap-2">
            <button
              type="submit"
              className="rounded-lg bg-accent px-8 py-2.5 text-sm font-semibold text-white"
            >
              I&rsquo;m Done Selecting Dates
            </button>
          </form>
        )}
        {!isStaff && accountId && !dates && (
          <form action={finishSelectOtcFields} className="mt-8 flex flex-col items-center gap-2">
            <button
              type="submit"
              disabled={!allDone}
              className="rounded-lg bg-accent px-8 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              I&rsquo;m Done Selecting Fields
            </button>
            {!allDone && (
              <span className="text-xs text-ink-faint">
                Click &ldquo;Done with&rdquo; at the bottom of each field group when you&rsquo;ve
                gone through it ({groupsDone.length} of {SELECTABLE_GROUPS.length} done).
              </span>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
