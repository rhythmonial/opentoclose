import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { freeDaysLabel, inviteStatus } from "@/lib/coupons";
import { startInvite } from "../actions";

// An invite link: a free stretch of DIY (a month by default) with no card.
// Each link works once.
export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invite = await inviteStatus(token);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };
  const isStaff = profile?.role === "dev" || profile?.role === "dev_admin";

  return (
    <main className="flex flex-1 items-center justify-center bg-bg px-4 py-12">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 text-center">
        {!invite ? (
          <>
            <h1 className="font-display text-2xl font-bold text-ink">Invite not available</h1>
            <p className="mt-2 text-sm text-ink-soft">
              This invite link has already been used or is no longer valid. Ask the person who
              sent it for a new one.
            </p>
            <Link href="/" className="mt-5 inline-block text-sm font-semibold text-accent">
              Go to OTC Setup with Josie &rarr;
            </Link>
          </>
        ) : (
          <>
            <h1 className="font-display text-2xl font-bold text-ink">You&rsquo;re invited!</h1>
            <p className="mt-2 text-sm text-ink-soft">
              Enjoy <span className="font-semibold text-ink">{freeDaysLabel(invite.freeDays)} free</span>{" "}
              of OTC Setup DIY: our step-by-step checklist, videos and resources for setting up
              Open to Close yourself. No card needed.
            </p>

            {isStaff ? (
              <p className="mt-5 text-sm text-ink-faint">
                You&rsquo;re signed in as staff, so this invite can&rsquo;t be claimed here.
              </p>
            ) : user ? (
              <form action={startInvite} className="mt-6">
                <input type="hidden" name="token" value={token} />
                <input type="hidden" name="next" value="claim" />
                <button
                  type="submit"
                  className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white"
                >
                  Claim my free {freeDaysLabel(invite.freeDays)}
                </button>
              </form>
            ) : (
              <div className="mt-6 flex flex-col gap-2.5">
                <form action={startInvite}>
                  <input type="hidden" name="token" value={token} />
                  <input type="hidden" name="next" value="signup" />
                  <button
                    type="submit"
                    className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white"
                  >
                    Create my account
                  </button>
                </form>
                <form action={startInvite}>
                  <input type="hidden" name="token" value={token} />
                  <input type="hidden" name="next" value="login" />
                  <button type="submit" className="text-sm font-semibold text-accent">
                    I already have an account
                  </button>
                </form>
              </div>
            )}
            <p className="mt-5 text-xs text-ink-faint">
              After your free {freeDaysLabel(invite.freeDays)}, you can subscribe to keep your
              access.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
