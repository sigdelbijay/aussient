import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Eye } from "lucide-react";
import { cn } from "cn";
import { PageHeader } from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";
import { requireStaff } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Site Content" };

/** Overview of everything shoppers see, with which parts have unpublished drafts. */
export default async function SiteContentPage() {
  const user = await requireStaff("/admin/content");
  const [drafts, sections, header, pages, popups, redirects, emails] = await Promise.all([
    prisma.contentDraft.findMany({ select: { key: true } }),
    prisma.homeSection.count({ where: { active: true } }),
    prisma.menuItem.count({ where: { location: "header", parentId: null } }),
    prisma.page.count({ where: { published: true } }),
    prisma.popup.count({ where: { active: true } }),
    prisma.redirect.count(),
    prisma.emailTemplate.count(),
  ]);
  const draft = new Set(drafts.map((d) => (d.key.startsWith("page:") ? "pages" : d.key)));

  const cards = [
    { href: "/admin/content/home", title: "Home page", text: `${sections} sections showing`, draft: draft.has("home") },
    { href: "/admin/content/menus", title: "Menus", text: `${header} header links, plus the footer`, draft: draft.has("menu") },
    { href: "/admin/content/announcements", title: "Announcement bar", text: "Messages across the top of every page", draft: draft.has("announcements") },
    { href: "/admin/content/pages", title: "Pages", text: `${pages} live — About, FAQ, Shipping…`, draft: draft.has("pages") },
    { href: "/admin/content/popups", title: "Pop-ups", text: popups ? `${popups} switched on` : "None switched on", draft: draft.has("popups") },
    { href: "/admin/content/redirects", title: "Redirects", text: `${redirects} old links redirected`, draft: false },
    { href: "/admin/content/emails", title: "Emails", text: emails ? `${emails} customised` : "Using the original text", draft: false },
    ...(user.role === "ADMIN"
      ? [
          { href: "/admin/settings", title: "Settings", text: "Logo, contact details, colour, shipping prices (admins only)", draft: false },
          { href: "/admin/staff", title: "Staff", text: "Invite people to help run the shop (admins only)", draft: false },
        ]
      : []),
  ];

  return (
    <>
      <PageHeader
        title="Site Content"
        description="Everything shoppers see. Changes are saved as drafts — use Preview to check them, then Publish."
        actions={
          // A plain link (not prefetched), since visiting it switches Preview on.
          <a href="/api/preview?to=/" target="_blank" className={cn(buttonVariants({ variant: "outline" }), "h-9 gap-2 px-3")}>
            <Eye /> Preview the shop with drafts
          </a>
        }
      />
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((c) => (
          <li key={c.href}>
            <Link href={c.href} className="group flex h-full items-start gap-3 rounded-xl border border-border bg-background p-5 hover:border-foreground/30">
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 font-heading font-bold">
                  {c.title}
                  {c.draft && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[0.65rem] font-semibold text-amber-800">Draft</span>}
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">{c.text}</span>
              </span>
              <ArrowRight className="mt-1 size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
