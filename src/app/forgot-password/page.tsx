import Link from "next/link";
import { requestPasswordReset } from "./actions";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <h1 className="font-script text-[38px] leading-tight text-ink">
          Reset your password
        </h1>
        <p className="mt-1.5 text-sm text-ink-soft">
          Enter your email and we&rsquo;ll send you a link to set a new one.
        </p>

        {error && (
          <div className="mt-5 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}
        {sent && (
          <div className="mt-5 rounded-lg border border-success/30 bg-success-soft px-4 py-3 text-sm text-success">
            If an account exists for that email, a reset link is on its way.
          </div>
        )}

        <form action={requestPasswordReset} className="mt-6 flex flex-col gap-4">
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
          <button
            type="submit"
            className="mt-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white"
          >
            Send reset link
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-ink-soft">
          <Link href="/login" className="font-medium text-accent">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
