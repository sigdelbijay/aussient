"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

const TABS = [
  { href: "/admin/content", label: "Overview" },
  { href: "/admin/content/home", label: "Home page" },
  { href: "/admin/content/menus", label: "Menus" },
  { href: "/admin/content/announcements", label: "Announcement bar" },
  { href: "/admin/content/pages", label: "Pages" },
  { href: "/admin/content/popups", label: "Pop-ups" },
  { href: "/admin/content/redirects", label: "Redirects" },
  { href: "/admin/content/emails", label: "Emails" },
];

/** Tabs across the top of every Site Content page (scrolls sideways on phones). */
export function ContentNav() {
  const pathname = usePathname();
  const active = (href: string) => (href === "/admin/content" ? pathname === href : pathname.startsWith(href));
  return (
    <nav aria-label="Site content" className="-mx-4 mb-6 overflow-x-auto px-4 sm:-mx-8 sm:px-8">
      <ul className="flex w-max gap-1 border-b border-border text-sm">
        {TABS.map((t) => (
          <li key={t.href}>
            <Link
              href={t.href}
              aria-current={active(t.href) ? "page" : undefined}
              className={cn("-mb-px block border-b-2 px-3 py-2 whitespace-nowrap", active(t.href) ? "border-brand-ink font-semibold" : "border-transparent text-muted-foreground hover:text-foreground")}
            >
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
