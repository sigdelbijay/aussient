import Link from "next/link";
import { Camera, Hash, Headphones, Mail, Phone, Pin, Play, RefreshCw, Sparkles, Truck } from "lucide-react";
import { CookieSettingsButton } from "@/components/cookie-consent";
import { NewsletterForm } from "@/components/newsletter-form";
import { FacebookIcon, LinkedinIcon } from "@/components/social-icons";
import type { SiteChrome } from "@/lib/storefront";

// lucide has no brand logos: Facebook and LinkedIn are drawn in social-icons.tsx,
// the others use a simple stand-in icon. Same order as SOCIALS in src/lib/socials.ts.
const socialIcons = [
  { key: "facebook", label: "Facebook", icon: FacebookIcon },
  { key: "instagram", label: "Instagram", icon: Camera },
  { key: "youtube", label: "YouTube", icon: Play },
  { key: "linkedin", label: "LinkedIn", icon: LinkedinIcon },
  { key: "tiktok", label: "TikTok", icon: Hash },
  { key: "pinterest", label: "Pinterest", icon: Pin },
] as const;

const payments = ["VISA", "Mastercard", "AMEX", "PayPal", "Afterpay", "Zip"];

// Icons for the perks strip, used in order.
const perkIcons = [Truck, RefreshCw, Headphones, Sparkles];

/** Footer: perks, newsletter and socials from SiteSettings; link columns from footer MenuItems. */
export function SiteFooter({
  settings,
  menu,
}: {
  settings: SiteChrome["settings"];
  menu: SiteChrome["footerMenu"];
}) {
  const perks = settings.footerPerks.map((text, i) => ({
    text,
    icon: perkIcons[i % perkIcons.length],
  }));
  const socials = socialIcons.flatMap((s) =>
    settings.socials[s.key] ? [{ ...s, href: settings.socials[s.key]! }] : [],
  );

  return (
    <footer className="bg-brand-ink text-brand-paper">
      {/* Perks strip */}
      {perks.length > 0 && (
        <div className="border-b border-brand-paper/10">
          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-4 py-6 sm:grid-cols-3">
            {perks.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center justify-center gap-2.5 text-sm">
                <Icon className="size-5 text-brand-accent" />
                <span className="font-medium">{text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main footer */}
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-10 px-4 py-12 md:grid-cols-4">
        {/* Newsletter */}
        <div className="col-span-2 flex flex-col gap-4 md:col-span-2">
          <h2 className="text-display text-2xl">{settings.newsletterHeading}</h2>
          {settings.newsletterText && (
            <p className="max-w-sm text-sm text-brand-paper/70">{settings.newsletterText}</p>
          )}
          <NewsletterForm />
          {(settings.supportEmail || settings.contactPhone) && (
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-brand-paper/80">
              {settings.supportEmail && (
                <li>
                  <a href={`mailto:${settings.supportEmail}`} className="flex items-center gap-2 hover:text-brand-accent">
                    <Mail className="size-4" /> {settings.supportEmail}
                  </a>
                </li>
              )}
              {settings.contactPhone && (
                <li>
                  <a href={`tel:${settings.contactPhone.replace(/[^\d+]/g, "")}`} className="flex items-center gap-2 hover:text-brand-accent">
                    <Phone className="size-4" /> {settings.contactPhone}
                  </a>
                </li>
              )}
            </ul>
          )}
          <div className="mt-2 flex gap-2">
            {socials.map(({ label, icon: Icon, href }) => (
              <a
                key={label}
                href={href}
                aria-label={`${settings.storeName} on ${label} (opens in a new tab)`}
                target="_blank"
                rel="noopener noreferrer"
                className="grid size-9 place-items-center rounded-full border border-brand-paper/20 transition-all duration-200 ease-snappy hover:scale-110 hover:border-brand-accent hover:text-brand-accent"
              >
                <Icon className="size-4" />
              </a>
            ))}
          </div>
        </div>

        {/* Link columns (footer menu: each top-level item is a column heading) */}
        {menu.map((group) => (
          <nav key={group.id} aria-label={group.label} className="flex flex-col gap-3">
            <h3 className="font-heading text-xs font-bold uppercase tracking-widest text-brand-paper/50">
              {group.label}
            </h3>
            <ul className="flex flex-col gap-2 text-sm">
              {group.children.map((link) => (
                <li key={link.id}>
                  <Link
                    href={link.url}
                    className="text-brand-paper/80 transition-colors duration-200 hover:text-brand-accent"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      {/* Bottom bar */}
      <div className="border-t border-brand-paper/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-6 sm:flex-row">
          <p className="text-xs text-brand-paper/50">
            © {new Date().getFullYear()} {settings.storeName}. All rights reserved.
            {settings.abn && <> · ABN {settings.abn}</>}
            {settings.googleAnalyticsId && (
              <>
                {" · "}
                <CookieSettingsButton />
              </>
            )}
          </p>
          <ul className="flex flex-wrap items-center gap-2">
            {payments.map((p) => (
              <li
                key={p}
                className="rounded-md bg-brand-paper/10 px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-brand-paper/70"
              >
                {p}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
