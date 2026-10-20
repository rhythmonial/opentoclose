"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const CATEGORIES = ["training", "replay", "faq"];

function revalidate() {
  revalidatePath("/dashboard/resources");
  revalidatePath("/resources");
}

function readFields(formData: FormData) {
  const url = String(formData.get("url") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  return {
    title: String(formData.get("title") ?? "").trim(),
    url: url || null,
    body: body || null,
  };
}

export async function addResourceItem(formData: FormData) {
  const category = String(formData.get("category") ?? "");
  const fields = readFields(formData);
  if (!CATEGORIES.includes(category) || !fields.title) return;

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("resource_items")
    .select("sort_order")
    .eq("category", category)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  await supabase.from("resource_items").insert({
    category,
    ...fields,
    sort_order: (last?.sort_order ?? 0) + 1,
  });

  revalidate();
}

export async function updateResourceItem(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const fields = readFields(formData);
  if (!fields.title) return;

  const supabase = await createClient();
  await supabase.from("resource_items").update(fields).eq("id", id);

  revalidate();
}

export async function deleteResourceItem(formData: FormData) {
  const id = String(formData.get("id") ?? "");

  const supabase = await createClient();
  await supabase.from("resource_items").delete().eq("id", id);

  revalidate();
}
