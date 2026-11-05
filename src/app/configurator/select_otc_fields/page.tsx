import { redirect } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { createClient } from "@/lib/supabase/server";
import { getSandboxTier } from "@/lib/devSandbox";
import {
  cleanFieldNames,
  cleanGroupsDone,
  cleanOtcSelection,
  SELECTABLE_GROUPS,
} from "@/lib/otcFields";
import { OtcFieldSelector } from "@/components/OtcFieldSelector";
import { finishSelectOtcFields } from "./actions";

const STEP_KEY = "select_otc_fields";

export default async function SelectOtcFieldsPage({
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

  const { data: saved } = accountId
    ? await supabase
        .from("client_otc_field_selections")
        .select("fields, field_names, groups_done")
        .eq("client_account_id", accountId)
        .maybeSingle()
    : { data: null };
  const selected = cleanOtcSelection(saved?.fields ?? []);
  const names = cleanFieldNames(saved?.field_names, selected);
  const groupsDone = cleanGroupsDone(saved?.groups_done);
  const allDone = groupsDone.length === SELECTABLE_GROUPS.length;

  return (
    <main className="flex flex-1 justify-center bg-bg px-4 py-12">
      <div className="w-full max-w-4xl">
        <Link
          href={isStaff && !sandboxTier ? "/dashboard/tasks" : "/portal"}
          className="text-sm font-medium text-accent"
        >
          &larr; {isStaff && !sandboxTier ? "Back to editor" : "Back to your setup"}
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

        <h1 className="mt-3 font-display text-2xl font-bold text-ink">
          {step?.title ?? "Select OTC Fields"}
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
            These are the fields Open to Close comes with, laid out like OTC&rsquo;s Field
            Editor. Go through each field group, check every field your team tracks on a
            transaction, and if you call it something else, type your name for it. Check off
            each group when you&rsquo;re done with it. Don&rsquo;t worry about getting it
            perfect: you can add fields of your own later, when you assign the fields on your
            contracts.
          </p>
        )}

        <div className="mt-6">
          {accountId ? (
            <OtcFieldSelector
              key={accountId}
              accountId={isStaff ? accountId : null}
              initial={{ fields: selected, names, groupsDone }}
            />
          ) : (
            <p className="rounded-xl border border-border bg-surface p-6 text-sm text-ink-soft">
              {isStaff
                ? "Choose a client above to see their fields."
                : "Your account isn't set up yet."}
            </p>
          )}
        </div>

        {!isStaff && accountId && (
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
                Check off each field group when you&rsquo;ve gone through it (
                {groupsDone.length} of {SELECTABLE_GROUPS.length} done).
              </span>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
