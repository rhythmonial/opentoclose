import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { MarketingFooter } from "@/components/MarketingFooter";

export const metadata: Metadata = {
  title: "About | OTC Setup with Josie",
  description:
    "The story of TC Optimize and Josie, a TC turned software consultant helping real estate teams and TCs streamline their operations.",
};

export default function AboutPage() {
  return (
    <main className="flex flex-1 flex-col bg-bg">
      <section className="bg-navy text-white">
        <div className="mx-auto max-w-4xl px-5 py-16 text-center sm:px-6 sm:py-20">
          <div className="font-caption text-xs font-semibold uppercase tracking-wide text-gold">
            About Us
          </div>
          <h1 className="mt-4 font-display text-3xl font-bold leading-tight sm:text-5xl">
            Our Mission
          </h1>
          <p className="mx-auto mt-5 max-w-3xl text-base text-white/85 sm:text-lg">
            To be the go-to resource for real estate teams &amp; TCs seeking
            software and system consulting, coaching, and community, providing
            them with the guidance and support they need to optimize their
            processes, stay ahead of the curve, and achieve their business and
            life goals.
          </p>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-6 px-4 py-14 sm:px-6 md:grid-cols-2 lg:px-12">
        <p className="text-ink-soft">
          To maintain our position at the forefront of the industry, TC
          Optimize immerses itself in a perpetual quest for knowledge. We keep
          a pulse on social media, articles, and videos to ensure we&rsquo;re
          always on the cutting edge. Our dedication to staying up-to-date
          guarantees that we deliver the most innovative and up-to-the-minute
          solutions for our clients and the real estate community.
        </p>
        <p className="text-ink-soft">
          At TC Optimize, we have big dreams. We envision ourselves as the
          ultimate resource for agents &amp; TCs seeking top-notch
          software/system consulting, coaching, and a vibrant community.
          Picture us as the go-to hub where Real Estate and TC Teams unite to
          scale their businesses, streamline their processes, and achieve
          unbridled success. When you think TC Optimize, think excellence,
          innovation, and an unwavering commitment to empowering real estate
          professionals!
        </p>
        <blockquote className="rounded-2xl border-l-4 border-gold bg-surface px-6 py-5 md:col-span-2">
          <p className="font-display text-xl font-bold text-navy sm:text-2xl">
            Welcome to the TCO Tribe, where we make every click count.
          </p>
          <p className="mt-2 text-sm text-ink-soft">
            Check out our time-saving solutions, process-focused mindset, and
            collaborative community to achieve your goals in record time.
          </p>
        </blockquote>
      </section>

      <section className="bg-surface">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-10 px-4 py-14 sm:px-6 md:grid-cols-[260px_1fr] lg:px-12">
          <div className="relative mx-auto h-80 w-56 overflow-hidden rounded-2xl bg-accent-soft md:sticky md:top-8 md:mx-0 md:h-96 md:w-full">
            <Image
              src="/brand/josie-headshot.png"
              alt="Josie, founder of TC Optimize"
              fill
              sizes="260px"
              className="object-cover object-top"
            />
          </div>

          <div>
            <div className="font-caption text-xs font-semibold uppercase tracking-wide text-ink-faint">
              The story of TC Optimize
            </div>
            <h2 className="mt-2 font-display text-3xl font-bold text-ink">
              Hi, I&rsquo;m Josie!
            </h2>
            <p className="mt-2 font-display text-lg font-semibold text-navy">
              The face behind TC Optimize and your go-to expert for all things
              real estate efficiency!
            </p>

            <div className="mt-5 flex flex-col gap-4 text-ink-soft">
              <p>
                With a passion for transactions and a relentless drive for
                efficiency, I have dedicated my career to helping real estate
                agents and transaction coordinators navigate the complexities of
                their roles. After spending 8 years in the industry, exploring
                different roles from agent to ISA to operations manager, I
                discovered my love for transaction coordination and the madness
                that happens behind the scenes.
              </p>
              <p>
                My journey with TC Optimize actually began when planning the
                launch of my TC business! I quickly realized the need for
                efficient systems and automated tools being offered a HUGE
                opportunity. I had several meetings with the owners of 10 Keller
                Williams offices in the Atlanta area interested in starting an
                in-house Transaction Management Division. We decided against the
                partnership to build the division and I continued my journey
                towards opening my own TC business.
              </p>
              <p>
                In my research for the KW offices, I had finally found the best
                TM software of its time. Before I knew it, they released their
                new and improved, fully automated Transaction Management
                Software! I dove in head first and left no button un-clicked. I
                learned all I needed to know about this amazing new tool built
                specifically for my role to help me save time and help more
                agents focus on THEIR strengths.
              </p>
            </div>

            <h3 className="mt-8 font-display text-xl font-bold text-ink">
              TC turned Software Consultant helping Agents, Brokers, and
              Transaction Coordinators streamline their operations.
            </h3>
            <div className="mt-4 flex flex-col gap-4 text-ink-soft">
              <p>
                One defining moment was when I implemented an email template
                with conditional logic for the first time. Witnessing the
                automation capabilities and how it eliminated the need for
                manual edits was a game-changer. It solidified my belief in the
                power of automation and its transformative impact on real estate
                processes.
              </p>
              <p>
                What sets me apart as an efficiency consultant and
                implementation specialist is my innovative mindset, experience
                in dozens of states, and expertise in mapping processes and
                identifying inefficiencies. I pride myself on being organized,
                resourceful, and tech-savvy, constantly staying up-to-date with
                the latest trends and tools inside and outside the industry.
              </p>
              <p>
                I have personally experienced the challenges that transaction
                coordinators face, and I overcame them by developing effective
                systems, processes, and incorporating automation and
                integrations into my workflows. This hands-on experience has
                given me valuable insights into the pain points of real estate
                professionals and the solutions they need.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-5xl grid-cols-1 items-center gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 lg:px-12">
        <div>
          <div className="font-caption text-xs font-semibold uppercase tracking-wide text-ink-faint">
            What we do today
          </div>
          <h2 className="mt-2 font-display text-2xl font-bold text-ink sm:text-3xl">
            Open to Close setup, your way
          </h2>
          <p className="mt-3 text-ink-soft">
            Today, TC Optimize helps TCs, real estate teams and brokerages get
            fully set up in Open to Close. Start free and explore the
            checklist, build it yourself with our DIY program&rsquo;s video
            lessons and resources, or have Josie&rsquo;s team build your
            setup with you.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/pricing"
              className="rounded-lg bg-navy px-5 py-2.5 text-center text-sm font-semibold text-white"
            >
              Get Pricing &amp; Setup Details
            </Link>
            <Link
              href="/#plans"
              className="rounded-lg border border-navy px-5 py-2.5 text-center text-sm font-semibold text-navy"
            >
              Compare plans
            </Link>
          </div>
        </div>
        <div className="relative aspect-[6/7] w-full max-w-sm justify-self-center overflow-hidden rounded-2xl">
          <Image
            src="/brand/laptop.png"
            alt="Working on a laptop"
            fill
            sizes="384px"
            className="object-cover"
          />
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}
