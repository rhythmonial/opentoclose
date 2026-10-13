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
    <main className="flex flex-1 flex-col bg-bg">
      <div className="flex flex-1 flex-col items-center justify-center px-5 py-12 text-center sm:px-6 sm:py-16">
        <h1 className="max-w-2xl font-display text-2xl font-bold leading-tight text-ink sm:text-4xl">
          Your Real Estate Processes
          <br className="hidden sm:inline" />{" "}
          Fully Automated in Open to Close
        </h1>
        <p className="mt-5 max-w-xl text-sm text-ink-soft sm:text-base">
          For TC business owners and real estate team &amp; brokerage owners.
          <br className="hidden sm:inline" />{" "}
          Configure your workflow fields, date rules, contacts, documents,
          emails, tasks, intake forms, views, and automations with
          Josie&rsquo;s Team.
          <br className="hidden sm:inline" />{" "}
          Start closing in OTC without the guesswork.
        </p>

        <div className="mt-8">
          <Link
            href="/pricing"
            className="rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-white"
          >
            Get Pricing &amp; Setup Details
          </Link>
        </div>
      </div>
    </main>
  );
}
