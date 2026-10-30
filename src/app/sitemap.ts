import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { absoluteUrl } from "@/lib/seo";

/**
 * /sitemap.xml — every page Google should know about: home, live products,
 * categories, collections, brands and published info pages. Built from the
 * database, and rebuilt at most once an hour.
 */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories, collections, brands, pages] = await Promise.all([
    prisma.product.findMany({ where: { status: "LIVE" }, select: { slug: true, updatedAt: true } }),
    prisma.category.findMany({ select: { slug: true, updatedAt: true } }),
    prisma.collection.findMany({ select: { slug: true, updatedAt: true } }),
    prisma.brand.findMany({
      where: { products: { some: { status: "LIVE" } } },
      select: { slug: true, updatedAt: true },
    }),
    prisma.page.findMany({ where: { published: true }, select: { slug: true, updatedAt: true } }),
  ]);

  const entry = (
    path: string,
    lastModified?: Date,
    priority = 0.5,
  ): MetadataRoute.Sitemap[number] => ({
    url: absoluteUrl(path),
    lastModified,
    priority,
  });

  const all = [
    entry("/", undefined, 1),
    entry("/new-in", undefined, 0.8),
    entry("/sale", undefined, 0.8),
    ...categories.map((c) => entry(`/collections/${c.slug}`, c.updatedAt, 0.8)),
    ...collections.map((c) => entry(`/collections/${c.slug}`, c.updatedAt, 0.7)),
    ...products.map((p) => entry(`/products/${p.slug}`, p.updatedAt, 0.7)),
    ...brands.map((b) => entry(`/brands/${b.slug}`, b.updatedAt, 0.5)),
    ...pages.map((p) => entry(`/pages/${p.slug}`, p.updatedAt, 0.3)),
  ];
  // A category and a collection can't share an address, but just in case: list each page once.
  return all.filter((e, i) => all.findIndex((x) => x.url === e.url) === i);
}
