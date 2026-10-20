import Image from "next/image";

export function BrandMark({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/logo-mark.png"
      alt="OTC Setup with Josie"
      width={72}
      height={72}
      priority
      className={className}
    />
  );
}
