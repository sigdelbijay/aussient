"use client";

import { useState, useTransition } from "react";
import { Loader2, Undo2 } from "lucide-react";
import { FormAlert } from "@/components/auth/form-bits";
import { Button } from "@/components/ui/button";
import { restoreSettingsAction, saveSettingsAction } from "@/lib/admin/settings-actions";
import type { AdminFormState } from "@/lib/admin/form";
import { SOCIALS, type SocialKey } from "@/lib/socials";
import { AdminField, inputClass, Panel, textareaClass } from "./ui";
import { ImagePicker, type CloudinaryPublic } from "./upload-button";
import { useAdminForm } from "./use-admin-form";

export type SettingsValues = {
  storeName: string;
  logo: string;
  tagline: string;
  metaDescription: string;
  supportEmail: string;
  orderAlertEmail: string;
  contactPhone: string;
  abn: string;
  accentColor: string;
  socials: Partial<Record<SocialKey, string>>;
  freeShippingThreshold: string;
  flatShippingRate: string;
  expressShippingRate: string;
  deliveryInfo: string;
  returnsInfo: string;
  newsletterHeading: string;
  newsletterText: string;
  footerPerks: string;
  lowStockAlert: number;
  googleAnalyticsId: string;
};

const DEFAULT_ACCENT = "#c04a17"; // --brand-accent in globals.css (the logo orange, AA-safe)

/** Store-wide settings (ADMIN only). */
export function SettingsForm({
  values,
  cloudinary,
  versions,
}: {
  values: SettingsValues;
  cloudinary: CloudinaryPublic;
  versions: { id: string; when: string; by: string | null }[];
}) {
  const { state, onSubmit, pending } = useAdminForm(saveSettingsAction);
  const [logo, setLogo] = useState(values.logo);
  const [accent, setAccent] = useState(values.accentColor);
  const err = (k: string) => state?.fieldErrors?.[k];

  return (
    <div className="grid max-w-3xl gap-6">
      <form onSubmit={onSubmit} className="grid gap-6">
        <input type="hidden" name="logo" value={logo} />
        {state?.error && <FormAlert tone="error">{state.error}</FormAlert>}
        {state?.message && <FormAlert tone="success">{state.message}</FormAlert>}

        <Panel title="Store">
          <div className="grid gap-4 sm:grid-cols-2">
            <AdminField label="Store name" error={err("storeName")} hint="Page titles, emails, and the header when there’s no logo.">
              <input name="storeName" defaultValue={values.storeName} required maxLength={60} className={inputClass} />
            </AdminField>
            <AdminField label="Tagline" error={err("tagline")} hint="e.g. Fashion, accessories & lifestyle">
              <input name="tagline" defaultValue={values.tagline} maxLength={80} className={inputClass} />
            </AdminField>
            <AdminField label="Logo" error={err("logo")} hint="Shown in the header instead of the store name. The header is dark teal, so use a light or colourful logo: a wide PNG or SVG with a see-through background works best." className="sm:col-span-2">
              <ImagePicker config={cloudinary} folder="branding" value={logo} onChange={setLogo} />
            </AdminField>
            <AdminField label="Brand colour" error={err("accentColor")} hint="Buttons, badges and highlights. Blank = the Aussient logo orange.">
              <span className="flex items-center gap-2">
                <input type="color" aria-label="Pick the brand colour" value={accent || DEFAULT_ACCENT} onChange={(e) => setAccent(e.target.value)} className="h-10 w-12 shrink-0 cursor-pointer rounded-md border border-input bg-background p-1" />
                <input name="accentColor" value={accent} onChange={(e) => setAccent(e.target.value)} placeholder={DEFAULT_ACCENT} maxLength={7} className={inputClass} />
              </span>
            </AdminField>
            <AdminField label="Description in Google" error={err("metaDescription")} hint="Up to 170 characters" className="sm:col-span-2">
              <textarea name="metaDescription" defaultValue={values.metaDescription} rows={2} maxLength={170} className={textareaClass} />
            </AdminField>
          </div>
        </Panel>

        <Panel title="Contact" description="Shown in the footer.">
          <div className="grid gap-4 sm:grid-cols-2">
            <AdminField label="Email" error={err("supportEmail")}>
              <input name="supportEmail" type="email" defaultValue={values.supportEmail} maxLength={120} className={inputClass} />
            </AdminField>
            <AdminField label="Phone" error={err("contactPhone")}>
              <input name="contactPhone" type="tel" defaultValue={values.contactPhone} maxLength={30} className={inputClass} />
            </AdminField>
            <AdminField label="ABN" error={err("abn")} hint="11 digits — also printed on order confirmations (tax invoices)">
              <input name="abn" defaultValue={values.abn} maxLength={20} inputMode="numeric" className={inputClass} />
            </AdminField>
          </div>
        </Panel>

        <Panel title="Order alerts" description="Who gets an email for every new order. Not shown to shoppers.">
          <AdminField label="Send new-order emails to" error={err("orderAlertEmail")} hint="Leave blank to send them to every admin." className="max-w-md">
            <input name="orderAlertEmail" type="email" defaultValue={values.orderAlertEmail} maxLength={120} className={inputClass} />
          </AdminField>
        </Panel>

        <Panel title="Social links" description="Full links, e.g. https://instagram.com/aussient. Blank ones are hidden.">
          <div className="grid gap-4 sm:grid-cols-2">
            {(Object.keys(SOCIALS) as SocialKey[]).map((key) => (
              <AdminField key={key} label={SOCIALS[key]} error={err(`social_${key}`)}>
                <input name={`social_${key}`} type="url" defaultValue={values.socials[key] ?? ""} maxLength={300} placeholder="https://" className={inputClass} />
              </AdminField>
            ))}
          </div>
        </Panel>

        <Panel title="Shipping" description="Prices in AUD, including GST.">
          <div className="grid gap-4 sm:grid-cols-3">
            <AdminField label="Standard shipping ($)" error={err("flatShippingRate")} hint="Blank = always free">
              <input name="flatShippingRate" defaultValue={values.flatShippingRate} inputMode="decimal" className={inputClass} />
            </AdminField>
            <AdminField label="Express shipping ($)" error={err("expressShippingRate")} hint="Blank = no express option">
              <input name="expressShippingRate" defaultValue={values.expressShippingRate} inputMode="decimal" className={inputClass} />
            </AdminField>
            <AdminField label="Free standard shipping over ($)" error={err("freeShippingThreshold")} hint="Blank = no free-shipping offer">
              <input name="freeShippingThreshold" defaultValue={values.freeShippingThreshold} inputMode="decimal" className={inputClass} />
            </AdminField>
            <AdminField label="Delivery" error={err("deliveryInfo")} hint="“Delivery” section on product pages — one fact per line." className="sm:col-span-3">
              <textarea name="deliveryInfo" defaultValue={values.deliveryInfo} rows={3} maxLength={2000} className={textareaClass} />
            </AdminField>
            <AdminField label="Returns" error={err("returnsInfo")} hint="“Returns” section on product pages — one fact per line." className="sm:col-span-3">
              <textarea name="returnsInfo" defaultValue={values.returnsInfo} rows={3} maxLength={2000} className={textareaClass} />
            </AdminField>
          </div>
        </Panel>

        <Panel title="Footer">
          <div className="grid gap-4 sm:grid-cols-2">
            <AdminField label="Perks strip" error={err("footerPerks")} hint="Up to 4 short lines, e.g. Free shipping over $50" className="sm:col-span-2">
              <textarea name="footerPerks" defaultValue={values.footerPerks} rows={3} maxLength={500} className={textareaClass} />
            </AdminField>
            <AdminField label="Newsletter heading" error={err("newsletterHeading")}>
              <input name="newsletterHeading" defaultValue={values.newsletterHeading} maxLength={60} className={inputClass} />
            </AdminField>
            <AdminField label="Newsletter text" error={err("newsletterText")}>
              <input name="newsletterText" defaultValue={values.newsletterText} maxLength={300} className={inputClass} />
            </AdminField>
          </div>
        </Panel>

        <Panel title="Google Analytics">
          <AdminField
            label="Measurement ID"
            error={err("googleAnalyticsId")}
            hint="From Google Analytics → Admin → Data streams → your web stream, e.g. G-ABC123XYZ. Leave blank for no analytics. It only loads for shoppers who accept cookies."
            className="max-w-xs"
          >
            <input name="googleAnalyticsId" defaultValue={values.googleAnalyticsId} maxLength={20} placeholder="G-…" className={inputClass} />
          </AdminField>
        </Panel>

        <Panel title="Stock">
          <AdminField label="Low-stock alert" error={err("lowStockAlert")} hint="The dashboard and product list flag variants with this many or fewer left." className="max-w-xs">
            <input name="lowStockAlert" type="number" min={0} max={1000} defaultValue={values.lowStockAlert} className={inputClass} />
          </AdminField>
        </Panel>

        <Button type="submit" size="lg" disabled={pending} className="h-11 w-fit px-6 font-semibold">
          {pending && <Loader2 className="animate-spin" />}
          Save settings
        </Button>
      </form>

      <SettingsVersions versions={versions} />
    </div>
  );
}

/** The last few saves; an older one can be put back. */
function SettingsVersions({ versions }: { versions: { id: string; when: string; by: string | null }[] }) {
  const [state, setState] = useState<AdminFormState>(undefined);
  const [asking, setAsking] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const restore = (id: string) =>
    start(async () => {
      const result = await restoreSettingsAction(id);
      setState(result);
      setAsking(null);
      // Reload so the boxes show the restored settings.
      if (!result?.error) window.location.reload();
    });

  return (
    <Panel title="Version history" description="The last few saves. Restore puts older settings back.">
      {state?.error && <FormAlert tone="error">{state.error}</FormAlert>}
      {versions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No saves yet.</p>
      ) : (
        <ol className="grid gap-2 text-sm">
          {versions.map((v, i) => (
            <li key={v.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-medium tabular-nums">{v.when}</span>
              <span className="text-xs text-muted-foreground">{v.by ?? "Before the first change"}</span>
              <span className="ml-auto text-xs">
                {i === 0 ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[0.7rem] font-semibold text-emerald-800">Current</span>
                ) : asking === v.id ? (
                  <span className="flex items-center gap-1">
                    Put these settings back?
                    <button type="button" disabled={pending} onClick={() => restore(v.id)} className="rounded bg-brand-ink px-1.5 py-0.5 font-semibold text-brand-paper">
                      Yes
                    </button>
                    <button type="button" onClick={() => setAsking(null)} className="rounded px-1.5 py-0.5 hover:bg-muted">
                      No
                    </button>
                  </span>
                ) : (
                  <button type="button" onClick={() => setAsking(v.id)} className="flex items-center gap-1 rounded px-1.5 py-1 hover:bg-muted">
                    <Undo2 className="size-3.5" /> Restore
                  </button>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
