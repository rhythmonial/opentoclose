import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";

export function MarketingFooter() {
  return (
    <footer className="bg-navy text-white/80">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:flex-row sm:items-start sm:justify-between sm:px-6 lg:px-12">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-surface p-1.5">
            <BrandMark className="h-9 w-9" />
          </span>
          <div>
            <div className="font-display text-base font-bold text-white">
              TC Optimize
            </div>
            <div className="mt-0.5 text-sm">Save Time, Make Cents</div>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 text-sm">
          <span className="font-semibold text-white">Contact</span>
          <a href="mailto:setup@tcoptimize.com" className="hover:text-white">
            setup@tcoptimize.com
          </a>
          <a href="tel:+14042369519" className="hover:text-white">
            404-236-9519
          </a>
          <span>Suwanee, GA 30024</span>
        </div>

        <div className="flex flex-col gap-1.5 text-sm">
          <span className="font-semibold text-white">Explore</span>
          <Link href="/" className="hover:text-white">
            Home
          </Link>
          <Link href="/about" className="hover:text-white">
            About
          </Link>
          <Link href="/pricing" className="hover:text-white">
            Pricing
          </Link>
          <Link href="/login" className="hover:text-white">
            Sign in
          </Link>
        </div>
      </div>
      <div className="border-t border-white/10 px-4 py-4 text-center text-xs text-white/60">
        &copy; {new Date().getFullYear()} TC Optimize, LLC. All rights
        reserved.
      </div>
    </footer>
  );
}
