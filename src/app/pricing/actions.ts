"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requestInfo(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const heardAbout = String(formData.get("heard_about") ?? "").trim();
  const heardAboutDetail = String(
    formData.get("heard_about_detail") ?? "",
  ).trim();

  if (!name || !email) {
    redirect("/pricing?error=Name+and+email+are+required");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("leads").insert({
    name,
    email,
    phone: phone || null,
    status: "new",
    source: "request_info",
    heard_about: heardAbout || null,
    heard_about_detail: heardAboutDetail || null,
  });

  if (error) {
    redirect(`/pricing?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/pricing?sent=1");
}
