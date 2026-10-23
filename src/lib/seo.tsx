import type { Metadata } from "next";

/**
 * Helpers for page titles, share previews and Google structured data.
 * The site's public address comes from NEXT_PUBLIC_SITE_URL (see .env.example).
 */

export const SITE_NAME = "Aussient";

export const siteUrl = new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000");

/** Full URL for a path, e.g. absoluteUrl("/products/x") → https://aussient.com.au/products/x */
export const absoluteUrl = (path: string) => new URL(path, siteUrl).toString();

/**
 * Title, description, canonical link and matching Open Graph / X (Twitter)
 * tags for a page. Without an `image`, the site-wide share image is used.
 */
export function pageMetadata({
  title,
  description,
  path,
  image,
  noindex,
}: {
  title: string;
  description: string;
  path: string;
  image?: { url: string; alt?: string } | null;
  /** Keep this variation out of Google (e.g. filtered or search results). */
  noindex?: boolean;
}): Metadata {
  // A page's own openGraph replaces the layout's, so point at the site-wide
  // image (src/app/opengraph-image.tsx) explicitly when there's no photo.
  const images = [
    image
      ? { url: image.url, alt: image.alt ?? title }
      : { url: "/opengraph-image", width: 1200, height: 630, alt: SITE_NAME },
  ];
  return {
    title,
    description,
    alternates: { canonical: path },
    robots: noindex ? { index: false, follow: true } : undefined,
    openGraph: {
      title: `${title} · ${SITE_NAME}`,
      description,
      url: path,
      siteName: SITE_NAME,
      locale: "en_AU",
      type: "website",
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} · ${SITE_NAME}`,
      description,
      images,
    },
  };
}

/** Trims text to a search-snippet-friendly length on a word boundary. */
export function snippet(text: string, max = 155) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
}

/** Renders schema.org JSON-LD. `<` is escaped so product text can't break out of the tag. */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
