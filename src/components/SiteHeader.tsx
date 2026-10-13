import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export async function SiteHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    return null;
  }

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-6 lg:px-12">
      <Link href="/" className="flex min-w-0 items-center gap-2 sm:gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent sm:h-9 sm:w-9">
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
        <span className="truncate font-display text-base font-bold text-ink sm:text-lg">
          OTC Setup with Josie
        </span>
      </Link>

      <div className="flex shrink-0 items-center gap-4 sm:gap-7">
        <Link
          href="/pricing"
          className="text-sm font-semibold text-ink-soft"
        >
          Pricing
        </Link>
        <Link href="/login" className="text-sm font-semibold text-accent">
          Sign in
        </Link>
      </div>
    </div>
  );
}
