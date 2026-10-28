"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { newId, type PopupsDoc } from "@/lib/content/docs";
import { AdminField, inputClass, Panel, textareaClass } from "../ui";
import { ImagePicker, type CloudinaryPublic } from "../upload-button";
import { scheduleNote, ScheduleFields } from "./schedule-fields";
import { EditorMessages, ItemControls, move, PublishBar, ShopLinks, useContentDoc, VersionsPanel, type VersionItem } from "./use-content-doc";

type Item = PopupsDoc["items"][number];

/**
 * Pop-ups: a newsletter signup or a sale message, shown once to each visitor
 * a few seconds after they arrive. If several are showing, the first one wins.
 */
export function PopupsEditor({
  initial,
  hasDraft,
  versions,
  cloudinary,
  links,
  now,
}: {
  initial: PopupsDoc;
  hasDraft: boolean;
  versions: VersionItem[];
  cloudinary: CloudinaryPublic;
  links: { label: string; url: string }[];
  now: string;
}) {
  const editor = useContentDoc("popups", initial, hasDraft);
  const items = editor.doc.items;
  const setItems = (next: Item[]) => editor.setDoc({ items: next });
  const update = (i: number, change: Partial<Item>) => setItems(items.map((p, j) => (j === i ? { ...p, ...change } : p)));

  function add() {
    setItems([
      ...items,
      { id: newId(), kind: "newsletter", title: "Get 10% off your first order", body: "Join the list for early access to new drops and sales.", image: "", buttonLabel: "", buttonLink: "", delaySeconds: 5, active: false, startsAt: "", endsAt: "" },
    ]);
  }

  return (
    <div className="grid gap-4">
      <ShopLinks links={links} />
      <EditorMessages editor={editor} />
      <p className="text-xs text-muted-foreground">Each visitor sees a pop-up once. If more than one is showing, the first in this list is used.</p>

      <ol className="grid gap-3">
        {items.map((p, i) => {
          const note = scheduleNote(p, now);
          return (
            <li key={p.id}>
              <Panel
                title={`${i + 1}. ${p.title || "Pop-up"}`}
                description={note ?? "Showing"}
                actions={<ItemControls index={i} count={items.length} onMove={(to) => setItems(move(items, i, to))} onRemove={() => setItems(items.filter((_, j) => j !== i))} />}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <AdminField label="Type">
                    <select value={p.kind} onChange={(e) => update(i, { kind: e.target.value as Item["kind"] })} className={inputClass}>
                      <option value="newsletter">Newsletter signup (email box)</option>
                      <option value="sale">Sale / message (button)</option>
                    </select>
                  </AdminField>
                  <AdminField label="Show after (seconds)" hint="How long after a page opens">
                    <input type="number" min={0} max={120} value={p.delaySeconds} onChange={(e) => update(i, { delaySeconds: Math.max(0, Math.min(120, Math.round(Number(e.target.value) || 0))) })} className={inputClass} />
                  </AdminField>
                  <AdminField label="Heading" className="sm:col-span-2">
                    <input value={p.title} maxLength={80} onChange={(e) => update(i, { title: e.target.value })} className={inputClass} />
                  </AdminField>
                  <AdminField label="Text" className="sm:col-span-2">
                    <textarea value={p.body} rows={2} maxLength={400} onChange={(e) => update(i, { body: e.target.value })} className={textareaClass} />
                  </AdminField>
                  <AdminField label="Picture (optional)" className="sm:col-span-2">
                    <ImagePicker config={cloudinary} folder="content" value={p.image} onChange={(image) => update(i, { image })} />
                  </AdminField>
                  {p.kind === "sale" && (
                    <>
                      <AdminField label="Button text">
                        <input value={p.buttonLabel} maxLength={30} onChange={(e) => update(i, { buttonLabel: e.target.value })} placeholder="Shop the sale" className={inputClass} />
                      </AdminField>
                      <AdminField label="Button link">
                        <input value={p.buttonLink} list="shop-links" maxLength={300} onChange={(e) => update(i, { buttonLink: e.target.value })} placeholder="/sale" className={inputClass} />
                      </AdminField>
                    </>
                  )}
                  <div className="sm:col-span-2">
                    <ScheduleFields startsAt={p.startsAt} endsAt={p.endsAt} onChange={(when) => update(i, when)} />
                  </div>
                  <label className="flex items-center gap-2 text-sm sm:col-span-2">
                    <input type="checkbox" checked={p.active} onChange={(e) => update(i, { active: e.target.checked })} className="size-4 accent-brand-ink" />
                    Switched on
                  </label>
                </div>
              </Panel>
            </li>
          );
        })}
      </ol>

      <Button type="button" variant="outline" onClick={add} className="h-10 w-fit gap-1.5 px-3">
        <Plus /> Add pop-up
      </Button>

      <PublishBar editor={editor} previewPath="/" />
      <VersionsPanel versions={versions} onRestore={editor.restore} pending={editor.pending} />
    </div>
  );
}
