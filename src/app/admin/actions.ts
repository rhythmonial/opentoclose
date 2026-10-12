"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function runLegacyCleanup() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("run_legacy_cleanup");

  if (error) {
    redirect(`/admin?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/admin?result=${encodeURIComponent(data ?? "Done.")}`);
}
