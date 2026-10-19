import type { Metadata } from "next";
import { Archivo, Inter } from "next/font/google";
import "./globals.css";
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  // The shop's header/footer live in (shop)/layout.tsx; the admin has its own in admin/layout.tsx.
  return (
    <html lang="en" className={`${heading.variable} ${body.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
