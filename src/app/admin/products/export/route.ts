import { requireStaff } from "@/lib/auth/dal";
import { toCsv } from "@/lib/admin/csv";
import { prisma } from "@/lib/prisma";
import { readSpecFields, readSpecs } from "@/lib/product-types";

/**
 * Downloads every product as CSV — one row per variant. Specs get a
 * "spec:<label>" column each; option1–3 are the values for the product
 * type's options (e.g. M, Navy for a T-shirt). Re-import with /admin/products/import.
 */
export async function GET() {
  await requireStaff("/admin/products");

  const [products, types] = await Promise.all([
    prisma.product.findMany({
      orderBy: { name: "asc" },
      include: {
        productType: { select: { name: true } },
        brand: { select: { name: true } },
        categories: { select: { slug: true } },
        media: { where: { optionValueId: null }, orderBy: { order: "asc" }, select: { url: true } },
        variants: {
          orderBy: { createdAt: "asc" },
          include: { option1: { select: { value: true } }, option2: { select: { value: true } }, option3: { select: { value: true } } },
        },
      },
    }),
    prisma.productType.findMany({ orderBy: { name: "asc" }, select: { specFields: true } }),
  ]);

  // One column per spec label used by any product type.
  const specLabels = [...new Set(types.flatMap((t) => readSpecFields(t.specFields).map((f) => f.label)))];

  const header = [
    "slug", "name", "status", "type", "brand", "categories", "tags", "featured", "description", "details", "care",
    "seo_title", "seo_description", "images", ...specLabels.map((l) => `spec:${l}`),
    "option1", "option2", "option3", "sku", "price", "sale_price", "stock", "weight_grams", "barcode",
  ];
  const money = (d: { toString(): string } | null) => (d === null ? "" : Number(d).toFixed(2));
  const specText = (v: unknown) => (v === true ? "yes" : v === false ? "no" : (v ?? ""));
  const rows = products.flatMap((p) => {
    const specs = readSpecs(p.specs);
    const base = [
      p.slug, p.name, p.status.toLowerCase(), p.productType.name, p.brand?.name, p.categories.map((c) => c.slug).join(" | "),
      p.tags.join(" | "), p.featured ? "yes" : "no", p.description, p.details, p.care, p.seoTitle, p.seoDescription,
      p.media.map((m) => m.url).join(" | "), ...specLabels.map((l) => specText(specs[l])),
    ];
    return p.variants.map((v) => [
      ...base,
      v.option1?.value, v.option2?.value, v.option3?.value, v.sku, money(v.price), money(v.salePrice), v.stock, v.weightGrams, v.barcode,
    ]);
  });

  const date = new Date().toISOString().slice(0, 10);
  return new Response(toCsv(header, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="aussient-products-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
