import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";

// The audit pages' logo: a small rounded bubble, centered above the title.
export function AuditLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex justify-center ${className}`}>
      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-xl bg-surface px-4 py-2.5 shadow-sm"
      >
        <BrandMark className="h-8 w-8 shrink-0" />
        <span className="font-display text-base font-bold text-ink">OTC Setup with Josie</span>
      </Link>
    </div>
  );
}
