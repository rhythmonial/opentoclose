import { requestInfo } from "./actions";

export default async function RequestInfoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-3">
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

        <h1 className="font-display text-2xl font-bold text-ink">
          Get the details
        </h1>
        <p className="mt-1.5 text-sm text-ink-soft">
          Tell us where to send the overview of how setup works.
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
