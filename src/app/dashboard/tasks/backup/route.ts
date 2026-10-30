import { createClient } from "@/lib/supabase/server";

// Downloads every Setup Tasks lesson and resource link as a JSON file, so
// staff can keep their own copy of the content outside the database.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Please sign in.", { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "dev" && profile?.role !== "dev_admin") {
    return new Response("Only staff can download backups.", { status: 403 });
  }

  const [steps, resources] = await Promise.all([
    supabase.from("setup_steps").select("*").order("path").order("sort_order"),
    supabase.from("setup_step_resources").select("*").order("step_id").order("sort_order"),
  ]);
  if (steps.error || resources.error) {
    return new Response(
      `Couldn't read the setup tasks: ${(steps.error ?? resources.error)?.message}`,
      { status: 500 },
    );
  }

  const exportedAt = new Date().toISOString();
  const body = JSON.stringify(
    {
      exported_at: exportedAt,
      lesson_count: steps.data.length,
      resource_link_count: resources.data.length,
      setup_steps: steps.data,
      setup_step_resources: resources.data,
    },
    null,
    2,
  );

  return new Response(body, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="setup-tasks-backup-${exportedAt.slice(0, 10)}.json"`,
      "cache-control": "no-store",
    },
  });
}
