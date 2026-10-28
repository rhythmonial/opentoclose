"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function revalidateAll() {
  revalidatePath("/dashboard/tasks");
  revalidatePath("/portal");
  revalidatePath("/home");
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
    completed_by: String(formData.get("completed_by") ?? "diy"),
    is_optional: formData.get("is_optional") === "on",
    is_future_build: formData.get("is_future_build") === "on",
    video_url: String(formData.get("video_url") ?? "").trim() || null,
    link_url: String(formData.get("link_url") ?? "").trim() || null,
    estimated_hours: parseHours(formData.get("estimated_hours")),
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
      instructions: String(formData.get("instructions") ?? "") || null,
      step_type: String(formData.get("step_type")) as
        | "lesson"
        | "form"
        | "link"
        | "configurator",
      video_url: String(formData.get("video_url") ?? "").trim() || null,
      link_url: String(formData.get("link_url") ?? "").trim() || null,
      estimated_hours: parseHours(formData.get("estimated_hours")),
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

export async function updateStepIsOptional(stepId: string, value: boolean) {
  const supabase = await createClient();
  await supabase
    .from("setup_steps")
    .update({ is_optional: value })
    .eq("id", stepId);

  revalidateAll();
}

export async function updateStepIsFutureBuild(stepId: string, value: boolean) {
  const supabase = await createClient();
  await supabase
    .from("setup_steps")
    .update({ is_future_build: value })
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

export async function deletePillar(formData: FormData) {
  const supabase = await createClient();
  const path = String(formData.get("path")) as "custom" | "express";
  const phase = String(formData.get("phase") ?? "");

  const query = supabase.from("setup_steps").delete().eq("path", path);
  await (phase ? query.eq("phase", phase) : query.is("phase", null));

  revalidateAll();
}

export async function deleteSection(formData: FormData) {
  const supabase = await createClient();
  const path = String(formData.get("path")) as "custom" | "express";
  const phase = String(formData.get("phase") ?? "");
  const section = String(formData.get("section"));

  const query = supabase
    .from("setup_steps")
    .delete()
    .eq("path", path)
    .eq("section", section);
  await (phase ? query.eq("phase", phase) : query.is("phase", null));

  revalidateAll();
}

export async function deleteStep(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));

  await supabase.from("setup_steps").delete().eq("id", id);

  revalidateAll();
}

function parseHours(value: FormDataEntryValue | null) {
  const hours = Number(value);
  return Number.isFinite(hours) && hours > 0 ? hours : null;
}

export async function updateHourlyRate(formData: FormData) {
  const rate = Number(formData.get("hourly_rate"));
  if (!Number.isFinite(rate) || rate <= 0) return;

  const supabase = await createClient();
  await supabase.from("app_settings").upsert({
    key: "hourly_rate",
    value: String(rate),
    updated_at: new Date().toISOString(),
  });

  revalidatePath("/dashboard/tasks");
}

export async function moveSection(formData: FormData) {
  const supabase = await createClient();
  const path = String(formData.get("path")) as "custom" | "express";
  const fromPhase = String(formData.get("from_phase") ?? "");
  const toPhase = String(formData.get("to_phase") ?? "");
  const section = String(formData.get("section"));
  if (fromPhase === toPhase) return;

  const { data: rows } = await supabase
    .from("setup_steps")
    .select("id, phase, section, sort_order")
    .eq("path", path)
    .order("sort_order");
  if (!rows) return;

  const isMoving = (r: (typeof rows)[number]) =>
    (r.phase ?? "") === fromPhase && r.section === section;
  const moving = rows.filter(isMoving);
  if (moving.length === 0) return;
  const rest = rows.filter((r) => !isMoving(r));

  // Pillars are ordered by their steps' sort_order, so the moved section
  // goes to the end of the target pillar and everything is renumbered.
  let insertAt = rest.length;
  for (let i = rest.length - 1; i >= 0; i--) {
    if ((rest[i].phase ?? "") === toPhase) {
      insertAt = i + 1;
      break;
    }
  }
  const ordered = [
    ...rest.slice(0, insertAt),
    ...moving,
    ...rest.slice(insertAt),
  ];
  const sortValues = rows.map((r) => r.sort_order).sort((a, b) => a - b);
  const movingIds = new Set(moving.map((r) => r.id));

  await Promise.all(
    ordered.flatMap((row, index) => {
      const sortOrder = sortValues[index];
      const phaseChanged = movingIds.has(row.id);
      if (!phaseChanged && row.sort_order === sortOrder) return [];
      return [
        supabase
          .from("setup_steps")
          .update({
            sort_order: sortOrder,
            ...(phaseChanged ? { phase: toPhase || null } : {}),
          })
          .eq("id", row.id),
      ];
    }),
  );

  revalidateAll();
}
