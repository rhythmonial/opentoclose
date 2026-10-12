import { requestInfo } from "./actions";

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-2xl font-bold text-ink">
          Get pricing &amp; setup details
        </h1>
        <p className="mt-1.5 text-sm text-ink-soft">
          Tell us where to send pricing and an overview of how setup works.
        </p>

        {error && (
          <div className="mt-5 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        {sent ? (
          <div className="mt-5 rounded-lg border border-success/30 bg-success-soft px-4 py-3 text-sm text-success">
            Thanks! Keep an eye on your inbox.
          </div>
        ) : (
          <form action={requestInfo} className="mt-6 flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink">Name</span>
              <input
                type="text"
                name="name"
                required
                className="rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink">Email</span>
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                className="rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink">
                Phone (optional)
              </span>
              <input
                type="tel"
                name="phone"
                className="rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent"
              />
            </label>
            <button
              type="submit"
              className="mt-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white"
            >
              Send me the details
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
