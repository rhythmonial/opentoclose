import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";

// The audit pages' logo: a small rounded bubble, centered above the title.
export function AuditLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex justify-center ${className}`}>
      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-full bg-surface py-1.5 pl-1.5 pr-4 shadow-sm"
      >
        <BrandMark className="h-7 w-7 shrink-0" />
        <span className="font-display text-sm font-bold text-ink">OTC Setup with Josie</span>
      </Link>
    </div>
  );
}
