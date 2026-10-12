"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addStep(formData: FormData) {
  const supabase = await createClient();

  await supabase.from("setup_steps").insert({
    path: String(formData.get("path")) as "custom" | "express",
    section: String(formData.get("section")),
    key: String(formData.get("key")),
    title: String(formData.get("title")),
    description: String(formData.get("description") ?? "") || null,
    step_type: String(formData.get("step_type")) as
      | "video"
      | "configurator"
      | "download"
      | "external_link"
      | "form",
    sort_order: Number(formData.get("sort_order") ?? 0),
  });

  revalidatePath("/profile");
}

export async function updateStep(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));

  await supabase
    .from("setup_steps")
    .update({
      section: String(formData.get("section")),
      title: String(formData.get("title")),
      description: String(formData.get("description") ?? "") || null,
      step_type: String(formData.get("step_type")) as
        | "video"
        | "configurator"
        | "download"
        | "external_link"
        | "form",
      sort_order: Number(formData.get("sort_order") ?? 0),
    })
    .eq("id", id);

  revalidatePath("/profile");
  revalidatePath("/portal");
}

export async function deleteStep(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));

  await supabase.from("setup_steps").delete().eq("id", id);

  revalidatePath("/profile");
  revalidatePath("/portal");
}
