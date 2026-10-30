import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import type { HomeSectionData } from "@/lib/home-sections";
import { HeroVideo } from "./hero-video";

type HeroConfig = Extract<HomeSectionData, { type: "hero" }>["config"];

/**
 * Full-width hero. When it's the first section the image is preloaded in the
 * <head> so it paints first (it's the page's Largest Contentful Paint).
 */
export function Hero({ config, first }: { config: HeroConfig; first: boolean }) {
  return (
    <section className="relative isolate overflow-hidden bg-brand-ink text-brand-paper">
      {config.video ? (
        <HeroVideo src={config.video} poster={config.image} />
      ) : (
        config.image && (
          <Image
            src={config.image}
            alt=""
            fill
            sizes="100vw"
            preload={first}
            className="-z-10 object-cover"
          />
        )
      )}
      {/* Darkens the media so the white headline stays readable. */}
      <div
        className="absolute inset-0 -z-10 bg-gradient-to-r from-black/70 via-black/40 to-transparent"
        aria-hidden
      />

      {/*
        Text sits in one column on the left (the side the gradient darkens),
        sized per breakpoint so the headline wraps cleanly and never runs into
        the subheading or buttons. Hero pictures should be photos without words
        in them: words baked into the picture can't move out of the text's way.
      */}
      <div className="mx-auto flex min-h-[28rem] max-w-7xl flex-col items-start justify-center gap-5 px-4 py-16 sm:min-h-[36rem] sm:py-20">
        {config.eyebrow && <Badge variant="sale">{config.eyebrow}</Badge>}
        <h1 className="text-display max-w-[15ch] text-balance break-words text-[2.75rem] leading-[1.02] sm:text-6xl lg:max-w-3xl lg:text-7xl lg:leading-[0.98]">
          {config.headline}
        </h1>
        {config.subheading && (
          <p className="max-w-md text-base text-brand-paper/85">{config.subheading}</p>
        )}
        <div className="flex flex-wrap gap-3">
          <Link
            href={config.button.href}
            className={cn(
              buttonVariants({ size: "lg" }),
              "h-11 bg-brand-accent px-6 font-heading font-bold uppercase text-brand-accent-foreground hover:bg-brand-accent/85",
            )}
          >
            {config.button.label}
          </Link>
          {config.secondaryButton && (
            <Link
              href={config.secondaryButton.href}
              className={cn(
                buttonVariants({ size: "lg", variant: "outline" }),
                "h-11 border-brand-paper/40 bg-transparent px-6 font-heading font-bold uppercase text-brand-paper hover:bg-brand-paper/10 hover:text-brand-paper",
              )}
            >
              {config.secondaryButton.label}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
