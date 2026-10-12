/**
 * Placeholder content for the storefront.
 *
 * This is temporary — in a later prompt these shapes get replaced by data
 * loaded from the database. Keep the exported *types* stable so the UI
 * components don't need to change when the source does; only swap the
 * hard-coded arrays below for real queries.
 *
 * Images aren't wired up yet, so each item carries a pair of CSS gradients
 * that stand in for the primary and hover ("second photo") images.
 */

export type Swatch = {
  name: string;
  /** CSS colour used to render the little round swatch. */
  color: string;
};

export type Product = {
  id: string;
  name: string;
  /** Collection / category label shown under the name. */
  collection: string;
  price: number;
  /** Original price, when the item is marked down. */
  compareAtPrice?: number;
  badge?: "new" | "sale" | "low";
  /** Stand-in images: [front, back]. Any valid CSS `background` value. */
  images: [string, string];
  swatches: Swatch[];
};

export type NavCategory = {
  name: string;
  href: string;
  /** Stand-in category image (any valid CSS `background` value). */
  image: string;
  links: { name: string; href: string }[];
};

export const announcements: string[] = [
  "FREE SHIPPING ON ORDERS OVER $50",
  "NEW DROPS EVERY WEEK",
  "BUY 3, GET 1 FREE ON EARRINGS",
  "AFTERPAY & ZIP AVAILABLE",
  "30-DAY EASY RETURNS",
];

export const navCategories: NavCategory[] = [
  {
    name: "Earrings",
    href: "/earrings",
    image: "linear-gradient(135deg, oklch(0.64 0.246 2), oklch(0.82 0.085 85))",
    links: [
      { name: "Studs", href: "/earrings/studs" },
      { name: "Hoops", href: "/earrings/hoops" },
      { name: "Drops & Danglers", href: "/earrings/drops" },
      { name: "Huggies", href: "/earrings/huggies" },
      { name: "Ear Stacks", href: "/earrings/stacks" },
    ],
  },
  {
    name: "Necklaces",
    href: "/necklaces",
    image: "linear-gradient(135deg, oklch(0.2 0.02 280), oklch(0.64 0.246 2))",
    links: [
      { name: "Pendants", href: "/necklaces/pendants" },
      { name: "Chains", href: "/necklaces/chains" },
      { name: "Chokers", href: "/necklaces/chokers" },
      { name: "Layered Sets", href: "/necklaces/layered" },
    ],
  },
  {
    name: "Rings",
    href: "/rings",
    image: "linear-gradient(135deg, oklch(0.82 0.085 85), oklch(0.98 0.006 85))",
    links: [
      { name: "Statement", href: "/rings/statement" },
      { name: "Stackable", href: "/rings/stackable" },
      { name: "Signet", href: "/rings/signet" },
      { name: "Adjustable", href: "/rings/adjustable" },
    ],
  },
  {
    name: "Bracelets",
    href: "/bracelets",
    image: "linear-gradient(135deg, oklch(0.64 0.246 2), oklch(0.2 0.02 280))",
    links: [
      { name: "Cuffs", href: "/bracelets/cuffs" },
      { name: "Chain Bracelets", href: "/bracelets/chain" },
      { name: "Anklets", href: "/bracelets/anklets" },
      { name: "Charm", href: "/bracelets/charm" },
    ],
  },
  {
    name: "Sale",
    href: "/sale",
    image: "linear-gradient(135deg, oklch(0.64 0.246 2), oklch(0.72 0.2 20))",
    links: [
      { name: "Up to 50% Off", href: "/sale/50-off" },
      { name: "Last Chance", href: "/sale/last-chance" },
      { name: "Clearance", href: "/sale/clearance" },
    ],
  },
];

const GOLD = "oklch(0.82 0.085 85)";
const SILVER = "oklch(0.85 0.005 280)";
const ROSE = "oklch(0.78 0.08 30)";
const BLACK = "oklch(0.2 0.02 280)";
const PINK = "oklch(0.64 0.246 2)";

export const products: Product[] = [
  {
    id: "p1",
    name: "Nova Crystal Hoops",
    collection: "Earrings",
    price: 24.95,
    badge: "new",
    images: [
      `linear-gradient(135deg, ${GOLD}, oklch(0.95 0.02 85))`,
      `linear-gradient(315deg, ${GOLD}, ${PINK})`,
    ],
    swatches: [
      { name: "Gold", color: GOLD },
      { name: "Silver", color: SILVER },
      { name: "Rose Gold", color: ROSE },
    ],
  },
  {
    id: "p2",
    name: "Bold Link Chain Necklace",
    collection: "Necklaces",
    price: 19.95,
    compareAtPrice: 34.95,
    badge: "sale",
    images: [
      `linear-gradient(135deg, ${BLACK}, oklch(0.4 0.02 280))`,
      `linear-gradient(315deg, ${BLACK}, ${PINK})`,
    ],
    swatches: [
      { name: "Gold", color: GOLD },
      { name: "Silver", color: SILVER },
    ],
  },
  {
    id: "p3",
    name: "Stacked Signet Ring Set",
    collection: "Rings",
    price: 29.95,
    badge: "low",
    images: [
      `linear-gradient(135deg, ${SILVER}, oklch(0.95 0.005 280))`,
      `linear-gradient(315deg, ${SILVER}, ${GOLD})`,
    ],
    swatches: [
      { name: "Silver", color: SILVER },
      { name: "Gold", color: GOLD },
      { name: "Black", color: BLACK },
    ],
  },
  {
    id: "p4",
    name: "Pavé Tennis Bracelet",
    collection: "Bracelets",
    price: 39.95,
    images: [
      `linear-gradient(135deg, ${PINK}, oklch(0.8 0.12 350))`,
      `linear-gradient(315deg, ${PINK}, ${GOLD})`,
    ],
    swatches: [
      { name: "Gold", color: GOLD },
      { name: "Rose Gold", color: ROSE },
    ],
  },
  {
    id: "p5",
    name: "Molten Dome Studs",
    collection: "Earrings",
    price: 16.95,
    badge: "new",
    images: [
      `linear-gradient(135deg, ${ROSE}, oklch(0.9 0.05 30))`,
      `linear-gradient(315deg, ${ROSE}, ${BLACK})`,
    ],
    swatches: [
      { name: "Rose Gold", color: ROSE },
      { name: "Gold", color: GOLD },
      { name: "Silver", color: SILVER },
    ],
  },
  {
    id: "p6",
    name: "Pearl Drop Danglers",
    collection: "Earrings",
    price: 22.95,
    compareAtPrice: 29.95,
    badge: "sale",
    images: [
      `linear-gradient(135deg, oklch(0.95 0.01 85), ${GOLD})`,
      `linear-gradient(315deg, oklch(0.95 0.01 85), ${PINK})`,
    ],
    swatches: [
      { name: "Gold", color: GOLD },
      { name: "Silver", color: SILVER },
    ],
  },
  {
    id: "p7",
    name: "Snake Chain Choker",
    collection: "Necklaces",
    price: 27.95,
    images: [
      `linear-gradient(135deg, ${GOLD}, ${BLACK})`,
      `linear-gradient(315deg, ${GOLD}, ${PINK})`,
    ],
    swatches: [
      { name: "Gold", color: GOLD },
      { name: "Silver", color: SILVER },
    ],
  },
  {
    id: "p8",
    name: "Crystal Charm Anklet",
    collection: "Bracelets",
    price: 18.95,
    badge: "low",
    images: [
      `linear-gradient(135deg, ${SILVER}, ${PINK})`,
      `linear-gradient(315deg, ${SILVER}, ${GOLD})`,
    ],
    swatches: [
      { name: "Silver", color: SILVER },
      { name: "Gold", color: GOLD },
      { name: "Rose Gold", color: ROSE },
    ],
  },
];

export const footerLinks = {
  help: [
    { name: "Contact Us", href: "/help/contact" },
    { name: "Shipping", href: "/help/shipping" },
    { name: "Returns & Exchanges", href: "/help/returns" },
    { name: "Order Tracking", href: "/help/tracking" },
    { name: "Size Guide", href: "/help/size-guide" },
    { name: "FAQs", href: "/help/faqs" },
  ],
  policies: [
    { name: "Terms of Service", href: "/policies/terms" },
    { name: "Privacy Policy", href: "/policies/privacy" },
    { name: "Refund Policy", href: "/policies/refunds" },
    { name: "Accessibility", href: "/policies/accessibility" },
  ],
};
