"use client";

import { Loader2 } from "lucide-react";
import { FormAlert } from "@/components/auth/form-bits";
import { Button } from "@/components/ui/button";
import { saveSettingsAction } from "@/lib/admin/settings-actions";
import { AdminField, inputClass, Panel, textareaClass } from "./ui";
import { useAdminForm } from "./use-admin-form";

export type SettingsValues = {
  storeName: string;
  tagline: string;
  metaDescription: string;
  supportEmail: string;
  freeShippingThreshold: string;
  flatShippingRate: string;
  deliveryInfo: string;
  returnsInfo: string;
  lowStockAlert: number;
};

/** Store-wide settings (ADMIN only). */
export function SettingsForm({ values }: { values: SettingsValues }) {
  const { state, onSubmit, pending } = useAdminForm(saveSettingsAction);
  const err = (k: string) => state?.fieldErrors?.[k];

  return (
    <form onSubmit={onSubmit} className="grid max-w-3xl gap-6">
      {state?.error && <FormAlert tone="error">{state.error}</FormAlert>}
      {state?.message && <FormAlert tone="success">{state.message}</FormAlert>}

      <Panel title="Store">
        <div className="grid gap-4 sm:grid-cols-2">
          <AdminField label="Store name" error={err("storeName")} hint="Logo text, page titles and emails.">
            <input name="storeName" defaultValue={values.storeName} required maxLength={60} className={inputClass} />
          </AdminField>
          <AdminField label="Tagline" error={err("tagline")} hint="e.g. Fashion, accessories & lifestyle">
            <input name="tagline" defaultValue={values.tagline} maxLength={80} className={inputClass} />
          </AdminField>
          <AdminField label="Support email" error={err("supportEmail")}>
            <input name="supportEmail" type="email" defaultValue={values.supportEmail} maxLength={120} className={inputClass} />
          </AdminField>
          <AdminField label="Description in Google" error={err("metaDescription")} hint="Up to 170 characters" className="sm:col-span-2">
            <textarea name="metaDescription" defaultValue={values.metaDescription} rows={2} maxLength={170} className={textareaClass} />
          </AdminField>
        </div>
      </Panel>

      <Panel title="Shipping" description="Prices in AUD, including GST.">
        <div className="grid gap-4 sm:grid-cols-2">
          <AdminField label="Flat shipping rate ($)" error={err("flatShippingRate")} hint="Blank = free shipping on every order">
            <input name="flatShippingRate" defaultValue={values.flatShippingRate} inputMode="decimal" className={inputClass} />
          </AdminField>
          <AdminField label="Free shipping over ($)" error={err("freeShippingThreshold")} hint="Blank = no free-shipping offer">
            <input name="freeShippingThreshold" defaultValue={values.freeShippingThreshold} inputMode="decimal" className={inputClass} />
          </AdminField>
          <AdminField label="Delivery" error={err("deliveryInfo")} hint="“Delivery” section on product pages — one fact per line." className="sm:col-span-2">
            <textarea name="deliveryInfo" defaultValue={values.deliveryInfo} rows={3} maxLength={2000} className={textareaClass} />
          </AdminField>
          <AdminField label="Returns" error={err("returnsInfo")} hint="“Returns” section on product pages — one fact per line." className="sm:col-span-2">
            <textarea name="returnsInfo" defaultValue={values.returnsInfo} rows={3} maxLength={2000} className={textareaClass} />
          </AdminField>
        </div>
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
  );
}
