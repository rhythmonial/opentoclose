"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { saveInitiationAndContinue } from "@/lib/setupDetails";
import { getSandboxTier } from "@/lib/devSandbox";
import { progressOwnerId } from "@/lib/accountOwner";

export async function submitSetupInitiation(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Teammates share the owner's progress, setup form and plan.
  const accountUserId = await progressOwnerId(supabase, user.id);

  const { data: actor } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  // Staff use the form in test mode: nothing is saved and there's no
  // checkout. In a sandbox, the step is ticked off in that sandbox.
  if (actor?.role === "dev" || actor?.role === "dev_admin") {
    const tier = await getSandboxTier();
    if (tier) {
      const { data: step } = await supabase
        .from("setup_steps")
        .select("id")
        .eq("key", "setup_initiation")
        .limit(1)
        .maybeSingle();
      if (step) {
        await supabase.from("dev_sandbox_step_status").upsert(
          {
            tier,
            step_id: step.id,
            status: "approved",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "tier,step_id" },
        );
      }
    }
    const tested = formData.get("engagement_type") === "diy" ? "diy" : "setup";
    redirect(`/setup?tested=${tested}`);
  }

  await saveInitiationAndContinue(supabase, user, accountUserId, formData, "/setup");
}
