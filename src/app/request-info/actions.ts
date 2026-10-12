"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requestInfo(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();

  if (!name || !email) {
    redirect("/request-info?error=Name+and+email+are+required");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("leads").insert({
    name,
    email,
    phone: phone || null,
    status: "new",
    source: "request_info",
  });

  if (error) {
    redirect(`/request-info?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/request-info?sent=1");
}
