import type { Metadata } from "next";
import { Archivo, Inter } from "next/font/google";
import "./globals.css";
import { siteUrl } from "@/lib/seo";
import { getSiteChrome } from "@/lib/storefront";

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

/** Site-wide title and description, from Site settings (store name, tagline, meta description). */
export async function generateMetadata(): Promise<Metadata> {
  const { storeName, tagline, metaDescription } = (await getSiteChrome()).settings;
  const title = tagline ? `${storeName} — ${tagline}` : storeName;
  const description = metaDescription ?? tagline ?? undefined;
  return {
    // Lets pages use relative URLs for canonical links and share images.
    metadataBase: siteUrl,
    title: { default: title, template: `%s · ${storeName}` },
    description,
    openGraph: { title, description, siteName: storeName, locale: "en_AU", type: "website" },
    twitter: { card: "summary_large_image" },
  };
}

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
