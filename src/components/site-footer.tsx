import Link from "next/link";
import { AtSign, Camera, Hash, Headphones, Play, RefreshCw, Truck } from "lucide-react";
import { NewsletterForm } from "@/components/newsletter-form";
import { footerLinks } from "@/lib/placeholder-data";

const socials = [
  { label: "Instagram", icon: Camera, href: "https://instagram.com" },
  { label: "TikTok", icon: Hash, href: "https://tiktok.com" },
  { label: "YouTube", icon: Play, href: "https://youtube.com" },
  { label: "Threads", icon: AtSign, href: "https://threads.net" },
];

const payments = ["VISA", "Mastercard", "AMEX", "PayPal", "Afterpay", "Zip"];

const perks = [
  { icon: Truck, text: "Free shipping over $50" },
  { icon: RefreshCw, text: "30-day easy returns" },
  { icon: Headphones, text: "Friendly support" },
];

export function SiteFooter() {
  return (
    <footer className="bg-brand-ink text-brand-paper">
      {/* Perks strip */}
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

      {/* Main footer */}
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-10 px-4 py-12 md:grid-cols-4">
        {/* Newsletter */}
        <div className="col-span-2 flex flex-col gap-4 md:col-span-2">
          <h2 className="text-display text-2xl">Join the list</h2>
          <p className="max-w-sm text-sm text-brand-paper/70">
            Get 10% off your first order, early access to drops, and sale alerts before anyone else.
          </p>
          <NewsletterForm />
          <div className="mt-2 flex gap-2">
            {socials.map(({ label, icon: Icon, href }) => (
              <a
                key={label}
                href={href}
                aria-label={label}
                target="_blank"
                rel="noopener noreferrer"
                className="grid size-9 place-items-center rounded-full border border-brand-paper/20 transition-all duration-200 ease-snappy hover:scale-110 hover:border-brand-accent hover:text-brand-accent"
              >
                <Icon className="size-4" />
              </a>
            ))}
          </div>
        </div>

        {/* Help links */}
        <nav aria-label="Help" className="flex flex-col gap-3">
          <h3 className="font-heading text-xs font-bold uppercase tracking-widest text-brand-paper/50">
            Help
          </h3>
          <ul className="flex flex-col gap-2 text-sm">
            {footerLinks.help.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-brand-paper/80 transition-colors duration-200 hover:text-brand-accent"
                >
                  {link.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Policy links */}
        <nav aria-label="Policies" className="flex flex-col gap-3">
          <h3 className="font-heading text-xs font-bold uppercase tracking-widest text-brand-paper/50">
            Legal
          </h3>
          <ul className="flex flex-col gap-2 text-sm">
            {footerLinks.policies.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-brand-paper/80 transition-colors duration-200 hover:text-brand-accent"
                >
                  {link.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-brand-paper/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-6 sm:flex-row">
          <p className="text-xs text-brand-paper/50">
            © {new Date().getFullYear()} Aussient. All rights reserved.
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
