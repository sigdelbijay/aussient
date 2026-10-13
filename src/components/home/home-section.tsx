import type { HomeSectionData } from "@/lib/home-sections";
import { Countdown } from "./countdown";
import { Hero } from "./hero";
import {
  CategoryTiles,
  GiftGuide,
  ImageWithText,
  InstagramGrid,
  PromoBanner,
} from "./image-sections";
import { NewsletterSection } from "./newsletter-section";
import { ProductRow } from "./product-row";
import { Reviews } from "./reviews";

/** Renders one home page section by its type. */
export function HomeSection({ section, first }: { section: HomeSectionData; first: boolean }) {
  switch (section.type) {
    case "hero":
      return <Hero config={section.config} first={first} />;
    case "product-row":
      return <ProductRow title={section.title} config={section.config} />;
    case "category-tiles":
      return <CategoryTiles title={section.title} config={section.config} />;
    case "promo-banner":
      return <PromoBanner config={section.config} />;
    case "image-text":
      return <ImageWithText config={section.config} />;
    case "countdown": {
      const endsAt = section.config.endsAt ?? section.endsAt;
      if (!endsAt) return null; // nothing to count down to
      return (
        <Countdown
          heading={section.config.heading}
          text={section.config.text}
          endsAt={endsAt}
          button={section.config.button}
        />
      );
    }
    case "reviews":
      return <Reviews title={section.title} limit={section.config.limit} />;
    case "instagram":
      return <InstagramGrid title={section.title} config={section.config} />;
    case "gift-guide":
      return <GiftGuide title={section.title} config={section.config} />;
    case "newsletter":
      return <NewsletterSection heading={section.config.heading} text={section.config.text} />;
  }
}
