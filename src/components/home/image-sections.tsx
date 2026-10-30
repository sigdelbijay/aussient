import Image from "next/image";
import Link from "next/link";
import { cn } from "cn";
import { buttonVariants } from "@/components/ui/button";
import { getTopCategories } from "@/lib/catalog";
import type { HomeSectionData } from "@/lib/home-sections";
import { SectionHeading, SectionShell } from "./section-heading";

type ConfigOf<T extends HomeSectionData["type"]> = Extract<HomeSectionData, { type: T }>["config"];

const accentButton = cn(
  buttonVariants({ size: "lg" }),
  "h-11 bg-brand-accent px-6 font-heading font-bold uppercase text-brand-accent-foreground hover:bg-brand-accent/85",
);

/** "Shop by category": a tile for each top-level category, with its picture. */
export async function CategoryTiles({
  title,
  config,
}: {
  title: string | null;
  config: ConfigOf<"category-tiles">;
}) {
  const categories = (await getTopCategories()).slice(0, config.limit ?? 12);
  if (categories.length === 0) return null;
  return (
    <SectionShell>
      <SectionHeading title={title} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-[repeat(auto-fit,minmax(0,1fr))]">
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/collections/${c.slug}`}
            className="group/tile relative flex aspect-[4/5] items-end overflow-hidden rounded-lg bg-muted p-4"
          >
            {c.image && (
              <Image
                src={c.image}
                alt=""
                fill
                sizes="(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw"
                className="object-cover transition-transform duration-300 ease-snappy group-hover/tile:scale-105"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <span className="relative font-heading text-lg font-extrabold uppercase tracking-wide text-white transition-transform duration-200 ease-snappy group-hover/tile:translate-x-1">
              {c.name}
            </span>
          </Link>
        ))}
      </div>
    </SectionShell>
  );
}

/** Wide image banner with a headline and button — e.g. "Black Friday: 40% off". */
export function PromoBanner({ config }: { config: ConfigOf<"promo-banner"> }) {
  return (
    <SectionShell>
      <div className="relative isolate overflow-hidden rounded-xl bg-brand-ink px-6 py-14 text-center text-brand-paper sm:px-12 sm:py-20">
        <Image
          src={config.image}
          alt=""
          fill
          sizes="(min-width: 1280px) 1248px, 100vw"
          className="-z-10 object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-black/45" aria-hidden />
        <h2 className="text-display mx-auto max-w-2xl text-4xl sm:text-6xl">{config.heading}</h2>
        {config.text && <p className="mx-auto mt-3 max-w-lg text-brand-paper/85">{config.text}</p>}
        {config.button && (
          <Link href={config.button.href} className={cn(accentButton, "mt-6")}>
            {config.button.label}
          </Link>
        )}
      </div>
    </SectionShell>
  );
}

/** Picture on one side, story on the other. */
export function ImageWithText({ config }: { config: ConfigOf<"image-text"> }) {
  return (
    <SectionShell>
      <div className="grid items-center gap-8 md:grid-cols-2 md:gap-14">
        <div
          className={cn(
            "relative aspect-[4/5] overflow-hidden rounded-xl bg-muted sm:aspect-[4/3] md:aspect-[4/5]",
            config.imageSide === "right" && "md:order-last",
          )}
        >
          <Image
            src={config.image}
            alt=""
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover"
          />
        </div>
        <div className="flex flex-col items-start gap-4">
          <h2 className="text-display text-3xl sm:text-5xl">{config.heading}</h2>
          <p className="whitespace-pre-line text-base leading-relaxed text-muted-foreground">
            {config.body}
          </p>
          {config.button && (
            <Link
              href={config.button.href}
              className={cn(
                buttonVariants({ size: "lg" }),
                "h-11 px-6 font-heading font-bold uppercase",
              )}
            >
              {config.button.label}
            </Link>
          )}
        </div>
      </div>
    </SectionShell>
  );
}

/** Instagram-style photo grid linking to the profile. */
export function InstagramGrid({
  title,
  config,
}: {
  title: string | null;
  config: ConfigOf<"instagram">;
}) {
  return (
    <SectionShell>
      <SectionHeading title={title} link={{ label: `Follow ${config.handle}`, href: config.url }} />
      <div className="grid grid-cols-3 gap-1.5 sm:gap-3 lg:grid-cols-6">
        {config.images.slice(0, 12).map((img, i) => (
          <a
            key={img.src + i}
            href={config.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group/insta relative aspect-square overflow-hidden rounded-md bg-muted"
          >
            <Image
              src={img.src}
              alt={img.alt || `Instagram photo ${i + 1}`}
              fill
              sizes="(min-width: 1024px) 16vw, 33vw"
              className="object-cover transition-transform duration-300 ease-snappy group-hover/insta:scale-105"
            />
          </a>
        ))}
      </div>
    </SectionShell>
  );
}

/** Gift ideas — "For Her", "Under $30", "Stocking Fillers"… */
export function GiftGuide({
  title,
  config,
}: {
  title: string | null;
  config: ConfigOf<"gift-guide">;
}) {
  return (
    <SectionShell>
      <SectionHeading title={title} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {config.cards.map((card) => (
          <Link
            key={card.href + card.title}
            href={card.href}
            className="group/gift flex flex-col gap-3"
          >
            <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-muted">
              <Image
                src={card.image}
                alt=""
                fill
                sizes="(min-width: 1024px) 25vw, 50vw"
                className="object-cover transition-transform duration-300 ease-snappy group-hover/gift:scale-105"
              />
            </div>
            <div>
              <p className="font-heading text-base font-extrabold uppercase tracking-wide">
                {card.title}
              </p>
              {card.subtitle && <p className="text-sm text-muted-foreground">{card.subtitle}</p>}
            </div>
          </Link>
        ))}
      </div>
    </SectionShell>
  );
}
