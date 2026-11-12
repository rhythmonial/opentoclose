"use client";

import { useState } from "react";
import { ToolsQuestions } from "@/components/ToolsQuestions";
import { OwnerGuruFields } from "@/components/OwnerGuruFields";
import { StatesServicedField } from "@/components/StatesServicedField";
import { PlanChoice } from "@/components/PlanChoice";
import { normalizeStateName } from "@/lib/usStates";
import { COMPANY_STRUCTURES, currentStructure } from "@/lib/companyStructures";
import type { Tables } from "@/lib/supabase/types";

const INPUT =
  "rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent";

// The setup details, inside a 2-column grid form.
// - signup: the founders-form basics (business, states, current software,
//   decision maker) plus `afterOwner` (the password).
// - initiate (Initiate Your Setup): staying on the monthly membership (DIY)
//   or electing a Setup. DIY answers only what sign-up didn't ask (email
//   provider, e-sign platform); Setup answers everything, with their Open
//   to Close login.
export function SetupDetailsFields({
  mode,
  existing,
  accountName,
  email,
  defaultEngagementType = "diy",
  afterOwner,
  setupPrice,
}: {
  mode: "signup" | "initiate";
  existing: Tables<"setup_initiation"> | null;
  accountName: string;
  email: string;
  defaultEngagementType?: "diy" | "custom";
  afterOwner?: React.ReactNode;
  setupPrice?: string;
}) {
  const [plan, setPlan] = useState(defaultEngagementType);
  const showBasics = mode === "signup" || plan === "custom";

  const basics = (
    <>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink">Company Structure</span>
        <select
          name="company_structure"
          required
          defaultValue={currentStructure(existing?.company_structure)}
          className={INPUT}
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
        <span className="text-sm font-medium text-ink">Business, Brokerage, or Team Name</span>
        <input
          name="business_name"
          required
          defaultValue={existing?.business_name ?? accountName}
          className={INPUT}
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
        defaultPriorityState={normalizeStateName(existing?.priority_state ?? "")}
      />
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink">Transaction Management Software</span>
        <input
          name="tms"
          required
          defaultValue={existing?.tms ?? ""}
          placeholder="e.g. Open to Close, AFrame, TcDocs"
          className={INPUT}
        />
      </label>
      <OwnerGuruFields
        defaultOwner={{
          first: existing?.first_name ?? "",
          last: existing?.last_name ?? "",
          cell: existing?.cell_phone ?? "",
          email: existing?.email ?? email,
        }}
      />
      {afterOwner}
    </>
  );

  if (mode === "signup") return basics;

  return (
    <>
      <h2 className="text-center text-[15px] font-bold text-ink sm:col-span-2">Your OTC Setup</h2>
      <PlanChoice
        defaultPlan={defaultEngagementType}
        onPlanChange={setPlan}
        setupPrice={setupPrice}
        defaultOtcUsername={existing?.otc_username ?? ""}
        otcPasswordSaved={existing?.otc_password_set ?? false}
      />
      <hr className="my-2 border-border sm:col-span-2" />
      <ToolsQuestions
        showTms={false}
        defaultEsign={existing?.esign_platform ?? ""}
        defaultEsignOther={existing?.esign_other ?? ""}
        defaultTms=""
        defaultEmailProvider={existing?.email_provider ?? ""}
      />
      {showBasics && (
        <>
          <hr className="my-2 border-border sm:col-span-2" />
          <h2 className="text-[15px] font-bold text-ink sm:col-span-2">Your business</h2>
          {basics}
        </>
      )}
    </>
  );
}
