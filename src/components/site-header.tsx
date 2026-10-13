"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown, Heart, Menu, ShoppingBag, User } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { SearchBox } from "@/components/search-box";
import { MobileMenu } from "@/components/mobile-menu";
import { useBag } from "@/lib/bag-store";
import type { MenuGroup } from "@/lib/storefront";

export function SiteHeader({ menu }: { menu: MenuGroup[] }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const { count: bagCount } = useBag();

  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const active = menu.find((c) => c.id === activeCategory) ?? null;

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4">
        {/* Mobile menu trigger */}
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="grid size-10 place-items-center rounded-full transition-colors hover:bg-muted lg:hidden"
        >
          <Menu className="size-5" />
        </button>

        {/* Logo */}
        <Link href="/" className="font-heading text-xl font-extrabold tracking-tight lg:text-2xl">
          AUSSIENT
        </Link>

        {/* Desktop nav + mega menu */}
        <nav
          className="ml-6 hidden h-full items-stretch lg:flex"
          onMouseLeave={() => setActiveCategory(null)}
        >
          {menu.map((cat) => (
            <div
              key={cat.id}
              className="flex items-stretch"
              onMouseEnter={() => setActiveCategory(cat.children.length > 0 ? cat.id : null)}
            >
              <Link
                href={cat.url}
                onFocus={() => setActiveCategory(cat.children.length > 0 ? cat.id : null)}
                className={cn(
                  "flex items-center gap-1 px-3.5 font-heading text-sm font-bold uppercase tracking-wide transition-colors duration-200",
                  cat.label.toLowerCase() === "sale" && "text-brand-accent",
                  activeCategory === cat.id && "text-brand-accent",
                )}
              >
                {cat.label}
                {cat.children.length > 0 && (
                  <ChevronDown
                    className={cn(
                      "size-3.5 transition-transform duration-200 ease-snappy",
                      activeCategory === cat.id && "rotate-180",
                    )}
                  />
                )}
              </Link>
            </div>
          ))}
        </nav>

        {/* Right actions */}
        <div className="ml-auto flex items-center gap-0.5">
          <SearchBox />
          <Link
            href="/wishlist"
            aria-label="Wishlist"
            className="hidden size-10 place-items-center rounded-full transition-colors hover:bg-muted sm:grid"
          >
            <Heart className="size-5" />
          </Link>
          <Link
            href="/account"
            aria-label="Account"
            className="hidden size-10 place-items-center rounded-full transition-colors hover:bg-muted sm:grid"
          >
            <User className="size-5" />
          </Link>
          <Link
            href="/bag"
            aria-label={`Bag, ${bagCount} items`}
            className="relative grid size-10 place-items-center rounded-full transition-colors hover:bg-muted"
          >
            <ShoppingBag className="size-5" />
            {bagCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-brand-accent px-1 text-[0.65rem] font-bold text-brand-accent-foreground">
                {bagCount}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* Mega menu panel */}
      <div
        className={cn(
          "absolute inset-x-0 top-full hidden origin-top border-b border-border bg-background shadow-lg transition-all duration-200 ease-snappy lg:block",
          active
            ? "pointer-events-auto scale-y-100 opacity-100"
            : "pointer-events-none -translate-y-1 opacity-0",
        )}
        onMouseEnter={() => active && setActiveCategory(active.id)}
        onMouseLeave={() => setActiveCategory(null)}
      >
        {active && (
          <div className="mx-auto grid max-w-7xl grid-cols-[1.4fr_1fr] gap-8 px-4 py-6">
            {/* Links */}
            <div>
              <div className="mb-4 flex items-baseline gap-3">
                <h2 className="text-display text-xl">{active.label}</h2>
                <Link
                  href={active.url}
                  className="text-xs font-medium text-brand-accent hover:underline"
                >
                  Shop all →
                </Link>
              </div>
              <ul className="grid grid-cols-2 gap-x-6 gap-y-2">
                {active.children.map((link) => (
                  <li key={link.id}>
                    <Link
                      href={link.url}
                      className="text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Category picture */}
            <Link
              href={active.url}
              className="group/pic relative flex min-h-48 items-end overflow-hidden rounded-lg bg-brand-ink p-4"
            >
              {active.image && (
                <Image src={active.image} alt="" fill sizes="40vw" className="object-cover" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              <div className="relative">
                <p className="font-heading text-lg font-extrabold uppercase text-white">
                  Shop {active.label}
                </p>
                <Button size="sm" className="mt-2 bg-white text-brand-ink hover:bg-white/90">
                  Explore
                </Button>
              </div>
            </Link>
          </div>
        )}
      </div>

      <MobileMenu menu={menu} open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </header>
  );
}
