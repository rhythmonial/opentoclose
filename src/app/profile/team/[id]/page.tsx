import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/TopNav";

const CLIENT_ROLE_LABEL: Record<string, string> = {
  client_owner: "Client",
  client_admin: "Admin",
};

type LogEntry = {
  id: string;
  label: string;
  createdAt: string;
};

export default async function TeamMemberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: realViewer }, { data: member }] = await Promise.all([
    supabase
      .from("profiles")
      .select("role, client_account_id")
      .eq("id", user.id)
      .single(),
    supabase
      .from("profiles")
      .select("id, role, name, first_login_at, created_at, client_account_id")
      .eq("id", id)
      .in("role", ["client_owner", "client_admin"])
      .single(),
  ]);

  const isStaff =
    realViewer?.role === "dev" || realViewer?.role === "dev_admin";

  if (
    !member ||
    !realViewer?.client_account_id ||
    member.client_account_id !== realViewer.client_account_id
  ) {
    redirect(isStaff ? "/dashboard" : "/profile");
  }

  const [{ data: account }, { data: owner }] = await Promise.all([
    supabase
      .from("client_accounts")
      .select("name")
      .eq("id", member.client_account_id!)
      .single(),
    supabase
      .from("profiles")
      .select("id")
      .eq("client_account_id", member.client_account_id!)
      .eq("role", "client_owner")
      .single(),
  ]);

  const [{ data: completedSteps }, { data: signIns }] = await Promise.all([
    owner
      ? supabase
          .from("client_step_status")
          .select("step_id, updated_at, setup_steps(title)")
          .eq("client_id", owner.id)
          .eq("status", "approved")
          .order("updated_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    supabase
      .from("profile_activity_log")
      .select("id, created_at")
      .eq("profile_id", id)
      .eq("event_type", "sign_in")
      .order("created_at", { ascending: false }),
  ]);

  const entries: LogEntry[] = [
    ...(signIns ?? []).map((row) => ({
      id: row.id,
      label: "Signed in",
      createdAt: row.created_at,
    })),
    ...(completedSteps ?? []).map((row) => ({
      id: `step-${row.step_id}`,
      label: `Completed: ${row.setup_steps?.title ?? "Untitled step"}`,
      createdAt: row.updated_at,
    })),
  ];

  if (member.first_login_at) {
    entries.push({
      id: "first-login",
      label: "First signed in",
      createdAt: member.first_login_at,
    });
  }

  entries.push({
    id: "created",
    label: "Account created",
    createdAt: member.created_at,
  });

  entries.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const businessName = account?.name ?? "Your business";

  return (
    <main className="flex min-h-screen flex-col bg-bg">
      <TopNav businessName={businessName} />

      <div className="px-4 py-7 sm:px-6 sm:py-9 lg:px-12">
        <Link href="/profile" className="text-sm font-medium text-accent">
          &larr; Back to profile
        </Link>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-xl font-bold text-ink sm:text-[25px]">
              {member.name || "Pending"}
            </h1>
            <p className="mt-1 text-sm text-ink-soft">
              {CLIENT_ROLE_LABEL[member.role] ?? member.role}
            </p>
          </div>
          <span
            className={`self-start rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide sm:self-auto ${
              member.first_login_at
                ? "bg-success-soft text-success"
                : "bg-accent-soft text-accent"
            }`}
          >
            {(member.first_login_at ? "active" : "invited").toUpperCase()}
          </span>
        </div>

        <h2 className="mt-7 text-[15px] font-bold text-ink">Activity log</h2>
        <div className="mt-3 flex flex-col gap-2.5">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex flex-col gap-1 rounded-xl border border-border-soft bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="text-sm font-bold text-ink">{entry.label}</div>
              <div className="text-xs text-ink-faint">
                {new Date(entry.createdAt).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
