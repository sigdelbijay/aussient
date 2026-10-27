import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FormAlert } from "@/components/auth/form-bits";
import { DiscountForm } from "@/components/admin/discount-form";
import { PageHeader } from "@/components/admin/ui";
import { toShopInput } from "@/lib/admin/dates";
import { productFormChoices } from "@/lib/admin/product-choices";
import { requireStaff } from "@/lib/auth/dal";
import { STATUS_LABELS, discountStatus } from "@/lib/discounts";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Discount" };

const text = (d: { toString(): string } | number | null) => (d === null ? "" : String(Number(d)));

/** /admin/discounts/new adds one; /admin/discounts/<id> edits it. */
export default async function DiscountPage({ params, searchParams }: PageProps<"/admin/discounts/[id]">) {
  const { id } = await params;
  await requireStaff(`/admin/discounts/${id}`);
  const sp = await searchParams;

  const [d, choices, collections, products] = await Promise.all([
    id === "new" ? null : prisma.discount.findUnique({ where: { id }, include: { products: { select: { id: true } } } }),
    productFormChoices(),
    prisma.collection.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.product.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        status: true,
        productType: { select: { name: true } },
        media: { where: { type: "IMAGE" }, orderBy: { order: "asc" }, take: 1, select: { url: true } },
      },
    }),
  ]);
  if (id !== "new" && !d) notFound();

  return (
    <>
      <PageHeader
        title={d ? (d.code ?? d.title ?? "Automatic offer") : "New discount"}
        description={
          <Link href="/admin/discounts" className="underline">
            Discounts
          </Link>
        }
      />
      {sp.created && (
        <div className="mb-4">
          <FormAlert tone="success">Discount created.</FormAlert>
        </div>
      )}
      {/* Keyed by id only, so a save doesn't reset the form (and its "saved" message). */}
      <DiscountForm
        key={d?.id ?? "new"}
        status={d ? STATUS_LABELS[discountStatus(d, new Date())] : null}
        timesUsed={d?.timesUsed ?? 0}
        categories={choices.categories}
        types={choices.types.map((t) => ({ id: t.id, name: t.name }))}
        brands={choices.brands}
        collections={collections}
        products={products.map((p) => ({ id: p.id, name: p.name, image: p.media[0]?.url ?? null, live: p.status === "LIVE", type: p.productType.name }))}
        values={{
          id: d?.id ?? null,
          kind: d && d.code === null ? "AUTOMATIC" : "CODE",
          code: d?.code ?? "",
          title: d?.title ?? "",
          type: d?.type ?? "PERCENT",
          value: text(d?.value ?? null),
          buyQuantity: text(d?.buyQuantity ?? null),
          getQuantity: text(d?.getQuantity ?? null),
          scope: d?.scope ?? "ALL",
          categoryId: d?.categoryId ?? "",
          productTypeId: d?.productTypeId ?? "",
          brandId: d?.brandId ?? "",
          collectionId: d?.collectionId ?? "",
          productIds: d?.products.map((p) => p.id) ?? [],
          minSpend: text(d?.minSpend ?? null),
          startsAt: toShopInput(d?.startsAt ?? null),
          endsAt: toShopInput(d?.endsAt ?? null),
          usageLimit: text(d?.usageLimit ?? null),
          perCustomerLimit: text(d?.perCustomerLimit ?? null),
          firstOrderOnly: d?.firstOrderOnly ?? false,
          active: d?.active ?? true,
        }}
      />
    </>
  );
}
