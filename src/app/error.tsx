"use client";

// Shown if a page hits an unexpected error, with a way back instead of a
// dead end. (A page left open across an update can need a full reload.)
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex flex-1 items-center justify-center bg-bg px-4 py-16">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 text-center">
        <h1 className="font-display text-xl font-bold text-ink">Something went wrong</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Your saved work is safe. Try again, or reload the page if that doesn&rsquo;t help.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-ink"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white"
          >
            Reload page
          </button>
        </div>
      </div>
    </main>
  );
}
