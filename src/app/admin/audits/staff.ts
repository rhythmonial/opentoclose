import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// The audits admin is for staff (dev / dev_admin) only.
export async function requireStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "dev" && profile?.role !== "dev_admin") redirect("/home");
  return supabase;
}
