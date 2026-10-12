import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProductCard } from "@/components/product-card";
import { navCategories, products } from "@/lib/placeholder-data";

export default function Home() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden bg-brand-ink text-brand-paper">
        <div
          className="absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(circle at 20% 20%, oklch(0.64 0.246 2 / 0.55), transparent 45%), radial-gradient(circle at 85% 70%, oklch(0.82 0.085 85 / 0.45), transparent 45%)",
          }}
          aria-hidden
        />
        <div className="relative mx-auto flex max-w-7xl flex-col items-start gap-5 px-4 py-20 sm:py-28">
          <Badge variant="sale">New Season</Badge>
          <h1 className="text-display max-w-3xl text-5xl leading-[0.95] sm:text-7xl">
            Shine loud.
            <br />
            <span className="text-brand-accent">Spend little.</span>
          </h1>
          <p className="max-w-md text-base text-brand-paper/80">
            Trend-led fashion jewellery dropping every week. Earrings, necklaces, rings and more —
            priced to stack.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              size="lg"
              className="bg-brand-accent px-6 text-brand-accent-foreground hover:bg-brand-accent/85"
            >
              Shop New In
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-brand-paper/30 bg-transparent px-6 text-brand-paper hover:bg-brand-paper/10 hover:text-brand-paper"
            >
              Shop Sale
            </Button>
          </div>
        </div>
      </section>

      {/* Category tiles */}
      <section className="mx-auto w-full max-w-7xl px-4 py-12">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {navCategories.map((cat) => (
            <Link
              key={cat.name}
              href={cat.href}
              className="group/tile relative flex aspect-square items-end overflow-hidden rounded-lg p-4"
              style={{ background: cat.image }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent transition-opacity duration-200 group-hover/tile:from-black/65" />
              <span className="relative font-heading text-lg font-extrabold uppercase tracking-wide text-white transition-transform duration-200 ease-snappy group-hover/tile:translate-x-1">
                {cat.name}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Trending grid */}
      <section className="mx-auto w-full max-w-7xl px-4 pb-20">
        <div className="mb-6 flex items-end justify-between">
          <h2 className="text-display text-3xl sm:text-4xl">Trending now</h2>
          <Link href="/new" className="text-sm font-medium text-brand-accent hover:underline">
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>
    </div>
  );
}
