"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { NewsletterForm } from "@/components/newsletter-form";
import type { PopupData } from "@/lib/storefront";

const seenKey = (id: string) => `aussient-popup-${id}`;

/**
 * A newsletter or sale pop-up (Site Content → Pop-ups). Appears after its
 * delay, once per visitor (remembered in this browser). In Preview it always
 * shows, so staff can check it.
 */
export function SitePopup({ popup, preview }: { popup: PopupData; preview: boolean }) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    let seen = false;
    try {
      seen = !preview && localStorage.getItem(seenKey(popup.id)) !== null;
    } catch {
      // Storage blocked (private browsing): show it, it just won't be remembered.
    }
    if (seen) return;
    const timer = setTimeout(() => setOpen(true), popup.delaySeconds * 1000);
    return () => clearTimeout(timer);
  }, [popup.id, popup.delaySeconds, preview]);

  useEffect(() => {
    if (open) dialog.current?.showModal();
  }, [open]);

  function close() {
    dialog.current?.close();
    setOpen(false);
    try {
      localStorage.setItem(seenKey(popup.id), "1");
    } catch {}
  }

  if (!open) return null;
  return (
    <dialog
      ref={dialog}
      onClose={close}
      onClick={(e) => e.target === dialog.current && close()} // click outside the box
      aria-labelledby={popup.title ? "popup-title" : undefined}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] overflow-hidden rounded-xl bg-background p-0 text-foreground shadow-2xl backdrop:bg-black/50"
    >
      <div className="relative">
        {popup.image && (
          <div className="relative aspect-[16/9] bg-muted">
            <Image src={popup.image} alt="" fill sizes="28rem" className="object-cover" />
          </div>
        )}
        <button type="button" onClick={close} aria-label="Close" className="absolute top-2 right-2 grid size-9 place-items-center rounded-full bg-background/90 shadow hover:bg-background">
          <X className="size-4" />
        </button>
        <div className="grid gap-3 p-6 text-center">
          {popup.title && (
            <h2 id="popup-title" className="text-display text-2xl">
              {popup.title}
            </h2>
          )}
          {popup.body && <p className="text-sm text-muted-foreground">{popup.body}</p>}
          {popup.kind === "newsletter" ? (
            <div className="mx-auto w-full max-w-sm">
              <NewsletterForm tone="light" />
            </div>
          ) : (
            popup.buttonLabel &&
            popup.buttonLink && (
              <Link href={popup.buttonLink} onClick={close} className={buttonVariants({ size: "lg", className: "mx-auto h-11 bg-brand-accent px-6 font-heading font-bold uppercase text-brand-accent-foreground hover:bg-brand-accent/85" })}>
                {popup.buttonLabel}
              </Link>
            )
          )}
          <button type="button" onClick={close} className="text-xs text-muted-foreground underline">
            No thanks
          </button>
        </div>
      </div>
    </dialog>
  );
}
