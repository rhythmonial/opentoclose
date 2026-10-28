"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { TablesUpdate } from "@/lib/supabase/types";

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

  // Only fields present on the edit form are written, so fields edited
  // elsewhere (title via rename, pillar/section via move) aren't blanked.
  const text = (key: string) => String(formData.get(key) ?? "").trim() || null;
  const update: TablesUpdate<"setup_steps"> = {};
  if (formData.has("step_type")) {
    update.step_type = String(formData.get("step_type")) as NonNullable<
      TablesUpdate<"setup_steps">["step_type"]
    >;
  }
  if (formData.has("description")) update.description = text("description");
  if (formData.has("instructions")) update.instructions = text("instructions");
  if (formData.has("video_url")) update.video_url = text("video_url");
  if (formData.has("link_url")) update.link_url = text("link_url");
  if (formData.has("title")) update.title = String(formData.get("title"));
  if (formData.has("phase")) update.phase = text("phase");
  if (formData.has("section")) update.section = String(formData.get("section"));
  if (formData.has("estimated_hours")) {
    update.estimated_hours = parseHours(formData.get("estimated_hours"));
  }

  await supabase.from("setup_steps").update(update).eq("id", id);

  revalidateAll();
}

export async function renameStep(stepId: string, newTitle: string) {
  const title = newTitle.trim();
  if (!title) return;

  const supabase = await createClient();
  await supabase.from("setup_steps").update({ title }).eq("id", stepId);

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

export async function movePillar(formData: FormData) {
  const supabase = await createClient();
  const path = String(formData.get("path")) as "custom" | "express";
  const phase = String(formData.get("phase") ?? "");
  const direction = formData.get("direction") === "up" ? -1 : 1;

  const { data: rows } = await supabase
    .from("setup_steps")
    .select("id, phase, sort_order")
    .eq("path", path)
    .order("sort_order");
  if (!rows) return;

  // Pillars appear in the order of their first step; swap this pillar's
  // block of steps with its neighbor's and renumber.
  const pillars: string[] = [];
  const stepsByPillar = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = row.phase ?? "";
    if (!stepsByPillar.has(key)) {
      pillars.push(key);
      stepsByPillar.set(key, []);
    }
    stepsByPillar.get(key)!.push(row);
  }

  const from = pillars.indexOf(phase);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= pillars.length) return;
  [pillars[from], pillars[to]] = [pillars[to], pillars[from]];

  const ordered = pillars.flatMap((p) => stepsByPillar.get(p)!);
  const sortValues = rows.map((r) => r.sort_order).sort((a, b) => a - b);

  await Promise.all(
    ordered.flatMap((row, index) =>
      row.sort_order === sortValues[index]
        ? []
        : [
            supabase
              .from("setup_steps")
              .update({ sort_order: sortValues[index] })
              .eq("id", row.id),
          ],
    ),
  );

  revalidateAll();
}

export async function moveSectionOrder(formData: FormData) {
  const supabase = await createClient();
  const path = String(formData.get("path")) as "custom" | "express";
  const phase = String(formData.get("phase") ?? "");
  const section = String(formData.get("section"));
  const direction = formData.get("direction") === "up" ? -1 : 1;

  const { data: rows } = await supabase
    .from("setup_steps")
    .select("id, phase, section, sort_order")
    .eq("path", path)
    .order("sort_order");
  if (!rows) return;

  // Sections appear within a pillar in the order of their first step; swap
  // this section's block with its neighbor in the same pillar.
  const inPillar = rows.filter((r) => (r.phase ?? "") === phase);
  const sections: string[] = [];
  const stepsBySection = new Map<string, typeof rows>();
  for (const row of inPillar) {
    if (!stepsBySection.has(row.section)) {
      sections.push(row.section);
      stepsBySection.set(row.section, []);
    }
    stepsBySection.get(row.section)!.push(row);
  }

  const from = sections.indexOf(section);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= sections.length) return;
  [sections[from], sections[to]] = [sections[to], sections[from]];

  const reordered = sections.flatMap((s) => stepsBySection.get(s)!);
  const sortValues = inPillar.map((r) => r.sort_order).sort((a, b) => a - b);

  await Promise.all(
    reordered.flatMap((row, index) =>
      row.sort_order === sortValues[index]
        ? []
        : [
            supabase
              .from("setup_steps")
              .update({ sort_order: sortValues[index] })
              .eq("id", row.id),
          ],
    ),
  );

  revalidateAll();
}

export async function moveStep(formData: FormData) {
  const supabase = await createClient();
  const stepId = String(formData.get("step_id"));
  const toPhase = String(formData.get("to_phase") ?? "");
  const toSection = String(formData.get("to_section"));

  const { data: step } = await supabase
    .from("setup_steps")
    .select("id, path, phase, section")
    .eq("id", stepId)
    .single();
  if (!step) return;
  if ((step.phase ?? "") === toPhase && step.section === toSection) return;

  const { data: rows } = await supabase
    .from("setup_steps")
    .select("id, phase, section, sort_order")
    .eq("path", step.path)
    .order("sort_order");
  if (!rows) return;

  // Put the step at the end of the target section (or the end of the target
  // pillar if the section is new to it), then renumber so pillar and
  // section order stay intact.
  const rest = rows.filter((r) => r.id !== stepId);
  const moving = rows.find((r) => r.id === stepId)!;
  let insertAt = -1;
  for (let i = rest.length - 1; i >= 0; i--) {
    if ((rest[i].phase ?? "") === toPhase && rest[i].section === toSection) {
      insertAt = i + 1;
      break;
    }
  }
  if (insertAt < 0) {
    for (let i = rest.length - 1; i >= 0; i--) {
      if ((rest[i].phase ?? "") === toPhase) {
        insertAt = i + 1;
        break;
      }
    }
  }
  if (insertAt < 0) insertAt = rest.length;

  const ordered = [
    ...rest.slice(0, insertAt),
    moving,
    ...rest.slice(insertAt),
  ];
  const sortValues = rows.map((r) => r.sort_order).sort((a, b) => a - b);

  await Promise.all(
    ordered.flatMap((row, index) => {
      const isMoved = row.id === stepId;
      if (!isMoved && row.sort_order === sortValues[index]) return [];
      return [
        supabase
          .from("setup_steps")
          .update({
            sort_order: sortValues[index],
            ...(isMoved ? { phase: toPhase || null, section: toSection } : {}),
          })
          .eq("id", row.id),
      ];
    }),
  );

  revalidateAll();
}

export async function updateStepIsPublished(stepId: string, value: boolean) {
  const supabase = await createClient();
  await supabase
    .from("setup_steps")
    .update({ is_published: value })
    .eq("id", stepId);

  revalidateAll();
}

export async function renamePillar(
  path: "custom" | "express",
  phase: string,
  newName: string,
) {
  const name = newName.trim();
  if (!name || name === phase) return;

  const supabase = await createClient();
  const query = supabase
    .from("setup_steps")
    .update({ phase: name })
    .eq("path", path);
  await (phase ? query.eq("phase", phase) : query.is("phase", null));

  revalidateAll();
}

export async function renameSection(
  path: "custom" | "express",
  phase: string,
  section: string,
  newName: string,
) {
  const name = newName.trim();
  if (!name || name === section) return;

  const supabase = await createClient();
  const query = supabase
    .from("setup_steps")
    .update({ section: name })
    .eq("path", path)
    .eq("section", section);
  await (phase ? query.eq("phase", phase) : query.is("phase", null));

  revalidateAll();
}
