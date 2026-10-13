import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ToolsChecklist } from "@/components/ToolsChecklist";
import { StatesServicedField } from "@/components/StatesServicedField";
import { submitSetupInitiation } from "./actions";

const COMPANY_STRUCTURES = [
  "Brokerage",
  "RE Team",
  "TC Team",
  "Individual TC",
  "Individual",
];

export default async function SetupInitiationPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: profile }, { data: existing }] = await Promise.all([
    supabase
      .from("profiles")
      .select("client_account_id")
      .eq("id", user.id)
      .single(),
    supabase
      .from("setup_initiation")
      .select("*")
      .eq("client_id", user.id)
      .maybeSingle(),
  ]);

  const { data: account } = profile?.client_account_id
    ? await supabase
        .from("client_accounts")
        .select("name")
        .eq("id", profile.client_account_id)
        .single()
    : { data: null };

  const isUpdate = Boolean(existing);

  return (
    <main className="flex flex-1 items-center justify-center bg-bg px-4 py-12">
      <div className="w-full max-w-2xl">
        <Link href="/portal" className="text-sm font-medium text-accent">
          &larr; Back to your setup
        </Link>

        <h1 className="mt-3 font-display text-2xl font-bold text-ink">
          {isUpdate ? "Update your setup initiation details" : "Setup Initiation"}
        </h1>
        <p className="mt-1.5 text-sm text-ink-soft">
          Tell us about your business so we can get your setup started.
        </p>

        {error && (
          <div className="mt-5 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        <form
          action={submitSetupInitiation}
          className="mt-6 grid grid-cols-2 gap-4"
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">First name</span>
            <input
              name="first_name"
              required
              defaultValue={existing?.first_name ?? ""}
              className="rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">Last name</span>
            <input
              name="last_name"
              required
              defaultValue={existing?.last_name ?? ""}
              className="rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">Cell phone</span>
            <input
              name="cell_phone"
              type="tel"
              required
              defaultValue={existing?.cell_phone ?? ""}
              className="rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">Email</span>
            <input
              name="email"
              type="email"
              required
              defaultValue={existing?.email ?? user.email ?? ""}
              className="rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">
              Business, Brokerage, or Team Name
            </span>
            <input
              name="business_name"
              required
              defaultValue={existing?.business_name ?? account?.name ?? ""}
              className="rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">
              Company Structure
            </span>
            <select
              name="company_structure"
              required
              defaultValue={existing?.company_structure ?? ""}
              className="rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent"
            >
              <option value="" disabled>
                Select one
              </option>
              {COMPANY_STRUCTURES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <div className="col-span-2">
            <StatesServicedField
              defaultStates={
                existing?.states_serviced
                  ? existing.states_serviced
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean)
                  : []
              }
              defaultPriorityState={existing?.priority_state ?? ""}
            />
          </div>
          <div className="col-span-2 grid grid-cols-3 gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink">
                # of transactions under contract
              </span>
              <input
                name="transactions_under_contract"
                type="number"
                min={0}
                defaultValue={existing?.transactions_under_contract ?? ""}
                className="rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink">
                # of transactions closed per month
              </span>
              <input
                name="transactions_per_month"
                type="number"
                min={0}
                defaultValue={existing?.transactions_per_month ?? ""}
                className="rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink">
                # of TCs on your team
              </span>
              <input
                name="tc_count"
                type="number"
                min={0}
                defaultValue={existing?.tc_count ?? ""}
                className="rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent"
              />
            </label>
          </div>
          <div className="col-span-2 flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">
              What tools/systems/platforms are you currently using for
              Transaction Management?
            </span>
            <ToolsChecklist
              defaultValues={existing?.tools_used ?? []}
              defaultOther={existing?.tools_other ?? ""}
            />
          </div>

          <button
            type="submit"
            className="col-span-2 mt-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white"
          >
            {isUpdate ? "Save changes" : "Submit"}
          </button>
        </form>
      </div>
    </main>
  );
}
