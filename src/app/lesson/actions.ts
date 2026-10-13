"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function toggleLessonComplete(formData: FormData) {
  const stepId = String(formData.get("step_id") ?? "");
  const currentlyApproved = formData.get("currently_approved") === "true";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await supabase.from("client_step_status").upsert(
    {
      client_id: user.id,
      step_id: stepId,
      status: currentlyApproved ? "not_started" : "approved",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "client_id,step_id" },
  );

  revalidatePath(`/lesson/${stepId}`);
  revalidatePath("/portal");
}
