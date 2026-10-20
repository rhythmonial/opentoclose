import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { runLegacyCleanup } from "./actions";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; result?: string }>;
}) {
  const { error, result } = await searchParams;
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
    <main className="flex min-h-screen flex-col items-center bg-bg px-4 py-16">
      <div className="w-full max-w-lg">
        <h1 className="font-display text-2xl font-bold text-ink">
          Internal tools
        </h1>
        <p className="mt-1.5 text-sm text-ink-soft">
          Staff-only maintenance actions. Dev and dev_admin only.
        </p>

        <div className="mt-6 rounded-xl border border-border bg-surface p-5">
          <h2 className="text-[15px] font-bold text-ink">
            Clean up legacy data
          </h2>
          <p className="mt-1.5 text-sm text-ink-soft">
            Removes columns and types left over from past schema changes, and
            deletes any smoke-test accounts. Safe to run any time — it only
            does something if there&rsquo;s actually something left to clean.
          </p>

          {error && (
            <div className="mt-4 rounded-lg border border-danger/30 bg-danger/5 px-3.5 py-2.5 text-sm text-danger">
              {error}
            </div>
          )}
          {result && (
            <div className="mt-4 rounded-lg border border-success/30 bg-success-soft px-3.5 py-2.5 text-sm text-success">
              {result}
            </div>
          )}

          <form action={runLegacyCleanup} className="mt-4">
            <button
              type="submit"
              className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white"
            >
              Run cleanup
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
