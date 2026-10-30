"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown, Heart, User, X } from "lucide-react";
import { cn } from "cn";
import type { MenuGroup } from "@/lib/storefront";
import { BRAND_LOGO } from "@/lib/brand";

export function MobileMenu({
  menu,
  storeName,
  logo,
  open,
  onClose,
}: {
  menu: MenuGroup[];
  storeName: string;
  logo: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div
      className={cn(
        "fixed inset-0 z-[70] lg:hidden",
        open ? "pointer-events-auto" : "pointer-events-none",
      )}
      // Closed: hidden from screen readers AND can't be tabbed into.
      inert={!open}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-black/50 transition-opacity duration-200 ease-snappy",
          open ? "opacity-100" : "opacity-0",
        )}
      />

      {/* Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        className={cn(
          "absolute inset-y-0 left-0 flex w-[85%] max-w-sm flex-col bg-background text-foreground shadow-xl transition-transform duration-200 ease-snappy",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Top strip on the logo teal, like the header. */}
        <div className="flex items-center justify-between bg-brand-teal px-4 py-4 text-brand-teal-foreground">
          {logo ? (
            <Image src={logo} alt={storeName} width={160} height={48} className="h-8 w-auto max-w-40 object-contain" />
          ) : (
            <Image src={BRAND_LOGO.src} alt={storeName} width={BRAND_LOGO.width} height={BRAND_LOGO.height} sizes="160px" className="h-8 w-auto" />
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="grid size-9 place-items-center rounded-full outline-white transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          {menu.map((cat) => {
            const isOpen = expanded === cat.id;
            return (
              <div key={cat.id} className="border-b border-border/60">
                <div className="flex items-center">
                  <Link
                    href={cat.url}
                    onClick={onClose}
                    className="flex-1 px-4 py-3 font-heading text-base font-bold uppercase tracking-wide"
                  >
                    {cat.label}
                  </Link>
                  {cat.children.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setExpanded(isOpen ? null : cat.id)}
                      aria-label={`Toggle ${cat.label}`}
                      aria-expanded={isOpen}
                      className="grid size-11 place-items-center text-muted-foreground"
                    >
                      <ChevronDown
                        className={cn(
                          "size-5 transition-transform duration-200 ease-snappy",
                          isOpen && "rotate-180",
                        )}
                      />
                    </button>
                  )}
                </div>
                <div
                  className={cn(
                    "grid overflow-hidden transition-all duration-200 ease-snappy",
                    isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                  )}
                >
                  <ul className="min-h-0">
                    {cat.children.map((link) => (
                      <li key={link.id}>
                        <Link
                          href={link.url}
                          onClick={onClose}
                          className="block py-2 pl-8 pr-4 text-sm text-muted-foreground transition-colors hover:text-foreground"
                        >
                          {link.label}
                        </Link>
                        {/* Third level, e.g. Clothing > Tops > T-shirts */}
                        {link.children?.map((sub) => (
                          <Link
                            key={sub.id}
                            href={sub.url}
                            onClick={onClose}
                            className="block py-1.5 pl-12 pr-4 text-sm text-muted-foreground transition-colors hover:text-foreground"
                          >
                            {sub.label}
                          </Link>
                        ))}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </nav>

        <div className="flex flex-col gap-1 border-t border-border p-2">
          <Link
            href="/account"
            onClick={onClose}
            className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
          >
            <User className="size-5" /> My Account
          </Link>
          <Link
            href="/wishlist"
            onClick={onClose}
            className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
          >
            <Heart className="size-5" /> Wishlist
          </Link>
        </div>
      </div>
    </div>
  );
}
