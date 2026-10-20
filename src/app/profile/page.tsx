import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/TopNav";
import { StaffNav } from "@/components/StaffNav";
import { signOut } from "@/app/login/actions";
import { getSandboxTier } from "@/lib/devSandbox";
import { updateProfileInfo, inviteClientAdmin, inviteStaff } from "./actions";

const CLIENT_ROLE_LABEL: Record<string, string> = {
  client_owner: "Client",
  client_admin: "Admin",
};

const STAFF_ROLE_LABEL: Record<string, string> = {
  dev: "Dev",
  dev_admin: "Technician",
};


export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    invited?: string;
    saved?: string;
  }>;
}) {
  const { error, invited, saved } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: realProfile } = await supabase
    .from("profiles")
    .select("role, email, name, phone, client_account_id")
    .eq("id", user.id)
    .single();

  const isStaff =
    realProfile?.role === "dev" || realProfile?.role === "dev_admin";
  const sandboxTier = isStaff ? await getSandboxTier() : null;

  // Sandboxes have no real profile or team to show — send sandboxing staff
  // back to /home instead of rendering this page.
  if (sandboxTier) {
    redirect("/home");
  }

  const profile = realProfile;

  if (isStaff) {
    const { data: staff } = await supabase
      .from("profiles")
      .select("id, role, email, name, first_login_at")
      .in("role", ["dev", "dev_admin"])
      .order("created_at");

    const canInvite = profile?.role === "dev_admin";
    const canManageStaff = profile?.role === "dev";

    return (
      <div className="flex min-h-screen flex-col bg-bg">
        <StaffNav isDev={profile?.role === "dev"} />

        <main className="px-4 py-7 sm:px-6 sm:py-9 lg:px-12">
          <h1 className="font-script text-[34px] leading-tight text-ink sm:text-[42px]">
            Profile
          </h1>

          <div className="mt-7 flex flex-col gap-6 lg:flex-row lg:gap-8">
            <section className="w-full rounded-xl border border-border bg-surface p-5 lg:w-[340px] lg:shrink-0">
              {saved && (
                <div className="mb-3.5 rounded-lg border border-success/30 bg-success-soft px-3.5 py-2.5 text-sm text-success">
                  Profile saved.
                </div>
              )}
              <form action={updateProfileInfo} className="flex flex-col gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-ink-soft">Name</span>
                  <input
                    name="name"
                    defaultValue={profile?.name ?? ""}
                    className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-ink-soft">Email</span>
                  <input
                    value={user.email ?? ""}
                    disabled
                    className="rounded-lg border border-border bg-border-soft px-3 py-2 text-sm text-ink-soft"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-ink-soft">
                    Phone number
                  </span>
                  <input
                    name="phone"
                    type="tel"
                    defaultValue={profile?.phone ?? ""}
                    className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                  />
                </label>
                <button
                  type="submit"
                  className="mt-1 self-start rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white"
                >
                  Save
                </button>
              </form>
            </section>

            <div className="flex min-w-0 flex-1 flex-col gap-2.5">
              <h2 className="text-[15px] font-bold text-ink">
                Internal team
              </h2>
              {(staff ?? []).map((member) => {
                const row = (
                  <>
                    <div className="flex-1">
                      <div className="text-[15px] font-bold text-ink">
                        {member.name || "Pending"}
                        {member.id === user.id && (
                          <span className="ml-2 text-xs font-medium text-ink-faint">
                            (you)
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-ink-soft">
                        {STAFF_ROLE_LABEL[member.role] ?? member.role}
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold font-caption tracking-wide ${
                        member.first_login_at
                          ? "bg-success-soft text-success"
                          : "bg-accent-soft text-accent"
                      }`}
                    >
                      {(member.first_login_at ? "active" : "invited").toUpperCase()}
                    </span>
                    {canManageStaff && (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="shrink-0 text-ink-faint"
                      >
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    )}
                  </>
                );

                return canManageStaff ? (
                  <Link
                    key={member.id}
                    href={`/profile/staff/${member.id}`}
                    className="flex items-center gap-4 rounded-xl border border-border bg-surface px-5 py-[18px] hover:border-accent"
                  >
                    {row}
                  </Link>
                ) : (
                  <div
                    key={member.id}
                    className="flex items-center gap-4 rounded-xl border border-border bg-surface px-5 py-[18px]"
                  >
                    {row}
                  </div>
                );
              })}
            </div>

            {canInvite && (
              <div className="flex w-full flex-col gap-5 lg:w-[340px] lg:shrink-0">
                <div className="rounded-xl border border-border bg-surface p-5">
                  <h3 className="mb-3 text-[15px] font-bold text-ink">
                    Invite a colleague
                  </h3>
                  <p className="mb-3.5 text-sm text-ink-soft">
                    They&rsquo;ll get an email to set their password and sign
                    in as a dev_admin.
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

                  <form action={inviteStaff} className="flex flex-col gap-3">
                    <input
                      type="email"
                      name="email"
                      required
                      placeholder="colleague@example.com"
                      className="rounded-lg border border-border bg-bg px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent"
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

          <form action={signOut} className="mt-9">
            <button
              type="submit"
              className="flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-ink"
            >
              Sign Out
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <path d="M16 17l5-5-5-5" />
                <path d="M21 12H9" />
              </svg>
            </button>
          </form>
        </main>
      </div>
    );
  }

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
        .select("id, role, email, name, first_login_at")
        .eq("client_account_id", profile.client_account_id)
        .order("created_at")
    : { data: null };

  const businessName = account?.name ?? profile?.email ?? user.email ?? "Your business";

  const isOwner = profile?.role === "client_owner";

  return (
    <main className="flex min-h-screen flex-col bg-bg">
      <TopNav businessName={businessName} />

      <div className="px-4 pt-6 sm:px-6 sm:pt-9 lg:px-12">
        <h1 className="font-script text-[34px] leading-tight text-ink sm:text-[42px]">
          Profile
        </h1>
        <p className="mt-1.5 text-sm text-ink-soft">
          {profile?.email ?? user.email} &middot; {CLIENT_ROLE_LABEL[profile?.role ?? ""]} at{" "}
          {businessName}
        </p>
      </div>

      <div className="flex flex-col gap-6 px-4 pb-10 pt-6 sm:px-6 sm:pt-7 lg:flex-row lg:gap-8 lg:px-12 lg:pb-12">
        <section className="w-full rounded-xl border border-border bg-surface p-5 lg:w-[340px] lg:shrink-0">
          {saved && (
            <div className="mb-3.5 rounded-lg border border-success/30 bg-success-soft px-3.5 py-2.5 text-sm text-success">
              Profile saved.
            </div>
          )}
          <form action={updateProfileInfo} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-ink-soft">Name</span>
              <input
                name="name"
                defaultValue={profile?.name ?? ""}
                className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-ink-soft">Email</span>
              <input
                value={profile?.email ?? user.email ?? ""}
                disabled
                className="rounded-lg border border-border bg-border-soft px-3 py-2 text-sm text-ink-soft"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-ink-soft">
                Phone number
              </span>
              <input
                name="phone"
                type="tel"
                defaultValue={profile?.phone ?? ""}
                className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
              />
            </label>
            <button
              type="submit"
              className="mt-1 self-start rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Save
            </button>
          </form>
        </section>

        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <div className="flex flex-col gap-2.5">
            <h2 className="text-[15px] font-bold text-ink">Your team</h2>
            {(teammates ?? []).map((member) => (
              <Link
                key={member.id}
                href={`/profile/team/${member.id}`}
                className="flex items-center gap-4 rounded-xl border border-border bg-surface px-5 py-[18px] hover:border-accent"
              >
                <div className="flex-1">
                  <div className="text-[15px] font-bold text-ink">
                    {member.name || "Pending"}
                    {member.id === user.id && (
                      <span className="ml-2 text-xs font-medium text-ink-faint">
                        (you)
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-ink-soft">
                    {CLIENT_ROLE_LABEL[member.role] ?? member.role}
                  </div>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold font-caption tracking-wide ${
                    member.first_login_at
                      ? "bg-success-soft text-success"
                      : "bg-accent-soft text-accent"
                  }`}
                >
                  {(member.first_login_at ? "active" : "invited").toUpperCase()}
                </span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="shrink-0 text-ink-faint"
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </Link>
            ))}

            {(teammates ?? []).length === 0 && (
              <p className="text-sm text-ink-soft">No teammates yet.</p>
            )}
          </div>

          {isOwner && (
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

              <form action={inviteClientAdmin} className="flex flex-col gap-3">
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="teammate@example.com"
                  className="rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Send invite
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 pb-10 sm:px-6 lg:px-12 lg:pb-12">
        <form action={signOut}>
          <button
            type="submit"
            className="flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-ink"
          >
            Sign Out
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="M16 17l5-5-5-5" />
              <path d="M21 12H9" />
            </svg>
          </button>
        </form>
      </div>
    </main>
  );
}
