import type { Metadata } from "next";
import Link from "next/link";
import { StatesServicedField } from "@/components/StatesServicedField";
import { MarketingFooter } from "@/components/MarketingFooter";
import { submitFoundingApplication } from "./actions";
import { ChoiceQuestion } from "./ChoiceQuestion";
import { COMPANY_STRUCTURES, QUESTIONS } from "./questions";

export const metadata: Metadata = {
  title: "Apply for the Founding Group | OTC Setup with Josie",
  description: "Apply for one of 12 founding spots in the Open to Close setup course.",
};

const INPUT =
  "rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent";

// The founding group application: like Setup Initiation (business, states,
// tools, contact), plus qualifying questions.
export default async function FoundingApplicationPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;

  return (
    <main className="flex flex-1 flex-col bg-bg">
      <section className="bg-navy text-white">
        <div className="mx-auto max-w-3xl px-5 py-12 text-center sm:px-6">
          <div className="font-caption text-xs font-semibold uppercase tracking-wide text-gold">
            Founding Group Application
          </div>
          <h1 className="mt-3 font-display text-3xl font-bold sm:text-4xl">Apply for a spot</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-white/80 sm:text-base">
            We&rsquo;ll review every application and reach out to the people chosen for each group.
          </p>
          <p className="mt-2 text-sm font-semibold text-white">*For brand-new Open to Close accounts only*</p>
        </div>
      </section>

      <div className="mx-auto w-full max-w-2xl px-4 py-10">
        {sent ? (
          <div className="rounded-xl border border-success/30 bg-success-soft p-6 text-center">
            <h2 className="font-display text-xl font-bold text-success">Thanks for applying!</h2>
            <p className="mt-2 text-sm text-ink-soft">
              Your application is in. We&rsquo;ll review it and reach out by email.
            </p>
            <Link href="/" className="mt-4 inline-block text-sm font-semibold text-accent">
              &larr; Back to the founding group
            </Link>
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-5 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
                {error}
              </div>
            )}
            <form action={submitFoundingApplication} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <h2 className="text-[15px] font-bold text-ink sm:col-span-2">Your business</h2>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-ink">Company Structure</span>
                <select name="company_structure" required defaultValue="" className={INPUT}>
                  <option value="" disabled>
                    Select one
                  </option>
                  {COMPANY_STRUCTURES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-ink">Business, Brokerage, or Team Name</span>
                <input name="business_name" required maxLength={200} className={INPUT} />
              </label>
              <StatesServicedField />
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="text-sm font-medium text-ink">Your Current Transaction Management Software</span>
                <input
                  name="tms"
                  required
                  maxLength={120}
                  placeholder="e.g. Open to Close, AFrame, TcDocs"
                  className={INPUT}
                />
              </label>

              <hr className="my-2 border-border sm:col-span-2" />
              <h2 className="text-[15px] font-bold text-ink sm:col-span-2">Your contact info</h2>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-ink">First Name</span>
                <input name="first_name" required maxLength={100} autoComplete="given-name" className={INPUT} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-ink">Last Name</span>
                <input name="last_name" required maxLength={100} autoComplete="family-name" className={INPUT} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-ink">Email</span>
                <input name="email" type="email" required maxLength={200} autoComplete="email" className={INPUT} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-ink">Cell Phone</span>
                <input name="cell_phone" type="tel" maxLength={40} autoComplete="tel" className={INPUT} />
              </label>

              <hr className="my-2 border-border sm:col-span-2" />
              <h2 className="text-[15px] font-bold text-ink sm:col-span-2">A few questions</h2>
              {QUESTIONS.map((q) =>
                q.options ? (
                  <ChoiceQuestion
                    key={q.key}
                    name={q.key}
                    label={q.label}
                    options={q.options}
                    notes={q.notes}
                    required={q.required}
                  />
                ) : (
                  <label key={q.key} className="flex flex-col gap-1.5 sm:col-span-2">
                    <span className="text-sm font-medium text-ink">
                      {q.label}
                      {!q.required && <span className="font-normal text-ink-faint"> (optional)</span>}
                    </span>
                    {q.long ? (
                      <textarea name={q.key} rows={4} maxLength={2000} required={q.required} className={INPUT} />
                    ) : (
                      <input name={q.key} maxLength={200} required={q.required} className={INPUT} />
                    )}
                  </label>
                ),
              )}

              <button
                type="submit"
                className="mt-2 justify-self-center rounded-lg bg-accent px-8 py-2.5 text-sm font-semibold text-white sm:col-span-2"
              >
                Submit Application
              </button>
            </form>
          </>
        )}
      </div>
      <MarketingFooter />
    </main>
  );
}
