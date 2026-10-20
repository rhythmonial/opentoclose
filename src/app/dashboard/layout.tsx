import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StaffNav } from "@/components/StaffNav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "dev" && profile?.role !== "dev_admin") {
    redirect("/home");
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <StaffNav showTasks={profile?.role === "dev"} />
      <div className="flex-1">{children}</div>
    </div>
  );
}
