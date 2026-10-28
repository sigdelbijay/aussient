"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { LINK_TYPES, newId, type LinkType, type MenuDoc, type MenuLinkDoc } from "@/lib/content/docs";
import { inputClass, Panel } from "../ui";
import { ImagePicker, type CloudinaryPublic } from "../upload-button";
import { EditorMessages, ItemControls, move, PublishBar, ShopLinks, useContentDoc, VersionsPanel, type VersionItem } from "./use-content-doc";

export type LinkTargets = Record<Exclude<LinkType, "url">, { id: string; name: string }[]>;
type Link = Omit<MenuLinkDoc, "children">;

const blankLink = (linkType: LinkType): Link => ({ id: newId(), label: "", linkType, targetId: "", url: "", image: "" });

/**
 * Header and footer menus. Each link points at a category, collection, brand,
 * page or custom link. In the header, a link to a category lists its
 * sub-categories in the drop-down (mega) menu automatically; extra links can
 * be added under it, and each can have a promo picture. In the footer, each
 * top item is a column heading with its links under it.
 */
export function MenuEditor({
  initial,
  hasDraft,
  versions,
  cloudinary,
  targets,
  links,
}: {
  initial: MenuDoc;
  hasDraft: boolean;
  versions: VersionItem[];
  cloudinary: CloudinaryPublic;
  targets: LinkTargets;
  links: { label: string; url: string }[];
}) {
  const editor = useContentDoc("menu", initial, hasDraft);
  const { doc, setDoc } = editor;
  const [where, setWhere] = useState<"header" | "footer">("header");
  const list = doc[where];
  const setList = (next: MenuLinkDoc[]) => setDoc({ ...doc, [where]: next });
  const setItem = (i: number, next: MenuLinkDoc) => setList(list.map((l, j) => (j === i ? next : l)));

  return (
    <div className="grid gap-4">
      <ShopLinks links={links} />
      <EditorMessages editor={editor} />

      <div role="tablist" className="flex gap-1 text-sm">
        {(["header", "footer"] as const).map((w) => (
          <button
            key={w}
            type="button"
            role="tab"
            aria-selected={where === w}
            onClick={() => setWhere(w)}
            className={cn("rounded-full px-4 py-1.5 font-medium", where === w ? "bg-brand-ink text-brand-paper" : "hover:bg-muted")}
          >
            {w === "header" ? "Header" : "Footer"} ({doc[w].length})
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {where === "header"
          ? "Links across the top of every page. A link to a category shows its sub-categories in the drop-down; add a promo picture to show one beside them."
          : "Each item is a column heading in the footer, with its links under it."}
      </p>

      <ol className="grid gap-3">
        {list.map((item, i) => (
          <li key={item.id}>
            <Panel>
              <div className="grid gap-3">
                <div className="flex items-start gap-2">
                  <span className="mt-2 text-xs font-semibold text-muted-foreground tabular-nums">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <LinkRow link={item} onChange={(l) => setItem(i, { ...item, ...l })} targets={targets} optional={where === "footer"} labelPlaceholder={where === "footer" ? "Column heading, e.g. Help" : "Label, e.g. Watches"} />
                  </div>
                  <ItemControls index={i} count={list.length} onMove={(to) => setList(move(list, i, to))} onRemove={() => setList(list.filter((_, j) => j !== i))} />
                </div>

                {where === "header" && (
                  <div className="grid gap-1.5 pl-5">
                    <span className="text-xs font-medium">Promo picture in the drop-down</span>
                    <ImagePicker config={cloudinary} folder="content" value={item.image} onChange={(image) => setItem(i, { ...item, image })} />
                    {item.linkType === "category" && !item.image && <span className="text-xs text-muted-foreground">Blank = the category’s own picture.</span>}
                  </div>
                )}

                <div className="grid gap-2 border-l-2 border-border pl-4 sm:ml-5">
                  <span className="text-xs font-medium text-muted-foreground">
                    {where === "header" ? (item.linkType === "category" ? "Extra links in the drop-down (sub-categories are added for you)" : "Links in the drop-down") : "Links in this column"}
                  </span>
                  {item.children.map((child, ci) => (
                    <div key={child.id} className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <LinkRow
                          link={child}
                          onChange={(l) => setItem(i, { ...item, children: item.children.map((c, j) => (j === ci ? { ...c, ...l } : c)) })}
                          targets={targets}
                          labelPlaceholder="Label"
                        />
                      </div>
                      <ItemControls
                        index={ci}
                        count={item.children.length}
                        onMove={(to) => setItem(i, { ...item, children: move(item.children, ci, to) })}
                        onRemove={() => setItem(i, { ...item, children: item.children.filter((_, j) => j !== ci) })}
                      />
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setItem(i, { ...item, children: [...item.children, blankLink("page")] })}
                    className="h-8 w-fit gap-1.5 px-2 text-xs"
                  >
                    <Plus className="size-3.5" /> Add link
                  </Button>
                </div>
              </div>
            </Panel>
          </li>
        ))}
      </ol>

      <Button type="button" variant="outline" onClick={() => setList([...list, { ...blankLink(where === "footer" ? "url" : "category"), children: [] }])} className="h-10 w-fit gap-1.5 px-3">
        <Plus /> {where === "header" ? "Add header link" : "Add footer column"}
      </Button>

      <PublishBar editor={editor} previewPath="/" />
      <VersionsPanel versions={versions} onRestore={editor.restore} pending={editor.pending} />
    </div>
  );
}

/** Label + what it links to (a category, collection, brand, page or custom link). */
function LinkRow({
  link,
  onChange,
  targets,
  optional = false,
  labelPlaceholder,
}: {
  link: Link;
  onChange: (next: Partial<Link>) => void;
  targets: LinkTargets;
  /** Footer column headings don't have to link anywhere. */
  optional?: boolean;
  labelPlaceholder: string;
}) {
  // "Jewellery › Earrings" → "Earrings"; "About (hidden)" → "About".
  const nameOf = (type: Exclude<LinkType, "url">, id: string) =>
    targets[type].find((t) => t.id === id)?.name.split(" › ").at(-1)?.replace(/ \(hidden\)$/, "") ?? "";
  return (
    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_9rem_minmax(0,1.3fr)]">
      <input aria-label="Label" placeholder={labelPlaceholder} value={link.label} maxLength={60} onChange={(e) => onChange({ label: e.target.value })} className={inputClass} />
      <select aria-label="Links to a" value={link.linkType} onChange={(e) => onChange({ linkType: e.target.value as LinkType, targetId: "" })} className={inputClass}>
        {(Object.keys(LINK_TYPES) as LinkType[]).map((t) => (
          <option key={t} value={t}>
            {t === "url" && optional ? "Custom link / none" : LINK_TYPES[t]}
          </option>
        ))}
      </select>
      {link.linkType === "url" ? (
        <input aria-label="Link" placeholder={optional ? "Blank = just a heading" : "/sale or https://…"} list="shop-links" value={link.url} maxLength={300} onChange={(e) => onChange({ url: e.target.value })} className={inputClass} />
      ) : (
        <select
          aria-label={LINK_TYPES[link.linkType]}
          value={link.targetId}
          // Picking a target fills in a blank label with its name.
          onChange={(e) => onChange({ targetId: e.target.value, label: link.label || nameOf(link.linkType as Exclude<LinkType, "url">, e.target.value) })}
          className={inputClass}
        >
          <option value="">Choose…</option>
          {targets[link.linkType].map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
