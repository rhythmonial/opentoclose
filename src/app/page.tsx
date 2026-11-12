import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MarketingFooter } from "@/components/MarketingFooter";

// The homepage for now: the founding members offer. (The earlier homepage
// is kept at /classic-home.)

const APPLY_HREF = "/founding";

const PIECES = [
  { title: "Fields", body: "Only the fields your contracts and workflow actually use, named and organized your way." },
  { title: "Dates", body: "Your key dates, and how each one is calculated." },
  { title: "Documents", body: "The documents you collect and chase, organized by category." },
  { title: "Contacts", body: "The roles and contacts involved in every transaction." },
  { title: "Emails", body: "Sample and custom templates for the emails you send again and again." },
  { title: "Tasks", body: "Sample and custom task templates that follow your process." },
  { title: "Intake forms", body: "Forms that prepare your files with what you need from the start." },
  { title: "Transaction management", body: "How it all comes together to run your files in Open to Close." },
];

const GROUPS = ["TC teams", "Independent TCs", "Real estate teams", "Real estate brokerages"];

const PERKS = [
  "Setup completed in 4 weeks",
  "A build based on your own contracts and workflow",
  "Direct access to me as we refine the system",
  "System access at $55/month",
];

export default async function RootPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role === "dev" || profile?.role === "dev_admin") redirect("/dashboard");
    redirect("/home");
  }

  return (
    <main className="flex flex-1 flex-col bg-bg">
      <section className="bg-navy text-white">
        <div className="mx-auto max-w-4xl px-5 py-16 text-center sm:px-6 sm:py-24">
          <div className="font-caption text-xs font-semibold uppercase tracking-wide text-gold">
            Founding group &middot; Applications open
          </div>
          <h1 className="mt-4 font-display text-3xl font-bold leading-tight sm:text-5xl">
            Set up Open to Close right the first time.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-[15px] text-balance text-white/80 sm:text-lg">
            Most Open to Close setups go wrong before the first transaction is ever entered.
            This is an interactive setup course built around your own contracts, so you build
            only what you&rsquo;ll actually use.
          </p>
          <p className="mt-6 text-sm font-semibold text-white">*For brand-new Open to Close accounts only*</p>
          <div className="mt-4 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href={APPLY_HREF}
              className="w-full rounded-lg bg-gold px-6 py-3 text-sm font-semibold text-navy sm:w-auto"
            >
              Apply for a founding spot
            </a>
            <a
              href="#offer"
              className="w-full rounded-lg border border-white/40 px-6 py-3 text-sm font-semibold text-white sm:w-auto"
            >
              See the offer
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 py-16 sm:px-6 lg:px-12">
        <h2 className="text-center font-display text-2xl font-bold text-ink sm:text-3xl">
          Built around your contracts
        </h2>
        <p className="mx-auto mt-2 max-w-2xl text-center text-ink-soft">
          You upload your blank contracts and addenda, and each lesson walks you through building
          your account from them.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PIECES.map((p) => (
            <div key={p.title} className="rounded-xl border border-border bg-surface p-5">
              <p className="text-sm text-ink-soft">
                <span className="font-display text-base font-bold text-ink">{p.title}:</span> {p.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section id="offer" className="scroll-mt-4 bg-surface">
        <div className="mx-auto grid max-w-5xl gap-6 px-4 py-16 sm:px-6 md:grid-cols-2 lg:px-12">
          <div className="rounded-2xl bg-navy p-7 text-white">
            <div className="font-caption text-xs font-semibold uppercase tracking-wide text-gold">
              The founding group
            </div>
            <h2 className="mt-2 font-display text-2xl font-bold">3 spots in each of 4 groups</h2>
            <p className="mt-2 text-sm text-white/80">
              I&rsquo;m choosing a small founding group across multiple states before the public
              launch.
            </p>
            <ul className="mt-5 grid grid-cols-1 gap-2 text-base font-semibold sm:grid-cols-2">
              {GROUPS.map((g) => (
                <li key={g} className="flex items-center gap-2">
                  <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-gold" />
                  {g}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-border bg-bg p-7">
            <div className="font-caption text-xs font-semibold uppercase tracking-wide text-ink-faint">
              What founding members get
            </div>
            <ul className="mt-4 flex flex-col gap-2.5 text-ink">
              {PERKS.map((p) => (
                <li key={p} className="flex items-start gap-2.5">
                  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-accent">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  {p}
                </li>
              ))}
            </ul>
            <div className="mt-6 rounded-xl border-2 border-gold bg-surface p-4">
              <div className="font-semibold text-ink">Want hands-on help?</div>
              <p className="mt-1 text-sm text-ink-soft">
                Done-with-you setup is normally $999 for 10 hours. One founding member in each
                group gets it for <span className="font-semibold text-ink">$499 for 10 hours</span>{" "}
                (plus the $55/month), so only 4 in total.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 py-16 sm:px-6 lg:px-12">
        <div className="flex flex-col items-center gap-8 md:flex-row">
          <div className="relative h-64 w-48 shrink-0 overflow-hidden rounded-2xl sm:h-72 sm:w-56">
            <Image
              src="/brand/josie-headshot.png"
              alt="Josie, founder of OTC Setup with Josie"
              fill
              sizes="224px"
              className="object-cover object-top"
            />
          </div>
          <div>
            <div className="font-caption text-xs font-semibold uppercase tracking-wide text-ink-faint">
              Meet your guide
            </div>
            <h2 className="mt-2 font-display text-2xl font-bold text-ink sm:text-3xl">
              Hi, I&rsquo;m Josie!
            </h2>
            <p className="mt-3 text-ink-soft">
              I&rsquo;ve been in real estate since 2015 as an Agent, ISA, Listing Manager, Listing
              Referral Agent and Operations Manager, and found my passion in Transaction
              Management. In 2020 I turned my focus to the tech side. Since then I&rsquo;ve set up nearly 300 Open to Close accounts and
              helped more than 2,000 real estate professionals through my courses and 1-on-1
              sessions. This course is everything I&rsquo;ve learned, built into one guided
              setup.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-navy text-white">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6">
          <h2 className="font-display text-2xl font-bold sm:text-3xl">
            <span className="block">About to launch</span>
            <span className="block">Open to Close?</span>
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-white/80">
            Spots close once each group is full. Apply for a founding spot, or pass this along to
            someone who&rsquo;s about to launch.
          </p>
          <a
            href={APPLY_HREF}
            className="mt-7 inline-block rounded-lg bg-gold px-6 py-3 text-sm font-semibold text-navy"
          >
            Apply for a founding spot
          </a>
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}
