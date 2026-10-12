import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/TopNav";
import { inviteTeammate } from "./actions";

const ROLE_LABEL: Record<string, string> = {
  client_owner: "Owner",
  client_admin: "Admin",
};

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; invited?: string }>;
}) {
  const { error, invited } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, client_account_id")
    .eq("id", user.id)
    .single();

  const { data: account } = profile?.client_account_id
    ? await supabase
        .from("client_accounts")
        .select("name")
        .eq("id", profile.client_account_id)
        .single()
    : { data: null };

  const { data: teammates } = profile?.client_account_id
    ? await supabase
        .from("profiles")
        .select("id, role, email, first_login_at")
        .eq("client_account_id", profile.client_account_id)
        .order("created_at")
    : { data: null };

  const businessName = account?.name ?? user.email ?? "Your business";
  const initials = businessName
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const isOwner = profile?.role === "client_owner";

  return (
    <main className="flex min-h-screen flex-col bg-bg">
      <TopNav businessName={businessName} initials={initials} active="team" />

      <div className="px-12 pt-9">
        <h1 className="font-display text-[25px] font-bold text-ink">Team</h1>
        <p className="mt-1.5 text-sm text-ink-soft">
          Everyone with access to {businessName}&rsquo;s setup portal.
        </p>
      </div>

      <div className="flex gap-8 px-12 pb-12 pt-7">
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          {(teammates ?? []).map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-4 rounded-xl border border-border bg-surface px-5 py-[18px]"
            >
              <div className="flex-1">
                <div className="text-[15px] font-bold text-ink">
                  {member.email ?? "Pending"}
                  {member.id === user.id && (
                    <span className="ml-2 text-xs font-medium text-ink-faint">
                      (you)
                    </span>
                  )}
                </div>
                <div className="text-sm text-ink-soft">
                  {ROLE_LABEL[member.role] ?? member.role}
                </div>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide ${
                  member.first_login_at
                    ? "bg-success-soft text-success"
                    : "bg-accent-soft text-accent"
                }`}
              >
                {(member.first_login_at ? "active" : "invited").toUpperCase()}
              </span>
            </div>
          ))}

          {(teammates ?? []).length === 0 && (
            <p className="text-sm text-ink-soft">No teammates yet.</p>
          )}
        </div>

        {isOwner && (
          <div className="flex w-[340px] shrink-0 flex-col gap-5">
            <div className="rounded-xl border border-border bg-surface p-5">
              <h3 className="mb-3 text-[15px] font-bold text-ink">
                Invite a teammate
              </h3>
              <p className="mb-3.5 text-sm text-ink-soft">
                They&rsquo;ll get an email to set their password and sign in
                as an admin on your account.
              </p>

              {error && (
                <div className="mb-3.5 rounded-lg border border-danger/30 bg-danger/5 px-3.5 py-2.5 text-sm text-danger">
                  {error}
                </div>
              )}
              {invited && (
                <div className="mb-3.5 rounded-lg border border-success/30 bg-success-soft px-3.5 py-2.5 text-sm text-success">
                  Invite sent.
                </div>
              )}

              <form action={inviteTeammate} className="flex flex-col gap-3">
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="teammate@example.com"
                  className="rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white"
                >
                  Send invite
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
