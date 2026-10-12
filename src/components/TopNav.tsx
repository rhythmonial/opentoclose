import Link from "next/link";
import { signOut } from "@/app/login/actions";

export function TopNav({
  businessName,
  initials,
  active,
}: {
  businessName: string;
  initials: string;
  active: "setup" | "resources" | "terminology" | "profile";
}) {
  const linkClass = (key: typeof active) =>
    `text-sm ${
      active === key ? "font-semibold text-ink" : "font-medium text-ink-soft"
    }`;

  return (
    <div className="flex h-[76px] shrink-0 items-center justify-between border-b border-border bg-surface px-12">
      <Link href="/portal" className="flex items-center gap-3">
        <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] bg-accent">
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
        <span className="font-display text-[17px] font-bold text-ink">
          OTC Setup with Josie
        </span>
      </Link>

      <div className="flex items-center gap-7">
        <Link href="/portal" className={linkClass("setup")}>
          Setup
        </Link>
        <Link href="/resources" className={linkClass("resources")}>
          Resource Center
        </Link>
        <Link href="/terminology" className={linkClass("terminology")}>
          Terminology
        </Link>
        <Link href="/profile" className={linkClass("profile")}>
          Profile
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <span className="hidden text-sm text-ink-soft sm:inline">
          {businessName}
        </span>
        <form action={signOut}>
          <button
            type="submit"
            aria-label="Sign out"
            title="Sign out"
            className="flex h-9 w-9 items-center justify-center rounded-[9px] bg-navy font-display text-[13px] font-bold text-white"
          >
            {initials}
          </button>
        </form>
      </div>
    </div>
  );
}
