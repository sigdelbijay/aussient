import { HomeSection } from "@/components/home/home-section";
import { parseSection } from "@/lib/home-sections";
import { getLiveHomeSections } from "@/lib/storefront";

/**
 * Home page, built from the HomeSection table: switched-on sections, in the
 * admin's order, within their start/end dates.
 *
 * The page is static. It's rebuilt only when an admin change clears the cache
 * (refreshStorefront in src/lib/cache.ts) or when a scheduled section's start or
 * end time arrives.
 */
export default async function Home() {
  const sections = (await getLiveHomeSections()).map(parseSection).filter((s) => s !== null);

  return (
    <div className="flex flex-col">
      {sections.map((section, i) => (
        <HomeSection key={section.id} section={section} first={i === 0} />
      ))}
    </div>
  );
}
