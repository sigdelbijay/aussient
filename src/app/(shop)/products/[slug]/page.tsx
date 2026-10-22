import { cache, Fragment } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { ProductCard } from "@/components/product-card";
import { ScrollRow } from "@/components/home/scroll-row";
import { SectionHeading, SectionShell } from "@/components/home/section-heading";
import { ProductReviews } from "@/components/product/product-reviews";
import { ProductView } from "@/components/product/product-view";
import { getAllProductSlugs, getProduct, getRelatedProducts, type ProductDetail } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";
import { absoluteUrl, JsonLd, pageMetadata, SITE_NAME, snippet } from "@/lib/seo";
import { getSiteChrome, type ProductCardData, type SiteChrome } from "@/lib/storefront";

// Shared by generateMetadata and the page, so the product loads once per request.
const loadProduct = cache(getProduct);

/** Pre-build every live product page; new products are built on first visit. */
export async function generateStaticParams() {
  return (await getAllProductSlugs()).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/products/[slug]">): Promise<Metadata> {
  const product = await loadProduct((await params).slug);
  if (!product) return {};
  const pay = product.fromPrice;
  const photo = product.media.find((m) => m.type === "IMAGE" && !m.optionValueId) ?? product.media[0];
  return {
    ...pageMetadata({
      title: product.seoTitle || product.name,
      description: snippet(
        product.seoDescription ||
          `${product.description ?? product.name} ${product.variants.length > 1 ? "From " : ""}${formatPrice(pay)}.`,
      ),
      path: `/products/${product.slug}`,
      image: photo?.type === "IMAGE" ? { url: photo.url, alt: photo.alt } : null,
    }),
    // Price tags read by Facebook/Pinterest link previews.
    other: {
      "product:price:amount": pay.toFixed(2),
      "product:price:currency": "AUD",
    },
  };
}

export default async function ProductPage({ params }: PageProps<"/products/[slug]">) {
  const product = await loadProduct((await params).slug);
  if (!product) notFound();

  const look = product.completeTheLook;
  const [related, chrome] = await Promise.all([
    getRelatedProducts(
      { id: product.id, categoryIds: product.categoryIds, productTypeId: product.productTypeId },
      look.map((p) => p.id),
    ),
    getSiteChrome(),
  ]);

  return (
    <>
      <JsonLd data={productJsonLd(product, chrome.settings)} />
      <JsonLd data={breadcrumbJsonLd(product)} />

      <div className="mx-auto max-w-7xl px-4 pt-4 sm:pt-6">
        <nav aria-label="Breadcrumb" className="mb-4 text-xs text-muted-foreground">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link href="/" className="hover:text-foreground">
                Home
              </Link>
            </li>
            {product.breadcrumb.map((c) => (
              <Fragment key={c.slug}>
                <li aria-hidden>/</li>
                <li>
                  <Link href={`/collections/${c.slug}`} className="hover:text-foreground">
                    {c.name}
                  </Link>
                </li>
              </Fragment>
            ))}
            <li aria-hidden>/</li>
            <li aria-current="page" className="text-foreground">
              {product.name}
            </li>
          </ol>
        </nav>

        <ProductView product={product}>
          <InfoSection title="Description" open>
            {product.description && <p>{product.description}</p>}
            {(product.brand || product.specs.length > 0) && (
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                {product.brand && (
                  <>
                    <dt className="font-medium text-foreground">Brand</dt>
                    <dd>{product.brand.name}</dd>
                  </>
                )}
                {product.specs.map((spec) => (
                  <Fragment key={spec.label}>
                    <dt className="font-medium text-foreground">{spec.label}</dt>
                    <dd>{spec.value}</dd>
                  </Fragment>
                ))}
              </dl>
            )}
          </InfoSection>
          {product.details && <InfoSection title="Details">{lines(product.details)}</InfoSection>}
          {product.care && <InfoSection title="Care">{lines(product.care)}</InfoSection>}
          {product.sizeGuide && (
            <InfoSection title="Size guide" id="size-guide">
              <SizeGuideTable guide={product.sizeGuide} />
            </InfoSection>
          )}
          <InfoSection title="Shipping & returns">{shippingText(chrome.settings)}</InfoSection>
        </ProductView>

        <ProductReviews product={product} />
      </div>

      <ProductRow title="Complete the look" products={look} />
      <ProductRow title="You may also like" products={related} />
    </>
  );
}

// ── Page pieces ─────────────────────────────────────────────────

function InfoSection({
  title,
  open,
  id,
  children,
}: {
  title: string;
  open?: boolean;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <details open={open} id={id} className="group/info scroll-mt-24">
      <summary className="flex cursor-pointer list-none items-center justify-between py-4 font-heading text-sm font-bold uppercase tracking-wide [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown className="size-4 transition-transform duration-200 group-open/info:rotate-180" />
      </summary>
      <div className="pb-5 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </details>
  );
}

/** Admin text with one fact per line → a list. */
function lines(text: string) {
  const rows = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (rows.length === 1) return <p>{rows[0]}</p>;
  return (
    <ul className="grid gap-1">
      {rows.map((l, i) => (
        <li key={i}>{l}</li>
      ))}
    </ul>
  );
}

function SizeGuideTable({ guide }: { guide: NonNullable<ProductDetail["sizeGuide"]> }) {
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-left text-xs [&_td]:border-t [&_td]:border-border [&_td]:px-2 [&_td]:py-1.5 [&_th]:px-2 [&_th]:py-1.5 [&_th]:font-semibold [&_th]:text-foreground">
          <thead>
            <tr>
              {guide.columns.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {guide.rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {guide.notes && <p className="mt-2 text-xs">{guide.notes}</p>}
    </>
  );
}

function shippingText(settings: SiteChrome["settings"]) {
  const { freeShippingThreshold: free, flatShippingRate: flat } = settings;
  return (
    <ul className="grid gap-1">
      {free !== null && <li>Free standard shipping on orders over {formatPrice(free)}.</li>}
      {flat !== null && <li>Flat-rate shipping of {formatPrice(flat)} Australia-wide otherwise.</li>}
      <li>
        Changed your mind? Return unworn items within 30 days —{" "}
        <Link href="/help/returns" className="underline">
          see our returns policy
        </Link>
        .
      </li>
    </ul>
  );
}

function ProductRow({ title, products }: { title: string; products: ProductCardData[] }) {
  if (products.length === 0) return null;
  return (
    <SectionShell className="border-t border-border">
      <SectionHeading title={title} />
      <ScrollRow label={title}>
        {products.map((p) => (
          <div key={p.id} className="w-[45%] shrink-0 snap-start sm:w-[30%] lg:w-[22%]">
            <ProductCard product={p} />
          </div>
        ))}
      </ScrollRow>
    </SectionShell>
  );
}

// ── Google structured data ──────────────────────────────────────

const IN_STOCK = "https://schema.org/InStock";
const OUT_OF_STOCK = "https://schema.org/OutOfStock";

/** An offer at the price shoppers pay, with the original shown as a strikethrough price. */
function offer(
  url: string,
  price: number,
  salePrice: number | null,
  stock: number,
  settings: SiteChrome["settings"],
) {
  const onSale = salePrice !== null && salePrice < price;
  const { freeShippingThreshold: free, flatShippingRate: flat } = settings;
  const pay = onSale ? salePrice : price;
  const shippingCost = free !== null && pay >= free ? 0 : flat;
  return {
    "@type": "Offer",
    url,
    priceCurrency: "AUD",
    price: pay.toFixed(2),
    availability: stock > 0 ? IN_STOCK : OUT_OF_STOCK,
    itemCondition: "https://schema.org/NewCondition",
    ...(onSale && {
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        priceType: "https://schema.org/StrikethroughPrice",
        price: price.toFixed(2),
        priceCurrency: "AUD",
      },
    }),
    ...(shippingCost !== null && {
      shippingDetails: {
        "@type": "OfferShippingDetails",
        shippingRate: { "@type": "MonetaryAmount", value: shippingCost.toFixed(2), currency: "AUD" },
        shippingDestination: { "@type": "DefinedRegion", addressCountry: "AU" },
      },
    }),
  };
}

/** schema.org names for options Google understands (others are just part of the variant name). */
const VARIES_BY: Record<string, string> = {
  colour: "https://schema.org/color",
  color: "https://schema.org/color",
  size: "https://schema.org/size",
  material: "https://schema.org/material",
  pattern: "https://schema.org/pattern",
};

/**
 * schema.org Product (or ProductGroup when it has several variants) so
 * Google can show price, stock and star ratings in search results.
 */
function productJsonLd(product: ProductDetail, settings: SiteChrome["settings"]) {
  const url = absoluteUrl(`/products/${product.slug}`);
  // A variant's own photos (of its option values) first, then the general ones.
  const images = (optionIds: (string | null)[]) => {
    const photos = product.media.filter((m) => m.type === "IMAGE");
    return [
      ...photos.filter((m) => m.optionValueId && optionIds.includes(m.optionValueId)),
      ...photos.filter((m) => !m.optionValueId),
    ].map((m) => m.url);
  };

  const shared = {
    "@context": "https://schema.org",
    name: product.name,
    description: product.description ?? undefined,
    url,
    brand: { "@type": "Brand", name: product.brand?.name ?? SITE_NAME },
    category: product.breadcrumb.at(-1)?.name ?? product.productType,
    additionalProperty: product.specs.map((s) => ({ "@type": "PropertyValue", name: s.label, value: s.value })),
    ...(product.rating.count > 0 && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: product.rating.average.toFixed(1),
        reviewCount: product.rating.count,
        bestRating: 5,
        worstRating: 1,
      },
      review: product.reviews.slice(0, 5).map((r) => ({
        "@type": "Review",
        author: { "@type": "Person", name: r.author },
        datePublished: r.createdAt.slice(0, 10),
        name: r.title ?? undefined,
        reviewBody: r.body ?? undefined,
        reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5, worstRating: 1 },
      })),
    }),
  };

  if (product.variants.length === 1) {
    const v = product.variants[0];
    return {
      ...shared,
      "@type": "Product",
      sku: v.sku ?? v.id,
      image: images(v.optionIds),
      offers: offer(url, v.price, v.salePrice, v.stock, settings),
    };
  }

  const valueOf = (v: ProductDetail["variants"][number], slot: number) =>
    product.options.find((o) => o.slot === slot)?.values.find((x) => x.id === v.optionIds[slot])?.value;
  return {
    ...shared,
    "@type": "ProductGroup",
    productGroupID: product.id,
    variesBy: product.options.map((o) => VARIES_BY[o.name.toLowerCase()]).filter(Boolean),
    hasVariant: product.variants.map((v) => ({
      "@type": "Product",
      sku: v.sku ?? v.id,
      name: v.label ? `${product.name} — ${v.label}` : product.name,
      // e.g. color: "Navy", size: "M" for the options Google understands.
      ...Object.fromEntries(
        product.options
          .filter((o) => VARIES_BY[o.name.toLowerCase()])
          .map((o) => [VARIES_BY[o.name.toLowerCase()].split("/").pop()!, valueOf(v, o.slot)]),
      ),
      image: images(v.optionIds),
      offers: offer(url, v.price, v.salePrice, v.stock, settings),
    })),
  };
}

function breadcrumbJsonLd(product: ProductDetail) {
  const crumbs = [
    { name: "Home", path: "/" },
    ...product.breadcrumb.map((c) => ({ name: c.name, path: `/collections/${c.slug}` })),
    { name: product.name, path: `/products/${product.slug}` },
  ];
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: absoluteUrl(c.path),
    })),
  };
}
