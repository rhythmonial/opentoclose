import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";

// The audit pages' logo, centered above the title: white and gold on the
// navy section (onDark), navy and gold on light ones.
export function AuditLogo({ className = "", onDark = false }: { className?: string; onDark?: boolean }) {
  return (
    <div className={`flex justify-center ${className}`}>
      <Link href="/" className="inline-flex items-center gap-2.5">
        <BrandMark onDark={onDark} className="h-9 w-9 shrink-0" />
        <span className={`font-display text-xl font-bold sm:text-2xl ${onDark ? "text-white" : "text-ink"}`}>
          OTC Setup with Josie
        </span>
      </Link>
    </div>
  );
}
