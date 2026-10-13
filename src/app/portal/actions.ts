"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requestUpgrade() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await supabase
    .from("setup_initiation")
    .update({ upgrade_requested_at: new Date().toISOString() })
    .eq("client_id", user.id);

  revalidatePath("/portal");
}
