import { z } from "zod";

/**
 * Home page section types and the settings each one stores in HomeSection.config.
 * The admin editor (Prompt 10) should build its forms from these schemas.
 * A section whose config doesn't match its schema is skipped, not crashed on.
 */

const link = z.object({ label: z.string().min(1), href: z.string().min(1) });
const image = z.string().min(1); // Cloudinary (or other allowed) image URL

export const productSources = ["new", "bestsellers", "sale", "featured", "under"] as const;
export type ProductSource = (typeof productSources)[number];

export const sectionSchemas = {
  hero: z.object({
    headline: z.string().min(1),
    subheading: z.string().optional(),
    eyebrow: z.string().optional(), // small tag above the headline, e.g. "New Season"
    image: image.optional(),
    video: z.string().optional(), // short muted looping MP4; `image` is its poster
    button: link,
    secondaryButton: link.optional(),
  }),
  "product-row": z.object({
    source: z.enum(productSources),
    maxPrice: z.number().positive().optional(), // for source "under", e.g. 20
    limit: z.number().int().min(1).max(24).default(12),
    viewAll: link.optional(),
  }),
  "category-tiles": z.object({
    tiles: z.array(z.object({ label: z.string().min(1), image, href: z.string().min(1) })).min(1),
  }),
  "promo-banner": z.object({
    image,
    heading: z.string().min(1),
    text: z.string().optional(),
    button: link.optional(),
  }),
  "image-text": z.object({
    image,
    heading: z.string().min(1),
    body: z.string().min(1),
    button: link.optional(),
    imageSide: z.enum(["left", "right"]).default("left"),
  }),
  countdown: z.object({
    heading: z.string().min(1),
    text: z.string().optional(),
    endsAt: z.iso.datetime({ offset: true }).optional(), // defaults to the section's end date
    button: link.optional(),
  }),
  reviews: z.object({ limit: z.number().int().min(1).max(12).default(6) }),
  instagram: z.object({
    handle: z.string().min(1), // e.g. "@aussient"
    url: z.string().url(),
    images: z.array(z.object({ src: image, alt: z.string().default("") })).min(1),
  }),
  "gift-guide": z.object({
    cards: z
      .array(
        z.object({
          title: z.string().min(1),
          subtitle: z.string().optional(),
          image,
          href: z.string().min(1),
        }),
      )
      .min(1),
  }),
  newsletter: z.object({ heading: z.string().min(1), text: z.string().optional() }),
} as const;

export type SectionType = keyof typeof sectionSchemas;

export type HomeSectionData = {
  [T in SectionType]: {
    id: string;
    type: T;
    title: string | null;
    endsAt: string | null;
    config: z.infer<(typeof sectionSchemas)[T]>;
  };
}[SectionType];

/** Validates a raw HomeSection row; returns null (and logs) if it can't be shown. */
export function parseSection(row: {
  id: string;
  type: string;
  title: string | null;
  endsAt: string | null;
  config: unknown;
}): HomeSectionData | null {
  const schema = sectionSchemas[row.type as SectionType];
  if (!schema) {
    console.warn(`Home section ${row.id}: unknown type "${row.type}" — skipped.`);
    return null;
  }
  const parsed = schema.safeParse(row.config ?? {});
  if (!parsed.success) {
    console.warn(
      `Home section ${row.id} (${row.type}): invalid config — skipped.`,
      parsed.error.issues,
    );
    return null;
  }
  return { ...row, type: row.type, config: parsed.data } as HomeSectionData;
}
