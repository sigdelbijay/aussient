"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Heart, User, X } from "lucide-react";
import { cn } from "cn";
import { navCategories } from "@/lib/placeholder-data";

export function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div
      className={cn(
        "fixed inset-0 z-[70] lg:hidden",
        open ? "pointer-events-auto" : "pointer-events-none",
      )}
      aria-hidden={!open}
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
          "absolute inset-y-0 left-0 flex w-[85%] max-w-sm flex-col bg-background shadow-xl transition-transform duration-200 ease-snappy",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-4">
          <span className="font-heading text-lg font-extrabold tracking-tight">AUSSIENT</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="grid size-9 place-items-center rounded-full transition-colors hover:bg-muted"
          >
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          {navCategories.map((cat) => {
            const isOpen = expanded === cat.name;
            return (
              <div key={cat.name} className="border-b border-border/60">
                <div className="flex items-center">
                  <Link
                    href={cat.href}
                    onClick={onClose}
                    className="flex-1 px-4 py-3 font-heading text-base font-bold uppercase tracking-wide"
                  >
                    {cat.name}
                  </Link>
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : cat.name)}
                    aria-label={`Toggle ${cat.name}`}
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
                </div>
                <div
                  className={cn(
                    "grid overflow-hidden transition-all duration-200 ease-snappy",
                    isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                  )}
                >
                  <ul className="min-h-0">
                    {cat.links.map((link) => (
                      <li key={link.href}>
                        <Link
                          href={link.href}
                          onClick={onClose}
                          className="block py-2 pl-8 pr-4 text-sm text-muted-foreground transition-colors hover:text-foreground"
                        >
                          {link.name}
                        </Link>
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
