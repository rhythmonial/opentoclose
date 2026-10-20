import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StaffNav } from "@/components/StaffNav";
import { updateStaffEmail, sendStaffPasswordReset } from "./actions";

const STAFF_ROLE_LABEL: Record<string, string> = {
  dev: "Dev",
  dev_admin: "Technician",
};

const EVENT_LABEL: Record<string, string> = {
  invited: "Invited",
  email_changed: "Email changed",
  password_reset_requested: "Password reset requested",
};

type LogEntry = {
  id: string;
  label: string;
  detail?: string | null;
  actorLabel?: string | null;
  createdAt: string;
};

export default async function StaffMemberPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string; reset?: string }>;
}) {
  const { id } = await params;
  const { error, saved, reset } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: viewer } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (viewer?.role !== "dev") {
    redirect("/profile");
  }

  const { data: member } = await supabase
    .from("profiles")
    .select("id, role, email, name, first_login_at, created_at")
    .eq("id", id)
    .in("role", ["dev", "dev_admin"])
    .single();

  if (!member) {
    notFound();
  }

  const { data: logRows } = await supabase
    .from("profile_activity_log")
    .select(
      "id, event_type, detail, created_at, actor:profiles!staff_activity_log_actor_id_fkey(name, email)",
    )
    .eq("profile_id", id)
    .order("created_at", { ascending: false });

  const entries: LogEntry[] = (logRows ?? []).map((row) => ({
    id: row.id,
    label: EVENT_LABEL[row.event_type] ?? row.event_type,
    detail: row.detail,
    actorLabel: row.actor?.name || row.actor?.email || null,
    createdAt: row.created_at,
  }));

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

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <StaffNav isDev />

      <main className="px-4 py-7 sm:px-6 sm:py-9 lg:px-12">
        <Link href="/profile" className="text-sm font-medium text-accent">
          &larr; Back to profile
        </Link>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-ink sm:text-[28px]">
              {member.name || "Pending"}
            </h1>
            <p className="mt-1 text-sm text-ink-soft">
              {STAFF_ROLE_LABEL[member.role] ?? member.role}
            </p>
          </div>
          <span
            className={`self-start rounded-full px-2.5 py-1 text-[11px] font-bold font-caption tracking-wide sm:self-auto ${
              member.first_login_at
                ? "bg-success-soft text-success"
                : "bg-accent-soft text-accent"
            }`}
          >
            {(member.first_login_at ? "active" : "invited").toUpperCase()}
          </span>
        </div>

        <div className="mt-7 flex flex-col gap-6 lg:flex-row lg:gap-8">
          <div className="flex w-full flex-col gap-5 lg:w-[340px] lg:shrink-0">
            <section className="rounded-xl border border-border bg-surface p-5">
              <h2 className="mb-3 text-[15px] font-bold text-ink">Email</h2>

              {saved && (
                <div className="mb-3.5 rounded-lg border border-success/30 bg-success-soft px-3.5 py-2.5 text-sm text-success">
                  Email updated.
                </div>
              )}
              {reset && (
                <div className="mb-3.5 rounded-lg border border-success/30 bg-success-soft px-3.5 py-2.5 text-sm text-success">
                  Reset link sent.
                </div>
              )}
              {error && (
                <div className="mb-3.5 rounded-lg border border-danger/30 bg-danger/5 px-3.5 py-2.5 text-sm text-danger">
                  {error}
                </div>
              )}

              <form action={updateStaffEmail} className="flex flex-col gap-3">
                <input type="hidden" name="id" value={member.id} />
                <input
                  type="email"
                  name="email"
                  required
                  defaultValue={member.email ?? ""}
                  className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white"
                  >
                    Update email
                  </button>
                  <button
                    type="submit"
                    formAction={sendStaffPasswordReset}
                    className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-ink"
                  >
                    Reset Password
                  </button>
                </div>
              </form>
            </section>
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-bold text-ink">Activity log</h2>
            <div className="mt-3 flex flex-col gap-2.5">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex flex-col gap-1 rounded-xl border border-border-soft bg-bg px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="text-sm font-bold text-ink">
                      {entry.label}
                    </div>
                    {(entry.detail || entry.actorLabel) && (
                      <div className="text-xs text-ink-soft">
                        {entry.detail}
                        {entry.detail && entry.actorLabel && " · "}
                        {entry.actorLabel && `by ${entry.actorLabel}`}
                      </div>
                    )}
                  </div>
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
        </div>
      </main>
    </div>
  );
}
