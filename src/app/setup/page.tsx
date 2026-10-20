import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ToolsChecklist } from "@/components/ToolsChecklist";
import { StatesServicedField } from "@/components/StatesServicedField";
import { normalizeStateName } from "@/lib/usStates";
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
  searchParams: Promise<{ error?: string; plan?: string }>;
}) {
  const { error, plan } = await searchParams;
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
      .select("role, client_account_id")
      .eq("id", user.id)
      .single(),
    supabase
      .from("setup_initiation")
      .select("*")
      .eq("client_id", user.id)
      .maybeSingle(),
  ]);

  const isStaff = profile?.role === "dev" || profile?.role === "dev_admin";

  const { data: account } = profile?.client_account_id
    ? await supabase
        .from("client_accounts")
        .select("name")
        .eq("id", profile.client_account_id)
        .single()
    : { data: null };

  const isUpdate = Boolean(existing);
  const defaultEngagementType =
    existing?.engagement_type ?? (plan === "diy" ? "diy" : "custom");

  return (
    <main className="flex flex-1 items-center justify-center bg-bg px-4 py-12">
      <div className="w-full max-w-2xl">
        <Link
          href={isStaff ? "/dashboard/tasks" : "/home"}
          className="text-sm font-medium text-accent"
        >
          &larr; {isStaff ? "Back to editor" : "Back to your dashboard"}
        </Link>

        {isStaff && (
          <div className="mt-4 rounded-lg border border-accent-soft bg-accent-soft/40 px-4 py-2.5 text-sm font-semibold text-accent">
            Previewing this step the way a client sees it &mdash; actions
            are disabled here.
          </div>
        )}

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
          className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2"
        >
        <fieldset disabled={isStaff} className="contents">
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
          <div className="sm:col-span-2 flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">
              How would you like your setup handled?
            </span>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex cursor-pointer flex-col gap-1 rounded-lg border border-border bg-surface px-3.5 py-3 has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
                <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <input
                    type="radio"
                    name="engagement_type"
                    value="custom"
                    defaultChecked={defaultEngagementType === "custom"}
                    className="h-4 w-4"
                  />
                  Setup ($999)
                </span>
                <span className="text-xs text-ink-soft">
                  Our team builds the steps assigned to us. A 10-hour bundle.
                </span>
              </label>
              <label className="flex cursor-pointer flex-col gap-1 rounded-lg border border-border bg-surface px-3.5 py-3 has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
                <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <input
                    type="radio"
                    name="engagement_type"
                    value="diy"
                    defaultChecked={defaultEngagementType === "diy"}
                    className="h-4 w-4"
                  />
                  DIY ($19)
                </span>
                <span className="text-xs text-ink-soft">
                  You complete every step yourself, using our checklist and
                  videos as your guide. You can upgrade to Setup later.
                </span>
              </label>
            </div>
          </div>
          <div className="sm:col-span-2">
            <StatesServicedField
              defaultStates={
                existing?.states_serviced
                  ? existing.states_serviced
                      .split(",")
                      .map((s) => normalizeStateName(s.trim()))
                      .filter(Boolean)
                  : []
              }
              defaultPriorityState={normalizeStateName(
                existing?.priority_state ?? "",
              )}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:col-span-2 sm:grid-cols-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink">
                # of under contract
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
                # of closed this month
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
          <div className="sm:col-span-2 flex flex-col gap-1.5">
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
            className="mt-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2"
          >
            {isUpdate ? "Save changes" : "Submit"}
          </button>
        </fieldset>
        </form>
      </div>
    </main>
  );
}
