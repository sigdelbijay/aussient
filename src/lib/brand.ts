/**
 * The Aussient logo files in /public/brand, cut from the original square artwork
 * (aussient-logo-original.jpg, 1600×1600) with its flat dark-teal background made
 * transparent. The artwork's own pixels are kept, so the mark and the AUSSIENT
 * wordmark keep their original colours and gradients (never recolour them).
 * The header uses the horizontal one unless a logo is uploaded in Settings.
 */
export const BRAND_LOGO = { src: "/brand/aussient-logo-horizontal.png", width: 1343, height: 281 } as const;
export const BRAND_LOGO_STACKED = { src: "/brand/aussient-logo-stacked.png", width: 991, height: 621 } as const;
/** Dark teal background of the logo artwork (sampled), for backgrounds behind the logo. */
export const BRAND_TEAL = "#245a68";
