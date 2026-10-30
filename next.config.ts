import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * Content Security Policy: the list of places the browser may load scripts,
 * images, frames etc. from. Anything else is blocked, which limits the damage
 * if someone ever manages to inject code into a page.
 *
 * Inline scripts are allowed ('unsafe-inline') because Next.js needs them on
 * pre-built pages — the stricter "nonce" version would make every page
 * rebuild on every visit (slow). Add a site here if you add a new service.
 */
const csp = [
  "default-src 'self'",
  [
    "script-src 'self' 'unsafe-inline'",
    isDev && "'unsafe-eval'", // only needed by the dev server
    "https://www.googletagmanager.com", // Google Analytics (after cookie consent)
    "https://upload-widget.cloudinary.com", // admin image uploads
  ],
  "style-src 'self' 'unsafe-inline'",
  [
    "img-src 'self' data: blob:",
    "https://res.cloudinary.com", // product photos and colour swatches
    "https://placehold.co", // sample images from the seed
    "https://lh3.googleusercontent.com", // Google profile pictures
    "https://*.google-analytics.com https://www.googletagmanager.com",
  ],
  "media-src 'self' blob: https://res.cloudinary.com",
  "font-src 'self' data:",
  [
    "connect-src 'self'",
    "https://api.cloudinary.com",
    "https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com",
  ],
  "frame-src https://upload-widget.cloudinary.com https://widget.cloudinary.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com",
  "frame-ancestors 'none'", // nobody can show the shop inside their own page (stops "clickjacking")
  !isDev && "upgrade-insecure-requests",
]
  .map((d) => (Array.isArray(d) ? d.filter(Boolean).join(" ") : d))
  .filter(Boolean)
  .join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Always use https for the next 2 years (browsers remember this).
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Don't let browsers guess file types (stops a picture being run as a script).
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Older browsers' version of frame-ancestors 'none'.
  { key: "X-Frame-Options", value: "DENY" },
  // Other sites only see "aussient.com.au", not the full page address (which can hold order or reset links).
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Switch off device features the shop never uses.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
];

const nextConfig: NextConfig = {
  // Don't advertise "X-Powered-By: Next.js".
  poweredByHeader: false,
  experimental: {
    // Room for the admin CSV product import (files up to 2 MB).
    serverActions: { bodySizeLimit: "3mb" },
  },
  images: {
    // Serve modern, smaller formats where the browser supports them.
    formats: ["image/avif", "image/webp"],
    qualities: [75],
    remotePatterns: [
      // Product, banner and section images uploaded through the admin.
      { protocol: "https", hostname: "res.cloudinary.com" },
      // Sample placeholders from the seed — safe to remove once real images are in.
      { protocol: "https", hostname: "placehold.co" },
    ],
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
