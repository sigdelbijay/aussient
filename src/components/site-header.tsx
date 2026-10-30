"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown, Heart, Menu, ShoppingBag, User } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { SearchBox } from "@/components/search-box";
import { MobileMenu } from "@/components/mobile-menu";
import { openBag, useBag } from "@/lib/bag-store";
import type { MenuGroup } from "@/lib/storefront";
import { BRAND_LOGO } from "@/lib/brand";

// The header sits on the logo's dark teal: white icons, a light hover wash and a
// white focus ring, so everything on it keeps AA contrast (white on teal 7.7:1).
const onTeal = "outline-white focus-visible:outline-2 focus-visible:outline-offset-2";
const iconButton = cn("size-10 place-items-center rounded-full transition-colors hover:bg-white/15", onTeal);

export function SiteHeader({ menu, storeName, logo }: { menu: MenuGroup[]; storeName: string; logo: string | null }) {
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
    // The solid logo-teal (#245a68) background stays on a ::before layer, not the header
    // itself, so a backdrop blur can be added back without trapping the fixed mobile drawer.
    // White text is set on the bar only, so the mega menu and mobile drawer keep dark text.
    <header className="sticky top-0 z-50 border-b border-brand-teal before:absolute before:inset-0 before:-z-10 before:bg-brand-teal">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 text-brand-teal-foreground">
        {/* Mobile menu trigger */}
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className={cn(iconButton, "grid lg:hidden")}
        >
          <Menu className="size-5" />
        </button>

        {/* Logo */}
        {/* The logo uploaded in Settings, else the Aussient logo in /public/brand. */}
        <Link href="/" className={cn("shrink-0 rounded-sm", onTeal)}>
          {logo ? (
            <Image src={logo} alt={storeName} width={160} height={48} loading="eager" className="h-8 w-auto max-w-40 object-contain lg:h-9" />
          ) : (
            <Image
              src={BRAND_LOGO.src}
              alt={storeName}
              width={BRAND_LOGO.width}
              height={BRAND_LOGO.height}
              loading="eager"
              sizes="176px"
              className="h-8 w-auto lg:h-9"
            />
          )}
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
              onMouseEnter={() => setActiveCategory(cat.children.length > 0 || cat.image ? cat.id : null)}
            >
              <Link
                href={cat.url}
                onFocus={() => setActiveCategory(cat.children.length > 0 || cat.image ? cat.id : null)}
                className={cn(
                  "flex items-center gap-1 px-3.5 font-heading text-sm font-bold uppercase tracking-wide transition-colors duration-200 hover:text-brand-highlight",
                  onTeal,
                  cat.label.toLowerCase() === "sale" && "text-brand-highlight",
                  activeCategory === cat.id && "text-brand-highlight",
                )}
              >
                {cat.label}
                {(cat.children.length > 0 || cat.image) && (
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
          <SearchBox className={onTeal} />
          <Link
            href="/wishlist"
            aria-label="Wishlist"
            className={cn(iconButton, "hidden sm:grid")}
          >
            <Heart className="size-5" />
          </Link>
          <Link
            href="/account"
            aria-label="Account"
            className={cn(iconButton, "hidden sm:grid")}
          >
            <User className="size-5" />
          </Link>
          <Link
            href="/cart"
            onClick={(e) => {
              // Open the slide-out bag; the link still works without JavaScript.
              e.preventDefault();
              openBag();
            }}
            aria-label={`Bag, ${bagCount} items`}
            className={cn(iconButton, "relative grid")}
          >
            <ShoppingBag className="size-5" />
            {bagCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-brand-yellow px-1 text-[0.65rem] font-bold text-brand-ink">
                {bagCount}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* Mega menu panel */}
      <div
        className={cn(
          "absolute inset-x-0 top-full hidden origin-top border-b border-border bg-background text-foreground shadow-lg transition-all duration-200 ease-snappy lg:block",
          active
            ? "pointer-events-auto scale-y-100 opacity-100"
            : "pointer-events-none -translate-y-1 opacity-0",
        )}
        onMouseEnter={() => active && setActiveCategory(active.id)}
        onMouseLeave={() => setActiveCategory(null)}
      >
        {active && (
          <div className="mx-auto grid max-w-7xl grid-cols-[1.4fr_1fr] gap-8 px-4 py-6">
            {/* Sub-categories: each is a column heading with its own sub-categories under it. */}
            <div>
              <div className="mb-4 flex items-baseline gap-3">
                <h2 className="text-display text-xl">{active.label}</h2>
                <Link href={active.url} className="text-xs font-medium text-brand-accent hover:underline">
                  Shop all →
                </Link>
              </div>
              <ul className="grid grid-cols-3 gap-x-6 gap-y-5">
                {active.children.map((link) => (
                  <li key={link.id}>
                    <Link
                      href={link.url}
                      className={cn(
                        "text-sm transition-colors duration-200 hover:text-brand-accent",
                        link.children?.length ? "font-semibold" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {link.label}
                    </Link>
                    {!!link.children?.length && (
                      <ul className="mt-2 grid gap-1.5">
                        {link.children.map((sub) => (
                          <li key={sub.id}>
                            <Link
                              href={sub.url}
                              className="text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground"
                            >
                              {sub.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
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

      <MobileMenu menu={menu} storeName={storeName} logo={logo} open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </header>
  );
}
