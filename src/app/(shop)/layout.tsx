import { AnnouncementBar } from "@/components/announcement-bar";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { BagPanel } from "@/components/bag/bag-panel";
import { getLiveSiteChrome } from "@/lib/storefront";

/** Storefront chrome: announcement bar, header, footer and the slide-out bag. */
export default async function ShopLayout({ children }: LayoutProps<"/">) {
  // Announcement bar, menus and footer come from the database (cached; see src/lib/storefront.ts).
  const chrome = await getLiveSiteChrome();

  return (
    <>
      <AnnouncementBar items={chrome.announcements} />
      <SiteHeader menu={chrome.headerMenu} />
      <main className="flex-1">{children}</main>
      <SiteFooter settings={chrome.settings} menu={chrome.footerMenu} />
      <BagPanel />
    </>
  );
}
