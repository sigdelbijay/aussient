"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  FolderTree,
  Gauge,
  History,
  Home,
  Image as ImageIcon,
  Layers,
  Menu,
  Newspaper,
  Package,
  Percent,
  Ruler,
  Settings,
  Shapes,
  ShoppingCart,
  Star,
  Tag,
  Users,
  X,
} from "lucide-react";
import { cn } from "cn";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: Gauge },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/media", label: "Media library", icon: ImageIcon, sub: true },
  { href: "/admin/product-types", label: "Product Types", icon: Shapes },
  { href: "/admin/categories", label: "Categories", icon: FolderTree },
  { href: "/admin/collections", label: "Collections", icon: Layers },
  { href: "/admin/brands", label: "Brands", icon: Tag },
  { href: "/admin/size-guides", label: "Size Guides", icon: Ruler },
  { href: "/admin/discounts", label: "Discounts", icon: Percent },
  { href: "/admin/orders", label: "Orders", icon: ShoppingCart },
  { href: "/admin/reviews", label: "Reviews", icon: Star },
  { href: "/admin/content", label: "Site Content", icon: FileText },
  { href: "/admin/content/home", label: "Home page", icon: Home, sub: true },
  { href: "/admin/content/pages", label: "Pages", icon: Newspaper, sub: true },
  { href: "/admin/settings", label: "Settings", icon: Settings, adminOnly: true },
  { href: "/admin/staff", label: "Staff", icon: Users, adminOnly: true },
  { href: "/admin/activity", label: "Activity log", icon: History },
];

export function AdminSidebar({
  email,
  isAdmin,
  badges,
}: {
  email: string;
  /** STAFF don't see admin-only sections (the pages check on the server too). */
  isAdmin: boolean;
  badges: Partial<Record<string, number>>;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // The most specific matching entry is highlighted (e.g. "Home page", not also "Site Content").
  const matches = NAV.filter((i) => (i.href === "/admin" ? pathname === i.href : pathname === i.href || pathname.startsWith(`${i.href}/`)));
  const current = matches.sort((a, b) => b.href.length - a.href.length)[0]?.href;
  const active = (href: string) => href === current;

  const nav = (
    <nav className="grid gap-0.5 p-3" aria-label="Admin">
      {NAV.filter((item) => isAdmin || !item.adminOnly).map(({ href, label, icon: Icon, sub }) => (
        <Link
          key={href}
          href={href}
          onClick={() => setOpen(false)}
          aria-current={active(href) ? "page" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
            sub && "ml-4 py-1.5 text-[0.8rem]",
            active(href) ? "bg-brand-paper/10 font-semibold text-brand-paper" : "text-brand-paper/70 hover:bg-brand-paper/5 hover:text-brand-paper",
          )}
        >
          <Icon className="size-4 shrink-0" />
          <span className="flex-1">{label}</span>
          {!!badges[href] && (
            <span className="rounded-full bg-brand-accent px-1.5 text-[0.65rem] font-bold text-brand-accent-foreground">
              {badges[href]}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );

  return (
    <>
      {/* Phones: top bar with a menu button */}
      <div className="sticky top-0 z-40 flex items-center justify-between bg-brand-ink px-4 py-3 text-brand-paper lg:hidden">
        <Link href="/admin" className="font-heading font-extrabold">
          AUSSIENT <span className="font-normal opacity-60">Admin</span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          className="grid size-9 place-items-center rounded-md hover:bg-brand-paper/10"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      {open && <div className="fixed inset-x-0 top-[3.75rem] bottom-0 z-40 overflow-y-auto bg-brand-ink lg:hidden">{nav}</div>}

      {/* Desktop: fixed sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col bg-brand-ink lg:flex">
        <Link href="/admin" className="px-6 py-5 font-heading text-lg font-extrabold text-brand-paper">
          AUSSIENT <span className="font-normal opacity-60">Admin</span>
        </Link>
        <div className="flex-1 overflow-y-auto">{nav}</div>
        <div className="border-t border-brand-paper/10 px-6 py-4 text-xs text-brand-paper/60">
          <p className="truncate">{email}</p>
          <Link href="/" className="mt-1 inline-block hover:text-brand-paper">
            View shop →
          </Link>
        </div>
      </aside>
    </>
  );
}
