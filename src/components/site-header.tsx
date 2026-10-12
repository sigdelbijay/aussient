"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, Heart, Menu, ShoppingBag, User } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { SearchBox } from "@/components/search-box";
import { MobileMenu } from "@/components/mobile-menu";
import { navCategories } from "@/lib/placeholder-data";

export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Placeholder bag count — comes from the cart in a later prompt.
  const bagCount = 2;

  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const active = navCategories.find((c) => c.name === activeCategory) ?? null;

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
          {navCategories.map((cat) => (
            <div
              key={cat.name}
              className="flex items-stretch"
              onMouseEnter={() => setActiveCategory(cat.name)}
            >
              <Link
                href={cat.href}
                onFocus={() => setActiveCategory(cat.name)}
                className={cn(
                  "flex items-center gap-1 px-3.5 font-heading text-sm font-bold uppercase tracking-wide transition-colors duration-200",
                  cat.name === "Sale" && "text-brand-accent",
                  activeCategory === cat.name && "text-brand-accent",
                )}
              >
                {cat.name}
                {cat.links.length > 0 && (
                  <ChevronDown
                    className={cn(
                      "size-3.5 transition-transform duration-200 ease-snappy",
                      activeCategory === cat.name && "rotate-180",
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
        onMouseEnter={() => active && setActiveCategory(active.name)}
        onMouseLeave={() => setActiveCategory(null)}
      >
        {active && (
          <div className="mx-auto grid max-w-7xl grid-cols-[1.4fr_1fr] gap-8 px-4 py-6">
            {/* Links */}
            <div>
              <div className="mb-4 flex items-baseline gap-3">
                <h2 className="text-display text-xl">{active.name}</h2>
                <Link
                  href={active.href}
                  className="text-xs font-medium text-brand-accent hover:underline"
                >
                  Shop all →
                </Link>
              </div>
              <ul className="grid grid-cols-2 gap-x-6 gap-y-2">
                {active.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Category picture */}
            <Link
              href={active.href}
              className="group/pic relative flex items-end overflow-hidden rounded-lg p-4"
              style={{ background: active.image }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              <div className="relative">
                <p className="font-heading text-lg font-extrabold uppercase text-white">
                  Shop {active.name}
                </p>
                <Button size="sm" className="mt-2 bg-white text-brand-ink hover:bg-white/90">
                  Explore
                </Button>
              </div>
            </Link>
          </div>
        )}
      </div>

      <MobileMenu open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </header>
  );
}
