import { ToolsQuestions } from "@/components/ToolsQuestions";
import { OwnerGuruFields } from "@/components/OwnerGuruFields";
import { StatesServicedField } from "@/components/StatesServicedField";
import { PlanChoice } from "@/components/PlanChoice";
import { normalizeStateName } from "@/lib/usStates";
import { COMPANY_STRUCTURES, currentStructure } from "@/lib/companyStructures";
import type { Tables } from "@/lib/supabase/types";

// The setup details form's fields (business, states, tools, decision maker,
// plan and OTC login), shared by sign-up and /setup. Goes inside a 2-column
// grid form.
export function SetupDetailsFields({
  existing,
  accountName,
  email,
  defaultEngagementType,
  freeOffer,
  afterOwner,
}: {
  existing: Tables<"setup_initiation"> | null;
  accountName: string;
  email: string;
  defaultEngagementType: "diy" | "custom";
  freeOffer: { label: string; started: boolean } | null;
  // Shown right after the decision maker (sign-up's password).
  afterOwner?: React.ReactNode;
}) {
  return (
    <>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink">
          Company Structure
        </span>
        <select
          name="company_structure"
          required
          defaultValue={currentStructure(existing?.company_structure)}
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
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink">
          Business, Brokerage, or Team Name
        </span>
        <input
          name="business_name"
          required
          defaultValue={existing?.business_name ?? accountName}
          className="rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent"
        />
      </label>

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
      <ToolsQuestions
        defaultEsign={existing?.esign_platform ?? ""}
        defaultEsignOther={existing?.esign_other ?? ""}
        defaultTms={existing?.tms ?? ""}
        defaultEmailProvider={existing?.email_provider ?? ""}
      />

      <OwnerGuruFields
        defaultOwner={{
          first: existing?.first_name ?? "",
          last: existing?.last_name ?? "",
          cell: existing?.cell_phone ?? "",
          email: existing?.email ?? email,
        }}
      />
      {afterOwner}

      <hr className="my-2 border-border sm:col-span-2" />
      <h2 className="text-center text-[15px] font-bold text-ink sm:col-span-2">
        Your OTC Setup
      </h2>
      <PlanChoice
        defaultPlan={defaultEngagementType}
        freeOffer={freeOffer}
        defaultOtcUsername={existing?.otc_username ?? ""}
        otcPasswordSaved={existing?.otc_password_set ?? false}
      />
    </>
  );
}
