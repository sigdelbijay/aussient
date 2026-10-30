"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Script from "next/script";
import { Button } from "@/components/ui/button";

/**
 * Cookie banner + Google Analytics. Analytics (which sets cookies) only loads
 * after the shopper presses "Accept"; "Decline" means it never loads. The
 * choice is remembered in this browser, and "Cookie settings" in the footer
 * shows the banner again so they can change their mind.
 *
 * With no Measurement ID in Settings there's nothing to ask about, so no banner.
 */
const KEY = "aussient-cookie-consent";
const REOPEN = "aussient:cookie-settings";
type Choice = "accepted" | "declined";

function savedChoice(): Choice | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "accepted" || v === "declined" ? v : null;
  } catch {
    return null;
  }
}

export function CookieConsent({ gaId }: { gaId: string | null }) {
  // undefined = not read yet (nothing shows until the page has loaded, so no layout shift)
  const [choice, setChoice] = useState<Choice | null | undefined>(undefined);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading the saved choice once, after loading
    setChoice(savedChoice());
    const reopen = () => setChoice(null);
    window.addEventListener(REOPEN, reopen);
    return () => window.removeEventListener(REOPEN, reopen);
  }, []);

  function decide(c: Choice) {
    try {
      localStorage.setItem(KEY, c);
    } catch {
      // private browsing: remember for this visit only
    }
    // Turning analytics off after it loaded needs a fresh page to unload it.
    if (c === "declined" && choice === "accepted") window.location.reload();
    setChoice(c);
  }

  if (!gaId) return null;

  return (
    <>
      {choice === "accepted" && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`}
            strategy="lazyOnload"
          />
          <Script id="ga-setup" strategy="lazyOnload">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config',${JSON.stringify(gaId)});`}
          </Script>
        </>
      )}
      {choice === null && (
        <div
          role="region"
          aria-label="Cookie choice"
          className="fixed inset-x-3 bottom-3 z-[80] mx-auto grid max-w-xl gap-3 rounded-xl border border-border bg-background p-4 text-sm shadow-2xl sm:grid-cols-[1fr_auto] sm:items-center"
          style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          <p className="text-muted-foreground">
            We use cookies to keep you signed in and your bag saved. With your OK, we&apos;d also
            use Google Analytics cookies to see how the shop is used. See our{" "}
            <Link href="/pages/privacy" className="font-medium text-foreground underline">
              Privacy Policy
            </Link>
            .
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => decide("declined")}
              className="h-10 flex-1 px-4"
            >
              Decline
            </Button>
            <Button onClick={() => decide("accepted")} className="h-10 flex-1 px-4">
              Accept
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

/** "Cookie settings" link for the footer: shows the banner again. */
export function CookieSettingsButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(REOPEN))}
      className="hover:text-brand-accent"
    >
      Cookie settings
    </button>
  );
}
