import Image from "next/image";

// The logo mark: navy and gold, or (onDark) white and gold for navy and
// other dark backgrounds.
export function BrandMark({ className, onDark = false }: { className?: string; onDark?: boolean }) {
  return (
    <Image
      src={onDark ? "/brand/logo-mark-dark.png" : "/brand/logo-mark.png"}
      alt="OTC Setup with Josie"
      width={72}
      height={72}
      priority
      className={className}
    />
  );
}
