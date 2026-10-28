"use client";

import { useTransition } from "react";
import { deletePageAction } from "@/lib/admin/content-actions";
import { plainText, cleanRichText } from "@/lib/content/rich-text";
import type { PageDoc } from "@/lib/content/docs";
import { DeleteButton } from "../media-manager";
import { AdminField, inputClass, Panel, textareaClass } from "../ui";
import { RichTextEditor } from "./rich-text-editor";
import {
  EditorMessages,
  PublishBar,
  useContentDoc,
  VersionsPanel,
  type VersionItem,
} from "./use-content-doc";

/** One shop page (About, FAQ, Shipping…): title, web address, text and Google details. */
export function PageEditor({
  pageId,
  initial,
  hasDraft,
  versions,
}: {
  pageId: string;
  initial: PageDoc;
  hasDraft: boolean;
  versions: VersionItem[];
}) {
  const editor = useContentDoc(`page:${pageId}`, initial, hasDraft);
  const { doc, setDoc } = editor;
  const [deleting, startDelete] = useTransition();
  const set = (change: Partial<PageDoc>) => setDoc({ ...doc, ...change });
  const summary = plainText(cleanRichText(doc.content)).slice(0, 160);

  return (
    // The publish bar sits in the outer box so it can stick to the bottom of the screen.
    <div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="grid content-start gap-6">
          <EditorMessages editor={editor} />
          <Panel>
            <div className="grid gap-4">
              <AdminField label="Title">
                <input
                  value={doc.title}
                  maxLength={100}
                  onChange={(e) => set({ title: e.target.value })}
                  className={inputClass}
                />
              </AdminField>
              <div className="grid gap-1.5">
                <span className="text-sm font-medium">Text</span>
                <RichTextEditor value={doc.content} onChange={(content) => set({ content })} />
              </div>
            </div>
          </Panel>

          <Panel
            title="In Google"
            description="Blank boxes use the title and the start of the text."
          >
            <div className="grid gap-4">
              <AdminField label="SEO title" hint={`${doc.seoTitle.length}/70`}>
                <input
                  value={doc.seoTitle}
                  maxLength={70}
                  placeholder={doc.title}
                  onChange={(e) => set({ seoTitle: e.target.value })}
                  className={inputClass}
                />
              </AdminField>
              <AdminField label="SEO description" hint={`${doc.seoDescription.length}/170`}>
                <textarea
                  value={doc.seoDescription}
                  rows={2}
                  maxLength={170}
                  placeholder={summary}
                  onChange={(e) => set({ seoDescription: e.target.value })}
                  className={textareaClass}
                />
              </AdminField>
            </div>
          </Panel>
        </div>

        <div className="grid content-start gap-6">
          <Panel title="Page">
            <div className="grid gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={doc.published}
                  onChange={(e) => set({ published: e.target.checked })}
                  className="size-4 accent-brand-ink"
                />
                Show on the shop
              </label>
              <AdminField
                label="Web address"
                hint="Changing it after publishing leaves a redirect from the old one."
              >
                <span className="flex items-center rounded-md border border-input text-sm">
                  <span className="pl-3 text-muted-foreground">/pages/</span>
                  <input
                    value={doc.slug}
                    maxLength={60}
                    onChange={(e) =>
                      set({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })
                    }
                    className="h-10 min-w-0 flex-1 bg-transparent pr-3 outline-none"
                    aria-label="Web address"
                  />
                </span>
              </AdminField>
              <DeleteButton
                label="Delete page"
                onConfirm={() => startDelete(async () => void (await deletePageAction(pageId)))}
              />
              {deleting && <span className="text-xs text-muted-foreground">Deleting…</span>}
            </div>
          </Panel>
          <VersionsPanel versions={versions} onRestore={editor.restore} pending={editor.pending} />
        </div>
      </div>
      <PublishBar editor={editor} previewPath={`/pages/${doc.slug}`} />
    </div>
  );
}
