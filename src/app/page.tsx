import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MarketingFooter } from "@/components/MarketingFooter";

const BUILD_ITEMS = [
  {
    title: "Workflow fields",
    body: "The transaction details your team tracks, structured the way you actually work.",
  },
  {
    title: "Date rules",
    body: "Deadlines that calculate themselves from your contract dates.",
  },
  {
    title: "Contacts",
    body: "Roles and contact records for everyone involved in the deal.",
  },
  {
    title: "Documents",
    body: "Checklists so every file is requested, collected and reviewed.",
  },
  {
    title: "Emails",
    body: "Templates with conditional logic that fill themselves in.",
  },
  {
    title: "Tasks",
    body: "Task lists that assign and schedule themselves for each deal.",
  },
  {
    title: "Intake forms",
    body: "Forms that send new deals straight into Open to Close.",
  },
  {
    title: "Views",
    body: "Dashboards that show where every transaction stands at a glance.",
  },
  {
    title: "Automations",
    body: "Triggers that move work forward without the manual clicks.",
  },
];

const PLANS = [
  {
    name: "Free",
    price: "$0",
    tagline: "Explore the setup",
    features: [
      "Create your account",
      "See the full Open to Close setup checklist",
      "Track your progress step by step",
      "FAQs in the Resource Center",
    ],
    note: "Video lessons and resources unlock with DIY or Setup.",
    cta: { label: "Create a free account", href: "/signup" },
    featured: false,
  },
  {
    name: "DIY",
    price: "$19",
    tagline: "Do it yourself, with a guide",
    features: [
      "Step-by-step setup checklist",
      "Video lessons for every step",
      "Templates and downloadable resources",
      "Training videos and call replays",
      "Upgrade to Setup anytime",
    ],
    note: null,
    cta: { label: "Start with DIY", href: "/signup" },
    featured: false,
  },
  {
    name: "Setup",
    price: "$999",
    tagline: "We build it with you",
    features: [
      "Josie’s team builds your Open to Close setup",
      "10-hour setup bundle",
      "You only handle the steps that need you",
      "Training videos and call replays",
      "Progress tracking and a work log",
    ],
    note: null,
    cta: { label: "Get pricing & setup details", href: "/pricing" },
    featured: true,
  },
];

const STEPS = [
  {
    title: "Create your account",
    body: "Sign up free and tell us about your business.",
  },
  {
    title: "Pick your path",
    body: "Follow our checklist yourself, or have our team build it for you.",
  },
  {
    title: "Launch in Open to Close",
    body: "Go live with processes that run themselves, and start closing.",
  },
];

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

    redirect("/home");
  }

  return (
    <main className="flex flex-1 flex-col bg-bg">
      <section className="bg-navy text-white">
        <div className="mx-auto max-w-4xl px-5 py-16 text-center sm:px-6 sm:py-24">
          <div className="font-caption text-xs font-semibold uppercase tracking-wide text-gold">
            Save Time, Make Cents
          </div>
          <h1 className="mt-4 font-display text-3xl font-bold leading-tight sm:text-5xl">
            Your Real Estate Processes, Fully Automated in Open to Close
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-white/80 sm:text-lg">
            For TC business owners and real estate team &amp; brokerage owners.
            Set up your workflow fields, date rules, contacts, documents,
            emails, tasks, intake forms, views and automations, on your own or
            with Josie&rsquo;s team. Start closing in OTC without the
            guesswork.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/pricing"
              className="w-full rounded-lg bg-gold px-6 py-3 text-sm font-bold text-navy sm:w-auto"
            >
              Get Pricing &amp; Setup Details
            </Link>
            <Link
              href="/signup"
              className="w-full rounded-lg border border-white/40 px-6 py-3 text-sm font-semibold text-white sm:w-auto"
            >
              Start for free
            </Link>
          </div>
        </div>
      </section>

      <section id="plans" className="mx-auto scroll-mt-4 w-full max-w-6xl px-4 py-14 sm:px-6 lg:px-12">
        <h2 className="text-center font-display text-2xl font-bold text-ink sm:text-3xl">
          Choose how you want to get set up
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-ink-soft">
          Start free, build it yourself with our guide, or let our team do
          the heavy lifting.
        </p>

        <div className="mt-9 grid grid-cols-1 gap-5 md:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`flex flex-col rounded-2xl border bg-surface p-6 ${
                plan.featured
                  ? "border-navy shadow-lg ring-2 ring-navy"
                  : "border-border"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-xl font-bold text-ink">
                  {plan.name}
                </h3>
                {plan.featured && (
                  <span className="rounded-full bg-gold px-2.5 py-1 font-caption text-[11px] font-bold uppercase tracking-wide text-navy">
                    Done with you
                  </span>
                )}
              </div>
              <div className="mt-1 text-sm text-ink-soft">{plan.tagline}</div>
              <div className="mt-4 font-display text-4xl font-bold text-navy">
                {plan.price}
              </div>
              <ul className="mt-5 flex flex-1 flex-col gap-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-ink">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="mt-0.5 shrink-0 text-gold"
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              {plan.note && (
                <p className="mt-4 text-xs text-ink-faint">{plan.note}</p>
              )}
              <Link
                href={plan.cta.href}
                className={`mt-6 rounded-lg px-4 py-2.5 text-center text-sm font-semibold ${
                  plan.featured
                    ? "bg-navy text-white"
                    : "border border-navy text-navy"
                }`}
              >
                {plan.cta.label}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-12">
          <h2 className="text-center font-display text-2xl font-bold text-ink sm:text-3xl">
            Everything we set up in Open to Close
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-ink-soft">
            Every piece of your transaction workflow, configured to run
            itself.
          </p>
          <div className="mt-9 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {BUILD_ITEMS.map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-border-soft bg-bg p-5"
              >
                <div className="flex items-center gap-2.5">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-gold" />
                  <h3 className="font-display text-base font-bold text-ink">
                    {item.title}
                  </h3>
                </div>
                <p className="mt-1.5 text-sm text-ink-soft">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:px-12">
        <h2 className="text-center font-display text-2xl font-bold text-ink sm:text-3xl">
          How it works
        </h2>
        <div className="mt-9 grid grid-cols-1 gap-5 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <div key={step.title} className="flex flex-col items-center text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-navy font-display text-lg font-bold text-gold">
                {i + 1}
              </span>
              <h3 className="mt-3 font-display text-lg font-bold text-ink">
                {step.title}
              </h3>
              <p className="mt-1 max-w-xs text-sm text-ink-soft">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-surface">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-8 px-4 py-14 sm:px-6 md:flex-row lg:px-12">
          <div className="relative h-64 w-48 shrink-0 overflow-hidden rounded-2xl bg-accent-soft sm:h-72 sm:w-56">
            <Image
              src="/brand/josie-headshot.png"
              alt="Josie, founder of TC Optimize"
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
              After 8 years in real estate as an agent, ISA and operations
              manager, I found my passion in transaction coordination, then in
              the systems behind it. Now I&rsquo;m a TC turned software
              consultant, helping agents, brokers and transaction coordinators
              streamline their operations in Open to Close.
            </p>
            <Link
              href="/about"
              className="mt-5 inline-block text-sm font-semibold text-accent"
            >
              Read our story &rarr;
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-4xl px-4 py-16 text-center sm:px-6">
        <h2 className="font-display text-2xl font-bold text-ink sm:text-3xl">
          Ready to make every click count?
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-ink-soft">
          Get pricing and an overview of how setup works, or create a free
          account and look around.
        </p>
        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/pricing"
            className="w-full rounded-lg bg-navy px-6 py-3 text-sm font-semibold text-white sm:w-auto"
          >
            Get Pricing &amp; Setup Details
          </Link>
          <Link
            href="/signup"
            className="w-full rounded-lg border border-navy px-6 py-3 text-sm font-semibold text-navy sm:w-auto"
          >
            Create a free account
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}
