"use client";

import { useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { fromShopInput, toShopInput } from "@/lib/admin/dates";
import { newId, type HomeDoc, type HomeSectionDoc } from "@/lib/content/docs";
import { SECTION_FIELDS, SECTION_LABELS, SHOWS_TITLE, blankConfig, type SectionField } from "@/lib/content/section-fields";
import type { SectionType } from "@/lib/home-sections";
import { AdminField, inputClass, Panel, textareaClass } from "../ui";
import { ImagePicker, UploadButton, type CloudinaryPublic } from "../upload-button";
import { scheduleNote, ScheduleFields } from "./schedule-fields";
import { EditorMessages, ItemControls, move, PublishBar, ShopLinks, useContentDoc, VersionsPanel, type VersionItem } from "./use-content-doc";

type Props = {
  initial: HomeDoc;
  hasDraft: boolean;
  versions: VersionItem[];
  cloudinary: CloudinaryPublic;
  collections: { slug: string; name: string }[];
  links: { label: string; url: string }[];
  /** Sydney time now, as "YYYY-MM-DDTHH:mm" (for the Scheduled / Ended notes). */
  now: string;
};

/** The home page: sections in order — add, edit, reorder, show/hide and remove. */
export function HomeEditor({ initial, hasDraft, versions, cloudinary, collections, links, now }: Props) {
  const editor = useContentDoc("home", initial, hasDraft);
  const { doc, setDoc } = editor;
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState<SectionType>("hero");

  const sections = doc.sections;
  const setSections = (next: HomeSectionDoc[]) => setDoc({ sections: next });
  const update = (id: string, change: Partial<HomeSectionDoc>) => setSections(sections.map((s) => (s.id === id ? { ...s, ...change } : s)));

  function add() {
    const section: HomeSectionDoc = { id: newId(), type: adding, title: "", active: true, startsAt: "", endsAt: "", config: blankConfig(adding) };
    setSections([...sections, section]);
    setOpen(section.id);
  }

  return (
    <div className="grid gap-4">
      <ShopLinks links={links} />
      <EditorMessages editor={editor} />

      <ol className="grid gap-3">
        {sections.map((s, i) => {
          const note = scheduleNote(s, now);
          const expanded = open === s.id;
          return (
            <li key={s.id} className={cn("rounded-xl border border-border bg-background", !s.active && "opacity-70")}>
              <div className="flex items-center gap-2 p-3">
                <button type="button" onClick={() => setOpen(expanded ? null : s.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-expanded={expanded}>
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold tabular-nums">{i + 1}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{s.title || headlineOf(s) || SECTION_LABELS[s.type]}</span>
                    <span className="block text-xs text-muted-foreground">{SECTION_LABELS[s.type]}</span>
                  </span>
                  {note && <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[0.7rem] font-semibold">{note}</span>}
                  <ChevronDown className={cn("ml-auto size-4 shrink-0 transition-transform", expanded && "rotate-180")} />
                </button>
                <label className="flex shrink-0 items-center gap-1.5 text-xs">
                  <input type="checkbox" checked={s.active} onChange={(e) => update(s.id, { active: e.target.checked })} className="size-4 accent-brand-ink" />
                  Show
                </label>
                <ItemControls index={i} count={sections.length} onMove={(to) => setSections(move(sections, i, to))} onRemove={() => setSections(sections.filter((x) => x.id !== s.id))} removeLabel="Remove section" />
              </div>

              {expanded && (
                <div className="grid gap-4 border-t border-border p-4">
                  {SHOWS_TITLE.has(s.type) && (
                    <AdminField label="Heading above the section">
                      <input value={s.title} maxLength={80} onChange={(e) => update(s.id, { title: e.target.value })} className={inputClass} />
                    </AdminField>
                  )}
                  <Fields fields={SECTION_FIELDS[s.type]} value={s.config} onChange={(config) => update(s.id, { config })} cloudinary={cloudinary} collections={collections} />
                  <ScheduleFields startsAt={s.startsAt} endsAt={s.endsAt} onChange={(when) => update(s.id, when)} />
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <Panel>
        <div className="flex flex-wrap items-end gap-2">
          <AdminField label="Add a section" className="min-w-0 flex-1 sm:max-w-xs">
            <select value={adding} onChange={(e) => setAdding(e.target.value as SectionType)} className={inputClass}>
              {(Object.keys(SECTION_LABELS) as SectionType[]).map((t) => (
                <option key={t} value={t}>
                  {SECTION_LABELS[t]}
                </option>
              ))}
            </select>
          </AdminField>
          <Button type="button" variant="outline" onClick={add} className="h-10 gap-1.5 px-3">
            <Plus /> Add
          </Button>
        </div>
      </Panel>

      <PublishBar editor={editor} previewPath="/" />
      <VersionsPanel versions={versions} onRestore={editor.restore} pending={editor.pending} />
    </div>
  );
}

/** A short name for a section in the list, from its headline. */
function headlineOf(s: HomeSectionDoc) {
  const c = s.config as Record<string, unknown>;
  return typeof c.headline === "string" ? c.headline : typeof c.heading === "string" ? c.heading : "";
}

type Config = Record<string, unknown>;

/** The boxes for one section's settings (or one item in a list, e.g. a gift card). */
function Fields({
  fields,
  value,
  onChange,
  cloudinary,
  collections,
}: {
  fields: SectionField[];
  value: Config;
  onChange: (next: Config) => void;
  cloudinary: CloudinaryPublic;
  collections: { slug: string; name: string }[];
}) {
  const set = (key: string, v: unknown) => onChange({ ...value, [key]: v });
  const text = (key: string) => (typeof value[key] === "string" ? (value[key] as string) : "");

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.map((f) => {
        const label = "required" in f && f.required ? `${f.label} *` : f.label;
        const hint = "hint" in f ? f.hint : undefined;
        switch (f.kind) {
          case "text":
          case "href":
            return (
              <AdminField key={f.key} label={label} hint={hint}>
                <input value={text(f.key)} onChange={(e) => set(f.key, e.target.value)} maxLength={300} list={f.kind === "href" ? "shop-links" : undefined} className={inputClass} />
              </AdminField>
            );
          case "textarea":
            return (
              <AdminField key={f.key} label={label} hint={hint} className="sm:col-span-2">
                <textarea value={text(f.key)} onChange={(e) => set(f.key, e.target.value)} rows={3} maxLength={1000} className={textareaClass} />
              </AdminField>
            );
          case "number":
            return (
              <AdminField key={f.key} label={f.label} hint={hint}>
                <input
                  type="number"
                  min={f.min}
                  max={f.max}
                  value={typeof value[f.key] === "number" ? (value[f.key] as number) : ""}
                  onChange={(e) => set(f.key, e.target.value === "" ? undefined : Number(e.target.value))}
                  className={inputClass}
                />
              </AdminField>
            );
          case "select":
            return (
              <AdminField key={f.key} label={f.label}>
                <select value={text(f.key) || f.options[0].value} onChange={(e) => set(f.key, e.target.value)} className={inputClass}>
                  {f.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </AdminField>
            );
          case "collection":
            return (
              <AdminField key={f.key} label={label} hint={hint}>
                <select value={text(f.key)} onChange={(e) => set(f.key, e.target.value)} className={inputClass}>
                  <option value="">Choose a collection…</option>
                  {collections.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </AdminField>
            );
          case "datetime": {
            const iso = text(f.key);
            const shown = iso && !Number.isNaN(Date.parse(iso)) ? toShopInput(new Date(iso)) : "";
            return (
              <AdminField key={f.key} label={label} hint={hint}>
                <input
                  type="datetime-local"
                  value={shown}
                  onChange={(e) => {
                    const d = fromShopInput(e.target.value);
                    set(f.key, d && !Number.isNaN(d.getTime()) ? d.toISOString() : "");
                  }}
                  className={inputClass}
                />
              </AdminField>
            );
          }
          case "image":
            return (
              <AdminField key={f.key} label={label} hint={hint}>
                <ImagePicker config={cloudinary} folder="content" value={text(f.key)} onChange={(url) => set(f.key, url)} />
              </AdminField>
            );
          case "video":
            return (
              <div key={f.key} className="grid content-start gap-1.5">
                <span className="text-sm font-medium">{f.label}</span>
                {text(f.key) && (
                  <span className="flex items-center gap-2 text-xs">
                    <video src={text(f.key)} muted playsInline className="h-16 rounded-md bg-muted" />
                    <button type="button" onClick={() => set(f.key, "")} className="text-muted-foreground underline hover:text-destructive">
                      Remove
                    </button>
                  </span>
                )}
                <UploadButton config={cloudinary} folder="content" multiple={false} label={text(f.key) ? "Replace video" : "Upload video"} onUploaded={(files) => set(f.key, files.find((x) => x.type === "VIDEO")?.url ?? text(f.key))} />
                {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
              </div>
            );
          case "link": {
            const link = (value[f.key] as { label?: string; href?: string } | undefined) ?? {};
            return (
              <fieldset key={f.key} className="grid gap-1.5">
                <legend className="mb-1.5 text-sm font-medium">{label}</legend>
                <div className="grid grid-cols-2 gap-2">
                  <input placeholder="Button text" aria-label={`${f.label} text`} value={link.label ?? ""} maxLength={40} onChange={(e) => set(f.key, { ...link, label: e.target.value })} className={inputClass} />
                  <input placeholder="Link, e.g. /sale" aria-label={`${f.label} link`} list="shop-links" value={link.href ?? ""} maxLength={300} onChange={(e) => set(f.key, { ...link, href: e.target.value })} className={inputClass} />
                </div>
                {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
              </fieldset>
            );
          }
          case "list": {
            const items = Array.isArray(value[f.key]) ? (value[f.key] as Config[]) : [];
            const setItems = (next: Config[]) => set(f.key, next);
            return (
              <fieldset key={f.key} className="grid gap-2 sm:col-span-2">
                <legend className="mb-1.5 text-sm font-medium">{f.label}</legend>
                {items.map((item, i) => (
                  <div key={i} className="rounded-lg border border-border p-3">
                    <div className="mb-2 flex items-center justify-between text-xs font-semibold text-muted-foreground">
                      {f.itemLabel} {i + 1}
                      <ItemControls index={i} count={items.length} onMove={(to) => setItems(move(items, i, to))} onRemove={() => setItems(items.filter((_, j) => j !== i))} />
                    </div>
                    <Fields fields={f.fields} value={item} onChange={(next) => setItems(items.map((x, j) => (j === i ? next : x)))} cloudinary={cloudinary} collections={collections} />
                  </div>
                ))}
                {items.length < f.max && (
                  <Button type="button" variant="outline" onClick={() => setItems([...items, {}])} className="h-9 w-fit gap-1.5 px-3">
                    <Plus /> Add {f.itemLabel.toLowerCase()}
                  </Button>
                )}
              </fieldset>
            );
          }
        }
      })}
    </div>
  );
}
