import { cache } from "react";
import type { Metadata } from "next";
import { RichText } from "@/components/rich-text";
import { plainText } from "@/lib/content/rich-text";
import { prisma } from "@/lib/prisma";
import { redirectOrNotFound } from "@/lib/redirects";
import { pageMetadata, snippet } from "@/lib/seo";
import { getLivePage } from "@/lib/storefront";

/** About, FAQ, Shipping… — written in Site Content → Pages. */

const load = cache(getLivePage);

/** Pre-build every published page; new ones are built on first visit. */
export async function generateStaticParams() {
  return prisma.page.findMany({ where: { published: true }, select: { slug: true } });
}

export async function generateMetadata({ params }: PageProps<"/pages/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const page = await load(slug);
  if (!page) return {};
  return pageMetadata({
    title: page.seoTitle || page.title,
    description: page.seoDescription || snippet(plainText(page.content)),
    path: `/pages/${page.slug}`,
  });
}

export default async function ShopPage({ params }: PageProps<"/pages/[slug]">) {
  const { slug } = await params;
  const page = await load(slug);
  if (!page) return redirectOrNotFound(`/pages/${slug}`);
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
      <h1 className="text-display mb-8 text-4xl sm:text-5xl">{page.title}</h1>
      <RichText doc={page.content} />
    </article>
  );
}
