import "server-only";
import { prisma } from "@/lib/prisma";
import type { DocKey } from "@/lib/content/docs";
import { listVersions, loadForEditing, type DocOf } from "@/lib/content/store";
import { cloudinaryConfig } from "./cloudinary";
import { formatShopDate } from "./dates";

/** What every content editor page loads: the document, whether it has a draft, its versions. */
export async function editorData<K extends DocKey>(key: K) {
  const [{ doc, draftSavedAt }, versions] = await Promise.all([loadForEditing(key), listVersions(key)]);
  return {
    doc: doc as DocOf<K> | null,
    hasDraft: draftSavedAt !== null,
    versions: versions.map((v) => ({ id: v.id, createdAt: v.createdAt.toISOString(), when: formatShopDate(v.createdAt), by: v.by })),
  };
}

/** Cloudinary details the upload button needs (no secret). */
export function uploadConfig() {
  const c = cloudinaryConfig();
  return c && { cloudName: c.cloudName, apiKey: c.apiKey };
}

/** Every page in the shop, as suggestions for link boxes. */
export async function shopLinks() {
  const [categories, collections, brands, pages] = await Promise.all([
    prisma.category.findMany({ orderBy: [{ order: "asc" }, { name: "asc" }], select: { name: true, slug: true } }),
    prisma.collection.findMany({ orderBy: { name: "asc" }, select: { name: true, slug: true } }),
    prisma.brand.findMany({ orderBy: { name: "asc" }, select: { name: true, slug: true } }),
    prisma.page.findMany({ orderBy: { title: "asc" }, select: { title: true, slug: true } }),
  ]);
  const seen = new Set<string>();
  return [
    { label: "Home", url: "/" },
    { label: "New In", url: "/new-in" },
    { label: "Sale", url: "/sale" },
    { label: "Shop all", url: "/collections/all" },
    ...categories.map((c) => ({ label: `Category: ${c.name}`, url: `/collections/${c.slug}` })),
    ...collections.map((c) => ({ label: `Collection: ${c.name}`, url: `/collections/${c.slug}` })),
    ...brands.map((b) => ({ label: `Brand: ${b.name}`, url: `/brands/${b.slug}` })),
    ...pages.map((p) => ({ label: `Page: ${p.title}`, url: `/pages/${p.slug}` })),
  ].filter((l) => !seen.has(l.url) && seen.add(l.url));
}

/** Choices for menu links: every category, collection, brand and page. */
export async function linkTargets() {
  const [categories, collections, brands, pages] = await Promise.all([
    prisma.category.findMany({ orderBy: [{ order: "asc" }, { name: "asc" }], select: { id: true, name: true, parentId: true } }),
    prisma.collection.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.page.findMany({ orderBy: { title: "asc" }, select: { id: true, title: true, published: true } }),
  ]);
  // Sub-categories show their parent, e.g. "Jewellery › Earrings".
  const name = new Map(categories.map((c) => [c.id, c]));
  const path = (id: string | null): string => {
    const c = id ? name.get(id) : undefined;
    return c ? (c.parentId ? `${path(c.parentId)} › ${c.name}` : c.name) : "";
  };
  return {
    category: categories.map((c) => ({ id: c.id, name: path(c.id) })).sort((a, b) => a.name.localeCompare(b.name)),
    collection: collections,
    brand: brands,
    page: pages.map((p) => ({ id: p.id, name: p.published ? p.title : `${p.title} (hidden)` })),
  };
}
