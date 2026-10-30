import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

/**
 * /robots.txt — tells search engines what to skip: the admin, customer
 * accounts, the bag, checkout and behind-the-scenes addresses. (This only
 * keeps them out of Google; the pages themselves are protected by login.)
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/account",
        "/cart",
        "/checkout",
        "/api/",
        "/search",
        "/unsubscribe",
        "/verify-email",
        "/reset-password",
        "/accept-invite",
      ],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
