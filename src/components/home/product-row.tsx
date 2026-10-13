import { ProductCard } from "@/components/product-card";
import type { HomeSectionData } from "@/lib/home-sections";
import { getProductRow } from "@/lib/storefront";
import { ScrollRow } from "./scroll-row";
import { SectionHeading, SectionShell } from "./section-heading";

type RowConfig = Extract<HomeSectionData, { type: "product-row" }>["config"];

/** New In / Best Sellers / On Sale / Featured / Under $X — a sideways-scrolling row. */
export async function ProductRow({ title, config }: { title: string | null; config: RowConfig }) {
  const products = await getProductRow(config.source, config.limit, config.maxPrice);
  if (products.length === 0) return null;

  return (
    <SectionShell>
      <SectionHeading title={title} link={config.viewAll} />
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
