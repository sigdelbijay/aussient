import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { cn } from "cn";
import { PageHeader } from "@/components/admin/ui";
import { CopyUrlButton } from "@/components/admin/copy-url-button";
import { cloudinaryConfig, listAssets, type CloudinaryAsset } from "@/lib/admin/cloudinary";
import { requireStaff } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Media library" };

const size = (bytes: number) => (bytes > 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.round(bytes / 1e3)} KB`);

/** Every photo and video uploaded to the shop's Cloudinary folder, with where each is used. */
export default async function MediaLibraryPage({ searchParams }: PageProps<"/admin/media">) {
  await requireStaff("/admin/media");
  const sp = await searchParams;
  const type = sp.type === "video" ? "video" : "image";
  const cursor = typeof sp.cursor === "string" ? sp.cursor : undefined;

  let assets: CloudinaryAsset[] = [];
  let next: string | null = null;
  let error: string | null = null;
  if (!cloudinaryConfig()) error = "Add the CLOUDINARY_* settings to .env to see uploads.";
  else {
    try {
      ({ assets, next } = await listAssets(type, cursor));
    } catch {
      error = "Couldn't reach Cloudinary — try again in a moment.";
    }
  }

  // Which products/categories use each file.
  const urls = assets.map((a) => a.url);
  const [media, categories] = await Promise.all([
    prisma.productMedia.findMany({
      where: { url: { in: urls } },
      select: { url: true, product: { select: { id: true, name: true } } },
    }),
    prisma.category.findMany({ where: { image: { in: urls } }, select: { image: true, name: true } }),
  ]);
  const usage = new Map<string, { label: string; href: string }[]>();
  for (const m of media) usage.set(m.url, [...(usage.get(m.url) ?? []), { label: m.product.name, href: `/admin/products/${m.product.id}` }]);
  for (const c of categories) usage.set(c.image!, [...(usage.get(c.image!) ?? []), { label: `${c.name} (category)`, href: "/admin/categories" }]);

  return (
    <>
      <PageHeader title="Media library" description="Everything uploaded to Cloudinary. Upload new files from a product or category." />

      <div className="mb-4 flex gap-1 rounded-lg bg-background p-1 text-sm shadow-xs ring-1 ring-border w-fit">
        {(["image", "video"] as const).map((t) => (
          <Link
            key={t}
            href={`/admin/media?type=${t}`}
            aria-current={t === type ? "page" : undefined}
            className={cn("rounded-md px-4 py-1.5", t === type ? "bg-brand-ink font-semibold text-brand-paper" : "hover:bg-muted")}
          >
            {t === "image" ? "Photos" : "Videos"}
          </Link>
        ))}
      </div>

      {error ? (
        <p className="rounded-xl border border-dashed border-border bg-background px-4 py-16 text-center text-sm text-destructive">{error}</p>
      ) : assets.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-background px-4 py-16 text-center text-sm text-muted-foreground">
          No {type === "image" ? "photos" : "videos"} uploaded yet.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
          {assets.map((a) => {
            const used = usage.get(a.url) ?? [];
            return (
              <li key={a.publicId} className="grid content-start gap-2 rounded-lg border border-border bg-background p-2">
                <div className="relative aspect-square overflow-hidden rounded-md bg-muted">
                  {a.type === "video" ? (
                    <video src={a.url} muted playsInline preload="metadata" controls className="size-full object-cover" />
                  ) : (
                    <Image src={a.url} alt="" fill sizes="240px" className="object-cover" />
                  )}
                </div>
                <div className="grid gap-0.5 text-xs">
                  <p className="truncate font-medium" title={a.publicId}>{a.publicId.split("/").pop()}</p>
                  <p className="text-muted-foreground">
                    {a.format.toUpperCase()} · {size(a.bytes)}
                    {a.width && ` · ${a.width}×${a.height}`}
                  </p>
                  {used.length ? (
                    used.map((u, i) => (
                      <Link key={i} href={u.href} className="truncate text-foreground underline">
                        {u.label}
                      </Link>
                    ))
                  ) : (
                    <p className="text-muted-foreground">Not used</p>
                  )}
                </div>
                <CopyUrlButton url={a.url} />
              </li>
            );
          })}
        </ul>
      )}

      {next && (
        <div className="mt-6 text-center">
          <Link href={`/admin/media?type=${type}&cursor=${encodeURIComponent(next)}`} className="text-sm font-semibold underline">
            Older {type === "image" ? "photos" : "videos"} →
          </Link>
        </div>
      )}
    </>
  );
}
