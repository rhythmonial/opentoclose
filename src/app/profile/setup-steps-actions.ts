"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function revalidateAll() {
  revalidatePath("/profile");
  revalidatePath("/portal");
  revalidatePath("/resources");
  revalidatePath("/dashboard/clients", "layout");
}

export async function addStep(formData: FormData) {
  const supabase = await createClient();
  const path = String(formData.get("path")) as "custom" | "express";

  const { data: maxRow } = await supabase
    .from("setup_steps")
    .select("sort_order")
    .eq("path", path)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  await supabase.from("setup_steps").insert({
    path,
    phase: String(formData.get("phase") ?? "") || null,
    section: String(formData.get("section")),
    key: String(formData.get("key")),
    title: String(formData.get("title")),
    description: String(formData.get("description") ?? "") || null,
    step_type: String(formData.get("step_type")) as
      | "lesson"
      | "form"
      | "link"
      | "configurator",
    sort_order: (maxRow?.sort_order ?? 0) + 1,
    completed_by: String(formData.get("completed_by") ?? "client"),
    is_optional: formData.get("is_optional") === "on",
    video_url: String(formData.get("video_url") ?? "").trim() || null,
    link_url: String(formData.get("link_url") ?? "").trim() || null,
  });

  revalidateAll();
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
        | "lesson"
        | "form"
        | "link"
        | "configurator",
      is_optional: formData.get("is_optional") === "on",
      video_url: String(formData.get("video_url") ?? "").trim() || null,
      link_url: String(formData.get("link_url") ?? "").trim() || null,
    })
    .eq("id", id);

  revalidateAll();
}

export async function updateStepCompletedBy(stepId: string, value: string) {
  const supabase = await createClient();
  await supabase
    .from("setup_steps")
    .update({ completed_by: value })
    .eq("id", stepId);

  revalidateAll();
}

export async function reorderSteps(stepIds: string[]) {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("setup_steps")
    .select("id, sort_order")
    .in("id", stepIds);

  const sortedValues = (rows ?? [])
    .map((r) => r.sort_order)
    .sort((a, b) => a - b);

  await Promise.all(
    stepIds.map((id, index) =>
      supabase
        .from("setup_steps")
        .update({ sort_order: sortedValues[index] })
        .eq("id", id),
    ),
  );

  revalidateAll();
}

export async function deleteStep(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));

  await supabase.from("setup_steps").delete().eq("id", id);

  revalidateAll();
}
