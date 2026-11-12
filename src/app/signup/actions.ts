"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { INVITE_COOKIE } from "@/lib/coupons";
import { createClient } from "@/lib/supabase/server";

export async function signUp(formData: FormData) {
  // Not open yet (see the sign-up page): invite links only.
  if (!(await cookies()).get(INVITE_COOKIE)) redirect("/");
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const businessName = String(formData.get("business_name") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { business_name: businessName },
    },
  });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/home");
}
