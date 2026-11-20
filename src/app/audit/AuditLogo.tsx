import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";

// The audit pages' header: the logo, centered.
export function AuditLogo() {
  return (
    <div className="flex justify-center bg-bg px-4 py-5">
      <Link href="/" className="flex items-center gap-2.5 sm:gap-3">
        <BrandMark className="h-9 w-9 shrink-0 sm:h-10 sm:w-10" />
        <span className="font-display text-lg font-bold text-ink sm:text-xl">OTC Setup with Josie</span>
      </Link>
    </div>
  );
}
