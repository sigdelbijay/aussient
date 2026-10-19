import { requireStaff } from "@/lib/auth/dal";
import { toCsv } from "@/lib/admin/csv";
import { prisma } from "@/lib/prisma";

/** Downloads every product as CSV — one row per finish (or one row if it has none). Re-import with /admin/products/import. */
export async function GET() {
  await requireStaff("/admin/products");

  const products = await prisma.product.findMany({
    orderBy: { name: "asc" },
    include: {
      category: { select: { slug: true } },
      media: { where: { variantId: null }, orderBy: { order: "asc" }, select: { url: true } },
      variants: { orderBy: { createdAt: "asc" } },
    },
  });

  const header = [
    "slug", "name", "status", "category", "price", "sale_price", "stock", "material", "style",
    "hypoallergenic", "featured", "description", "details", "care", "seo_title", "seo_description", "images",
    "variant", "variant_sku", "variant_price", "variant_sale_price", "variant_stock",
  ];
  const money = (d: { toString(): string } | null) => (d === null ? "" : Number(d).toFixed(2));
  const rows = products.flatMap((p) => {
    const base = [
      p.slug, p.name, p.status.toLowerCase(), p.category.slug, money(p.price), money(p.salePrice), p.stock,
      p.material, p.style, p.hypoallergenic ? "yes" : "no", p.featured ? "yes" : "no", p.description, p.details,
      p.care, p.seoTitle, p.seoDescription, p.media.map((m) => m.url).join(" | "),
    ];
    if (!p.variants.length) return [[...base, "", "", "", "", ""]];
    return p.variants.map((v) => [...base, v.name, v.sku, money(v.price), money(v.salePrice), v.stock]);
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
