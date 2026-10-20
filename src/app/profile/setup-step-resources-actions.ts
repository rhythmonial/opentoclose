"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function revalidateAll() {
  revalidatePath("/profile");
  revalidatePath("/portal");
  revalidatePath("/home");
  revalidatePath("/resources");
}

export async function addResource(
  stepId: string,
  data: { kind: string; label: string; url: string },
) {
  const supabase = await createClient();

  const { count } = await supabase
    .from("setup_step_resources")
    .select("id", { count: "exact", head: true })
    .eq("step_id", stepId);

  const { data: row, error } = await supabase
    .from("setup_step_resources")
    .insert({
      step_id: stepId,
      kind: data.kind,
      label: data.label || null,
      url: data.url,
      sort_order: count ?? 0,
    })
    .select()
    .single();

  revalidateAll();

  if (error || !row) {
    throw new Error(error?.message ?? "Failed to add resource");
  }

  return row;
}

export async function updateResource(
  id: string,
  data: { kind: string; label: string; url: string },
) {
  const supabase = await createClient();
  await supabase
    .from("setup_step_resources")
    .update({ kind: data.kind, label: data.label || null, url: data.url })
    .eq("id", id);

  revalidateAll();
}

export async function deleteResource(id: string) {
  const supabase = await createClient();
  await supabase.from("setup_step_resources").delete().eq("id", id);

  revalidateAll();
}

export async function reorderResources(stepId: string, orderedIds: string[]) {
  const supabase = await createClient();
  await Promise.all(
    orderedIds.map((id, index) =>
      supabase
        .from("setup_step_resources")
        .update({ sort_order: index })
        .eq("id", id)
        .eq("step_id", stepId),
    ),
  );

  revalidateAll();
}
