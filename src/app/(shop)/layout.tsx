import { AnnouncementBar } from "@/components/announcement-bar";
import { PreviewBar } from "@/components/preview-bar";
import { SitePopup } from "@/components/site-popup";
import { accentCss } from "@/lib/colors";
import { OffersProvider } from "@/components/offers-provider";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { BagPanel } from "@/components/bag/bag-panel";
import { CookieConsent } from "@/components/cookie-consent";
import { getLiveOffers } from "@/lib/offers";
import { getLiveSiteChrome } from "@/lib/storefront";

/** Storefront chrome: announcement bar, header, footer, pop-up and the slide-out bag. */
export default async function ShopLayout({ children }: LayoutProps<"/">) {
  // Announcement bar, menus and footer come from the database (cached; see src/lib/storefront.ts).
  const [chrome, offers] = await Promise.all([getLiveSiteChrome(), getLiveOffers()]);
  // Automatic offers (from Discounts) lead the bar, then the admin's announcements
  // (skipping any that just repeat an offer word for word).
  const offerTexts = new Set(offers.map((o) => o.text.toLowerCase()));
  const announcements = [
    ...offers.map((o) => ({ id: o.id, text: o.text, link: o.link })),
    ...chrome.announcements.filter((a) => !offerTexts.has(a.text.toLowerCase())),
  ];

  const accent = accentCss(chrome.settings.accentColor);
  const popup = chrome.popups[0];

  return (
    <OffersProvider offers={offers.map((o) => ({ id: o.id, badge: o.badge, text: o.text, productIds: o.productIds }))}>
      {/* The accent colour from Settings (only ever a checked #rrggbb value). */}
      {accent && <style>{accent}</style>}
      {chrome.preview && <PreviewBar />}
      <AnnouncementBar items={announcements} />
      <SiteHeader menu={chrome.headerMenu} storeName={chrome.settings.storeName} logo={chrome.settings.logo} />
      <main className="flex-1">{children}</main>
      <SiteFooter settings={chrome.settings} menu={chrome.footerMenu} />
      <BagPanel />
      <CookieConsent gaId={chrome.settings.googleAnalyticsId} />
      {popup && <SitePopup key={popup.id} popup={popup} preview={chrome.preview} />}
    </OffersProvider>
  );
}
