import "server-only";
import { prisma } from "@/lib/prisma";
import { flattenTree } from "@/lib/category-tree";
import { readSpecFields } from "@/lib/product-types";
import type { ProductTypeChoice } from "@/components/admin/product-form";

/** Product types, brands and categories (in tree order) for the product form. */
export async function productFormChoices() {
  const [types, brands, categories] = await Promise.all([
    prisma.productType.findMany({ orderBy: { name: "asc" } }),
    prisma.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.category.findMany({ select: { id: true, name: true, parentId: true, order: true } }),
  ]);
  return {
    types: types.map(
      (t): ProductTypeChoice => ({ id: t.id, name: t.name, optionNames: t.optionNames, specFields: readSpecFields(t.specFields) }),
    ),
    brands,
    categories: flattenTree(categories).map((c) => ({ id: c.id, name: c.name, depth: c.depth })),
  };
}
