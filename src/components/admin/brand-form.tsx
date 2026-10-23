"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { FormAlert } from "@/components/auth/form-bits";
import { Button } from "@/components/ui/button";
import { deleteBrandAction, saveBrandAction } from "@/lib/admin/collection-actions";
import { DeleteButton } from "./media-manager";
import { AdminField, inputClass, Panel, textareaClass } from "./ui";
import { ImagePicker, type CloudinaryPublic } from "./upload-button";
import { useAdminForm } from "./use-admin-form";

export type BrandValues = { id: string | null; name: string; slug: string; logo: string; description: string };

/** Add / edit a brand: name, web address (/brands/…), logo and description. */
export function BrandForm({ values, cloudinary, productCount }: { values: BrandValues; cloudinary: CloudinaryPublic; productCount: number }) {
  const { state, onSubmit, pending } = useAdminForm(saveBrandAction);
  const [logo, setLogo] = useState(values.logo);
  const [deleting, startDelete] = useTransition();
  const err = (k: string) => state?.fieldErrors?.[k];

  return (
    <form onSubmit={onSubmit} className="grid max-w-3xl gap-6">
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <input type="hidden" name="logo" value={logo} />
      {state?.error && <FormAlert tone="error">{state.error}</FormAlert>}
      {state?.message && <FormAlert tone="success">{state.message}</FormAlert>}

      <Panel>
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <AdminField label="Name" error={err("name")}>
              <input name="name" defaultValue={values.name} required maxLength={60} className={inputClass} aria-invalid={!!err("name")} />
            </AdminField>
            <AdminField label="Web address" error={err("slug")} hint={`/brands/${values.slug || "…"} — blank = made from the name`}>
              <input name="slug" defaultValue={values.slug} maxLength={60} className={inputClass} />
            </AdminField>
          </div>
          <div className="grid gap-1.5">
            <span className="text-sm font-medium">Logo</span>
            <ImagePicker config={cloudinary} folder="brands" value={logo} onChange={setLogo} />
            {err("logo") && <span className="text-xs text-destructive">{err("logo")}</span>}
          </div>
          <AdminField label="Description" hint="Shown at the top of the brand's page.">
            <textarea name="description" defaultValue={values.description} rows={4} maxLength={2000} className={textareaClass} />
          </AdminField>
        </div>
      </Panel>

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" size="lg" disabled={pending} className="h-11 px-6 font-semibold">
          {pending && <Loader2 className="animate-spin" />}
          {values.id ? "Save brand" : "Create brand"}
        </Button>
        {values.id && (
          <div className="grid gap-1">
            <DeleteButton label="Delete brand" onConfirm={() => startDelete(() => deleteBrandAction(values.id!))} />
            {productCount > 0 && <p className="text-xs text-muted-foreground">Its {productCount} products are kept, without a brand.</p>}
            {deleting && <Loader2 className="size-4 animate-spin" />}
          </div>
        )}
      </div>
    </form>
  );
}
