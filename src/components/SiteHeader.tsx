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
    <div className="flex items-center justify-between px-12 py-6">
      <Link href="/" className="flex items-center gap-3">
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
      </Link>

      <div className="flex items-center gap-7">
        <Link href="/pricing" className="text-sm font-semibold text-ink-soft">
          Pricing
        </Link>
        <Link href="/login" className="text-sm font-semibold text-accent">
          Sign in
        </Link>
      </div>
    </div>
  );
}
