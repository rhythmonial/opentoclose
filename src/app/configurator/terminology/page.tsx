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

  let { data: terms } = await supabase
    .from("terminology")
    .select("*")
    .eq("client_id", user.id)
    .order("sort_order");

  if (!terms || terms.length === 0) {
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

    terms = seeded;
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-bg px-4 py-12">
      <div className="w-full max-w-2xl">
        <Link href="/portal" className="text-sm font-medium text-accent">
          &larr; Back to your setup
        </Link>

        <h1 className="mt-3 font-display text-2xl font-bold text-ink">
          Set Your Terminology
        </h1>
        <p className="mt-1.5 text-sm text-ink-soft">
          OTC uses its own vocabulary for a lot of things. Tell us which terms
          apply to your business, and what you call them instead, so your
          templates and training match how your team actually talks.
        </p>

        <form action={saveTerminology} className="mt-6 flex flex-col gap-3">
          {(terms ?? []).map((term) => (
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
                className="w-56 rounded-lg border border-border bg-bg px-3 py-1.5 text-sm text-ink outline-none focus:border-accent"
              />
            </div>
          ))}

          <button
            type="submit"
            className="mt-2 self-start rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white"
          >
            Save
          </button>
        </form>
      </div>
    </main>
  );
}
