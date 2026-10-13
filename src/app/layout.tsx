import type { Metadata } from "next";
import { Archivo, Inter } from "next/font/google";
import "./globals.css";
import { AnnouncementBar } from "@/components/announcement-bar";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { BagPanel } from "@/components/bag/bag-panel";
import { getLiveSiteChrome } from "@/lib/storefront";
import { SITE_NAME, siteUrl } from "@/lib/seo";

// Bold display face for headings…
const heading = Archivo({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
});

// …and a clean, highly legible face for everything else.
const body = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

const description =
  "Bold, on-trend fashion jewellery. New drops weekly. Shop earrings, necklaces, rings and more.";

export const metadata: Metadata = {
  // Lets pages use relative URLs for canonical links and share images.
  metadataBase: siteUrl,
  title: {
    default: "Aussient — Fashion Jewellery",
    template: "%s · Aussient",
  },
  description,
  openGraph: {
    title: "Aussient — Fashion Jewellery",
    description,
    siteName: SITE_NAME,
    locale: "en_AU",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Announcement bar, menus and footer come from the database (cached; see src/lib/storefront.ts).
  const chrome = await getLiveSiteChrome();

  return (
    <html lang="en" className={`${heading.variable} ${body.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        <AnnouncementBar items={chrome.announcements} />
        <SiteHeader menu={chrome.headerMenu} />
        <main className="flex-1">{children}</main>
        <SiteFooter settings={chrome.settings} menu={chrome.footerMenu} />
        <BagPanel />
      </body>
    </html>
  );
}
