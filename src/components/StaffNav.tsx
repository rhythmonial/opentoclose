"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/leads", label: "Leads" },
  { href: "/dashboard/stats", label: "Stats" },
];

export function StaffNav() {
  const pathname = usePathname();

  return (
    <div className="flex h-[64px] shrink-0 items-center justify-between gap-2 border-b border-border bg-surface px-4 sm:h-[76px] sm:px-6 lg:px-12">
      <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-3">
        <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] bg-navy sm:h-[34px] sm:w-[34px]">
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
        <span className="hidden truncate font-display text-[17px] font-bold text-ink sm:inline">
          OTC Setup with Josie
        </span>
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-3 overflow-x-auto px-1 sm:flex-none sm:justify-center sm:gap-6 sm:px-0">
        {LINKS.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`shrink-0 whitespace-nowrap text-xs sm:text-sm ${
                isActive ? "font-semibold text-ink" : "font-medium text-ink-soft"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <Link
          href="/profile"
          aria-label="Profile"
          title="Profile"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-ink-soft sm:h-9 sm:w-9"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
