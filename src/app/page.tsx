import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function RootPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role === "dev" || profile?.role === "dev_admin") {
      redirect("/dashboard");
    }

    redirect("/portal");
  }

  return (
    <main className="flex min-h-screen flex-col bg-bg">
      <div className="flex items-center justify-between px-12 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 11l9-7 9 7" />
              <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
            </svg>
          </div>
          <span className="font-display text-lg font-bold text-ink">
            OTC Setup with Josie
          </span>
        </div>
        <Link href="/login" className="text-sm font-semibold text-accent">
          Sign in
        </Link>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <h1 className="max-w-2xl font-display text-4xl font-bold leading-tight text-ink">
          Your transaction coordination process, fully set up in Open to
          Close.
        </h1>
        <p className="mt-5 max-w-xl text-base text-ink-soft">
          For TC business owners and real estate team &amp; brokerage owners.
          We configure your workflow fields, documents, date rules, and
          terminology &mdash; so your team can start closing in OTC without
          the guesswork.
        </p>

        <div className="mt-8 flex items-center gap-4">
          <Link
            href="/request-info"
            className="rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-white"
          >
            Get Pricing &amp; Setup Details
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-border px-6 py-3 text-sm font-semibold text-ink"
          >
            Sign in
          </Link>
        </div>

        <p className="mt-6 max-w-md text-xs text-ink-faint">
          Heads up: this is for the business owner. We work directly with
          team and brokerage owners on setup, and owners invite their admins
          once things get started.
        </p>
      </div>
    </main>
  );
}
