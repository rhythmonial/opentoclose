"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addStep(formData: FormData) {
  const supabase = await createClient();

  await supabase.from("setup_steps").insert({
    path: String(formData.get("path")) as "custom" | "express",
    phase: String(formData.get("phase") ?? "") || null,
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
    completed_by: String(formData.get("completed_by") ?? "client"),
    is_optional: formData.get("is_optional") === "on",
    resource_url: String(formData.get("resource_url") ?? "") || null,
  });

  revalidatePath("/profile");
  revalidatePath("/resources");
}

export async function updateStep(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));

  await supabase
    .from("setup_steps")
    .update({
      phase: String(formData.get("phase") ?? "") || null,
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
      completed_by: String(formData.get("completed_by") ?? "client"),
      is_optional: formData.get("is_optional") === "on",
      resource_url: String(formData.get("resource_url") ?? "") || null,
    })
    .eq("id", id);

  revalidatePath("/profile");
  revalidatePath("/portal");
  revalidatePath("/resources");
}

export async function deleteStep(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));

  await supabase.from("setup_steps").delete().eq("id", id);

  revalidatePath("/profile");
  revalidatePath("/portal");
  revalidatePath("/resources");
}
