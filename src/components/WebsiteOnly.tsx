"use client";

import { usePathname } from "next/navigation";

// The website's own pages (not the app), where the site header shows even
// when someone is signed in.
const WEBSITE_PATHS = ["/", "/about", "/pricing", "/founding", "/classic-home"];

export function WebsiteOnly({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return WEBSITE_PATHS.includes(path) ? <>{children}</> : null;
}
