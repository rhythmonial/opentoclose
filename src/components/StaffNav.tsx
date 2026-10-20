"use client";

import { BrandMark } from "@/components/BrandMark";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/clients", label: "Clients" },
];

const DEV_LINKS = [
  { href: "/dashboard/tasks", label: "Tasks" },
  { href: "/dashboard/resources", label: "Resources" },
];

export function StaffNav({ isDev = false }: { isDev?: boolean }) {
  const pathname = usePathname();
  const links = isDev ? [...LINKS, ...DEV_LINKS] : LINKS;
  const [newLeadCount, setNewLeadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    createClient()
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("status", "new")
      .then(({ count }) => {
        if (!cancelled) setNewLeadCount(count ?? 0);
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return (
    <div className="flex h-[64px] shrink-0 items-center justify-between gap-2 border-b border-border bg-surface px-4 sm:h-[76px] sm:px-6 lg:px-12">
      <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-3">
        <BrandMark className="h-[30px] w-[30px] shrink-0 sm:h-[34px] sm:w-[34px]" />
        <span className="hidden truncate font-display text-[17px] font-bold text-ink sm:inline">
          OTC Setup with Josie
        </span>
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-3 overflow-x-auto px-1 sm:flex-none sm:justify-center sm:gap-6 sm:px-0">
        {links.map((link) => {
          const isActive =
            link.href === "/dashboard"
              ? pathname === link.href
              : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs sm:text-sm ${
                isActive ? "font-semibold text-ink" : "font-medium text-ink-soft"
              }`}
            >
              {link.label}
              {link.href === "/dashboard/clients" && newLeadCount > 0 && (
                <span
                  title={`${newLeadCount} new lead${newLeadCount === 1 ? "" : "s"}`}
                  className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 font-caption text-[10px] font-bold text-white"
                >
                  {newLeadCount}
                </span>
              )}
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
