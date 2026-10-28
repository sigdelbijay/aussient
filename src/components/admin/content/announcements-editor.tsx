"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { newId, type AnnouncementsDoc } from "@/lib/content/docs";
import { AdminField, inputClass, Panel } from "../ui";
import { scheduleNote, ScheduleFields } from "./schedule-fields";
import { EditorMessages, ItemControls, move, PublishBar, ShopLinks, useContentDoc, VersionsPanel, type VersionItem } from "./use-content-doc";

type Item = AnnouncementsDoc["items"][number];

/** The scrolling bar at the top of every page: messages, optional links, start/end dates. */
export function AnnouncementsEditor({
  initial,
  hasDraft,
  versions,
  links,
  now,
}: {
  initial: AnnouncementsDoc;
  hasDraft: boolean;
  versions: VersionItem[];
  links: { label: string; url: string }[];
  now: string;
}) {
  const editor = useContentDoc("announcements", initial, hasDraft);
  const items = editor.doc.items;
  const setItems = (next: Item[]) => editor.setDoc({ items: next });
  const update = (i: number, change: Partial<Item>) => setItems(items.map((a, j) => (j === i ? { ...a, ...change } : a)));

  return (
    <div className="grid gap-4">
      <ShopLinks links={links} />
      <EditorMessages editor={editor} />
      <p className="text-xs text-muted-foreground">Automatic offers from Discounts are added to the front of the bar by themselves.</p>

      <ol className="grid gap-3">
        {items.map((a, i) => {
          const note = scheduleNote(a, now);
          return (
            <li key={a.id}>
              <Panel>
                <div className="grid gap-3">
                  <div className="flex items-start gap-2">
                    <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                      <AdminField label={`Message ${i + 1}`}>
                        <input value={a.text} maxLength={120} onChange={(e) => update(i, { text: e.target.value })} placeholder="e.g. Free shipping over $50" className={inputClass} />
                      </AdminField>
                      <AdminField label="Link (optional)">
                        <input value={a.link} list="shop-links" maxLength={300} onChange={(e) => update(i, { link: e.target.value })} placeholder="/sale" className={inputClass} />
                      </AdminField>
                    </div>
                    <ItemControls index={i} count={items.length} onMove={(to) => setItems(move(items, i, to))} onRemove={() => setItems(items.filter((_, j) => j !== i))} />
                  </div>
                  <ScheduleFields startsAt={a.startsAt} endsAt={a.endsAt} onChange={(when) => update(i, when)} />
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={a.active} onChange={(e) => update(i, { active: e.target.checked })} className="size-4 accent-brand-ink" />
                    Show this message
                    {note && <span className="rounded-full bg-muted px-2 py-0.5 text-[0.7rem] font-semibold">{note}</span>}
                  </label>
                </div>
              </Panel>
            </li>
          );
        })}
      </ol>

      <Button type="button" variant="outline" onClick={() => setItems([...items, { id: newId(), text: "", link: "", active: true, startsAt: "", endsAt: "" }])} className="h-10 w-fit gap-1.5 px-3">
        <Plus /> Add message
      </Button>

      <PublishBar editor={editor} previewPath="/" />
      <VersionsPanel versions={versions} onRestore={editor.restore} pending={editor.pending} />
    </div>
  );
}
