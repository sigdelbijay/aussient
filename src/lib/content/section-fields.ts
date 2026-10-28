import type { SectionType } from "@/lib/home-sections";

/**
 * What the admin home page editor shows for each kind of section. The boxes
 * match the settings in src/lib/home-sections.ts (which checks them on publish).
 */

export type SectionField =
  | { key: string; label: string; kind: "text" | "textarea" | "image" | "video" | "link" | "collection" | "datetime" | "href"; required?: boolean; hint?: string }
  | { key: string; label: string; kind: "number"; min: number; max: number; hint?: string }
  | { key: string; label: string; kind: "select"; options: { value: string; label: string }[] }
  | { key: string; label: string; kind: "list"; itemLabel: string; fields: SectionField[]; max: number };

export const SECTION_LABELS: Record<SectionType, string> = {
  hero: "Hero (big picture or video)",
  "product-row": "Product row",
  "category-tiles": "Category tiles",
  "promo-banner": "Promo banner",
  "image-text": "Picture with text",
  countdown: "Countdown",
  reviews: "Reviews",
  instagram: "Instagram grid",
  "gift-guide": "Gift guide cards",
  newsletter: "Newsletter signup",
};

/** Sections that show their title as a heading above them. */
export const SHOWS_TITLE = new Set<SectionType>(["product-row", "category-tiles", "reviews", "instagram", "gift-guide"]);

export const SECTION_FIELDS: Record<SectionType, SectionField[]> = {
  hero: [
    { key: "eyebrow", label: "Small tag above the headline", kind: "text", hint: "e.g. New season" },
    { key: "headline", label: "Headline", kind: "text", required: true },
    { key: "subheading", label: "Text under the headline", kind: "textarea" },
    { key: "image", label: "Picture", kind: "image", hint: "Wide, at least 1600px across" },
    { key: "video", label: "Video (optional)", kind: "video", hint: "A short MP4 that plays silently on a loop; the picture shows while it loads" },
    { key: "button", label: "Button", kind: "link", required: true },
    { key: "secondaryButton", label: "Second button", kind: "link" },
  ],
  "product-row": [
    { key: "collection", label: "Products from", kind: "collection", required: true, hint: "Any collection, e.g. New In or Watches under $200" },
    { key: "limit", label: "How many products", kind: "number", min: 1, max: 24 },
    { key: "viewAll", label: "“Shop all” link", kind: "link", hint: "Blank = the collection’s page" },
  ],
  "category-tiles": [{ key: "limit", label: "How many categories (blank = all)", kind: "number", min: 1, max: 12 }],
  "promo-banner": [
    { key: "image", label: "Picture", kind: "image", required: true },
    { key: "heading", label: "Heading", kind: "text", required: true },
    { key: "text", label: "Text", kind: "textarea" },
    { key: "button", label: "Button", kind: "link" },
  ],
  "image-text": [
    { key: "image", label: "Picture", kind: "image", required: true },
    { key: "heading", label: "Heading", kind: "text", required: true },
    { key: "body", label: "Text", kind: "textarea", required: true },
    { key: "button", label: "Button", kind: "link" },
    {
      key: "imageSide",
      label: "Picture on the",
      kind: "select",
      options: [
        { value: "left", label: "Left" },
        { value: "right", label: "Right" },
      ],
    },
  ],
  countdown: [
    { key: "heading", label: "Heading", kind: "text", required: true },
    { key: "text", label: "Text", kind: "textarea" },
    { key: "endsAt", label: "Count down to", kind: "datetime", hint: "Blank = the section’s end date" },
    { key: "button", label: "Button", kind: "link" },
  ],
  reviews: [{ key: "limit", label: "How many reviews", kind: "number", min: 1, max: 12 }],
  instagram: [
    { key: "handle", label: "Handle", kind: "text", required: true, hint: "e.g. @aussient" },
    { key: "url", label: "Profile link", kind: "href", required: true },
    { key: "images", label: "Pictures", kind: "list", itemLabel: "Picture", max: 12, fields: [
      { key: "src", label: "Picture", kind: "image", required: true },
      { key: "alt", label: "Describe the picture", kind: "text", hint: "For screen readers" },
    ] },
  ],
  "gift-guide": [
    { key: "cards", label: "Cards", kind: "list", itemLabel: "Card", max: 8, fields: [
      { key: "title", label: "Title", kind: "text", required: true },
      { key: "subtitle", label: "Subtitle", kind: "text" },
      { key: "image", label: "Picture", kind: "image", required: true },
      { key: "href", label: "Link", kind: "href", required: true },
    ] },
  ],
  newsletter: [
    { key: "heading", label: "Heading", kind: "text", required: true },
    { key: "text", label: "Text", kind: "textarea" },
  ],
};

/** Starting settings for a new section of this type. */
export function blankConfig(type: SectionType): Record<string, unknown> {
  switch (type) {
    case "product-row":
      return { limit: 12 };
    case "reviews":
      return { limit: 6 };
    case "image-text":
      return { imageSide: "left" };
    case "instagram":
      return { images: [{ src: "", alt: "" }] };
    case "gift-guide":
      return { cards: [{ title: "", image: "", href: "" }] };
    default:
      return {};
  }
}
