import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { saveTerminology } from "./actions";

const DEFAULT_TERMS = [
  "Transaction",
  "Property",
  "Client Type (Buyer/Seller)",
  "Contract Status",
  "Closing Date",
  "File Role",
  "Document Template",
  "Task Template",
  "Workflow Field",
  "Smart Block",
];

export default async function TerminologyConfiguratorPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isStaff = profile?.role === "dev" || profile?.role === "dev_admin";

  let terms: { id: string; our_term: string; your_term: string | null; applies: boolean }[] =
    [];

  if (isStaff) {
    terms = DEFAULT_TERMS.map((term, i) => ({
      id: `preview-${i}`,
      our_term: term,
      your_term: null,
      applies: true,
    }));
  } else {
    const { data: existingTerms } = await supabase
      .from("terminology")
      .select("*")
      .eq("client_id", user.id)
      .order("sort_order");

    if (!existingTerms || existingTerms.length === 0) {
      await supabase.from("terminology").insert(
        DEFAULT_TERMS.map((term, i) => ({
          client_id: user.id,
          our_term: term,
          applies: true,
          sort_order: i,
        })),
      );

      const { data: seeded } = await supabase
        .from("terminology")
        .select("*")
        .eq("client_id", user.id)
        .order("sort_order");

      terms = seeded ?? [];
    } else {
      terms = existingTerms;
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-bg px-4 py-12">
      <div className="w-full max-w-2xl">
        <Link
          href={isStaff ? "/dashboard/tasks" : "/portal"}
          className="text-sm font-medium text-accent"
        >
          &larr; {isStaff ? "Back to editor" : "Back to your setup"}
        </Link>

        {isStaff && (
          <div className="mt-4 rounded-lg border border-accent-soft bg-accent-soft/40 px-4 py-2.5 text-sm font-semibold text-accent">
            Previewing this step the way a client sees it &mdash; actions
            are disabled here.
          </div>
        )}

        <h1 className="mt-3 font-display text-2xl font-bold text-ink">
          Set Your Terminology
        </h1>
        <p className="mt-1.5 text-sm text-ink-soft">
          OTC uses its own vocabulary for a lot of things. Tell us which terms
          apply to your business, and what you call them instead, so your
          templates and training match how your team actually talks.
        </p>

        <form action={saveTerminology} className="mt-6 flex flex-col gap-3">
          {terms.map((term) => (
            <div
              key={term.id}
              className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface p-4"
            >
              <input type="hidden" name="id" value={term.id} />
              <label className="flex flex-1 items-center gap-2.5">
                <input
                  type="checkbox"
                  name={`applies_${term.id}`}
                  defaultChecked={term.applies}
                  disabled={isStaff}
                  className="h-4 w-4"
                />
                <span className="text-sm font-bold text-ink">
                  {term.our_term}
                </span>
              </label>
              <input
                name={`your_term_${term.id}`}
                defaultValue={term.your_term ?? ""}
                placeholder="Same as ours"
                disabled={isStaff}
                className="w-56 rounded-lg border border-border bg-bg px-3 py-1.5 text-sm text-ink outline-none focus:border-accent disabled:bg-border-soft"
              />
            </div>
          ))}

          {!isStaff && (
            <button
              type="submit"
              className="mt-2 self-start rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white"
            >
              Save
            </button>
          )}
        </form>
      </div>
    </main>
  );
}
