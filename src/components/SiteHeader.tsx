import { BrandMark } from "@/components/BrandMark";
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
        <BrandMark className="h-8 w-8 shrink-0 sm:h-9 sm:w-9" />
        <span className="truncate font-display text-base font-bold text-ink sm:text-lg">
          <span className="hidden sm:inline">OTC Setup with Josie</span>
          <span className="sm:hidden">OTC Setup</span>
        </span>
      </Link>

      <div className="flex shrink-0 items-center gap-4 sm:gap-7">
        <Link href="/about" className="text-sm font-semibold text-ink-soft">
          About
        </Link>
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
