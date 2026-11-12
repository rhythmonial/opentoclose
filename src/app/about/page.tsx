import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { MarketingFooter } from "@/components/MarketingFooter";

export const metadata: Metadata = {
  title: "About | OTC Setup with Josie",
  description:
    "Josie helps TCs, real estate teams and brokerages set up Open to Close right the first time, built around their own contracts and workflow.",
};

export default function AboutPage() {
  return (
    <main className="flex flex-1 flex-col bg-bg">
      <section className="bg-navy text-white">
        <div className="mx-auto max-w-4xl px-5 py-16 text-center sm:px-6 sm:py-20">
          <div className="font-caption text-xs font-semibold uppercase tracking-wide text-gold">
            About
          </div>
          <h1 className="mt-4 font-display text-3xl font-bold leading-tight sm:text-5xl">
            <span className="block whitespace-nowrap">Open to Close Setups</span>
            <span className="mt-1 block whitespace-nowrap text-xl sm:text-3xl">done right the first time</span>
          </h1>
          <p className="mx-auto mt-5 max-w-3xl text-base text-white/85 sm:text-lg">
            Most Open to Close setups go wrong before the first transaction is ever entered.
            Spreadsheets, generic templates and hours of training videos leave people building
            things they&rsquo;ll never use. I help TCs, real estate teams and brokerages build
            their account around how they actually work.
          </p>
        </div>
      </section>

      <section className="bg-surface">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-10 px-4 py-14 sm:px-6 md:grid-cols-[260px_1fr] lg:px-12">
          <div className="relative mx-auto h-80 w-56 overflow-hidden rounded-2xl md:sticky md:top-8 md:mx-0 md:h-96 md:w-full">
            <Image
              src="/brand/josie-headshot.png"
              alt="Josie, founder of OTC Setup with Josie"
              fill
              sizes="260px"
              className="object-cover object-top"
            />
          </div>

          <div>
            <div className="font-caption text-xs font-semibold uppercase tracking-wide text-ink-faint">
              My story
            </div>
            <h2 className="mt-2 font-display text-3xl font-bold text-ink">Hi, I&rsquo;m Josie!</h2>
            <p className="mt-2 font-display text-lg font-semibold text-navy">
              Open to Close setup specialist, and a TC at heart.
            </p>

            <div className="mt-5 flex flex-col gap-4 text-ink-soft">
              <p>
                I&rsquo;ve been in real estate since 2015 as an Agent, ISA, Listing Manager, Listing
                Referral Agent and Operations Manager, and found my passion in Transaction
                Management. In 2020 I turned my focus to the tech side.
              </p>
              <p>
                While planning the launch of my own TC business, I met with the owners of 10 Keller
                Williams offices in the Atlanta area about starting an in-house Transaction
                Management Division. Researching software for them, I found the best transaction
                management tool of its time, and soon after, Open to Close released its new, fully
                automated platform. I dove in head first and left no button un-clicked.
              </p>
              <p>
                One defining moment was building an email template with conditional logic for the
                first time and watching it remove every manual edit. That&rsquo;s when I knew how
                much a well-built Open to Close account could change a TC&rsquo;s day.
              </p>
              <p>
                Since then I&rsquo;ve set up nearly 300 Open to Close accounts and helped more than
                2,000 real estate professionals through my courses and 1-on-1 sessions, across
                dozens of states. I&rsquo;ve lived the challenges TCs face, and I solve them with
                clear processes, automation and integrations built into the setup from day one.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-3xl px-4 py-14 text-center sm:px-6">
        <div>
          <div className="font-caption text-xs font-semibold uppercase tracking-wide text-ink-faint">
            What I do today
          </div>
          <h2 className="mt-2 font-display text-2xl font-bold text-ink sm:text-3xl">
            <span className="block">A setup built</span>
            <span className="block">around your contracts</span>
          </h2>
          <p className="mt-3 text-ink-soft">
            I took everything I&rsquo;ve learned and built an interactive setup course. You upload
            your blank contracts, and each lesson walks you through building your Open to Close
            account from them: fields, dates, documents, contacts, emails, tasks, intake forms and
            how it all comes together to run your files.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/#offer"
              className="rounded-lg bg-navy px-5 py-2.5 text-center text-sm font-semibold text-white"
            >
              See the founding group offer
            </Link>
            <Link
              href="/founding"
              className="rounded-lg border border-navy px-5 py-2.5 text-center text-sm font-semibold text-navy"
            >
              Apply for a founding spot
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}
