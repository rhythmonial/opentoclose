"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PasswordInput } from "@/components/PasswordInput";
import { updatePassword } from "./actions";

export default function ResetPasswordPage() {
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"checking" | "ready" | "invalid">(
    "checking",
  );

  useEffect(() => {
    setError(new URLSearchParams(window.location.search).get("error"));

    const supabase = createClient();

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setStatus("ready");
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session) setStatus("ready");
        if (event === "PASSWORD_RECOVERY") setStatus("ready");
      },
    );

    const timeout = setTimeout(() => {
      setStatus((current) => (current === "checking" ? "invalid" : current));
    }, 4000);

    return () => {
      listener.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  return (
    <main className="flex flex-1 items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-2xl font-bold text-ink">
          Set a new password
        </h1>

        {status === "checking" && (
          <p className="mt-4 text-sm text-ink-soft">Verifying your link…</p>
        )}

        {status === "invalid" && (
          <div className="mt-5 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
            This link is invalid or has expired. Request a new one from the{" "}
            <a href="/forgot-password" className="font-medium underline">
              forgot password
            </a>{" "}
            page.
          </div>
        )}

        {status === "ready" && (
          <>
            <p className="mt-1.5 text-sm text-ink-soft">
              Choose a password for your account.
            </p>

            {error && (
              <div className="mt-5 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
                {error}
              </div>
            )}

            <form action={updatePassword} className="mt-6 flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-ink">
                  New password
                </span>
                <PasswordInput
                  name="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </label>
              <button
                type="submit"
                className="mt-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white"
              >
                Save password
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
