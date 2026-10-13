import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
};

export default nextConfig;
