import { ProductCard } from "@/components/product-card";
import type { HomeSectionData } from "@/lib/home-sections";
import { getCollectionRow } from "@/lib/catalog";
import { ScrollRow } from "./scroll-row";
import { SectionHeading, SectionShell } from "./section-heading";

type RowConfig = Extract<HomeSectionData, { type: "product-row" }>["config"];

/** A sideways-scrolling row of products from one collection (New In, Best Sellers, On Sale…). */
export async function ProductRow({ title, config }: { title: string | null; config: RowConfig }) {
  const products = await getCollectionRow(config.collection, config.limit);
  if (products.length === 0) return null;

  return (
    <SectionShell>
      <SectionHeading
        title={title}
        link={config.viewAll ?? { label: "Shop all", href: `/collections/${config.collection}` }}
      />
      <ScrollRow label={title ?? "Products"}>
        {products.map((p) => (
          <div key={p.id} className="w-[45%] shrink-0 snap-start sm:w-[30%] lg:w-[22%]">
            <ProductCard product={p} />
          </div>
        ))}
      </ScrollRow>
    </SectionShell>
  );
}
