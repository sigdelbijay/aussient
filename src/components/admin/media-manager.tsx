"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, GripVertical, Trash2 } from "lucide-react";
import { cn } from "cn";
import { addMediaAction, deleteMediaAction, reorderMediaAction, updateMediaAction } from "@/lib/admin/product-actions";
import { inputClass } from "./ui";
import { UploadButton, type CloudinaryPublic } from "./upload-button";

type Media = { id: string; url: string; type: "IMAGE" | "VIDEO"; alt: string | null; optionValueId: string | null };

/**
 * Product photos & videos: drag (or use the arrows) to reorder, add alt text,
 * pick which option value a photo shows (e.g. the Navy photos), delete, and upload more.
 * The first photo is the main one on product cards; the second shows on hover.
 */
export function MediaManager({
  productId,
  media: initial,
  optionValues,
  cloudinary,
}: {
  productId: string;
  media: Media[];
  /** e.g. { id, label: "Colour: Navy" } */
  optionValues: { id: string; label: string }[];
  cloudinary: CloudinaryPublic;
}) {
  const router = useRouter();
  const [media, setMedia] = useState(initial);
  const [dragging, setDragging] = useState<string | null>(null);
  const [target, setTarget] = useState<string>(""); // option value new uploads belong to
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  /** Runs an action, then reloads the server data (or shows the problem). */
  function save(fn: () => Promise<unknown>) {
    setError(null);
    start(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong — reload and try again.");
      }
    });
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= media.length || from === to) return;
    const next = [...media];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setMedia(next); // instant; saved in the background
    save(() => reorderMediaAction(productId, next.map((m) => m.id)));
  }

  const valueName = (id: string | null) => optionValues.find((v) => v.id === id)?.label;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-3">
        {optionValues.length > 0 && (
          <label className="grid gap-1 text-xs font-medium">
            Upload as
            <select value={target} onChange={(e) => setTarget(e.target.value)} className={cn(inputClass, "h-9 w-52")}>
              <option value="">General photos</option>
              {optionValues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label} photos
                </option>
              ))}
            </select>
          </label>
        )}
        <UploadButton
          config={cloudinary}
          folder="products"
          label="Upload photos or videos"
          onUploaded={async (files) => {
            await addMediaAction(productId, files, target || null);
            router.refresh();
          }}
        />
        {pending && <span className="text-xs text-muted-foreground">Saving…</span>}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}

      {media.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          No photos yet. The first photo is the main one in the shop.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {media.map((m, i) => (
            <li
              key={m.id}
              draggable
              onDragStart={(e) => {
                setDragging(m.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragEnd={() => setDragging(null)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const from = media.findIndex((x) => x.id === dragging);
                if (from >= 0) move(from, i);
                setDragging(null);
              }}
              className={cn(
                "grid gap-2 rounded-lg border border-border bg-background p-2 transition-opacity",
                dragging === m.id && "opacity-40",
              )}
            >
              <div className="relative aspect-[4/5] cursor-grab overflow-hidden rounded-md bg-muted active:cursor-grabbing">
                {m.type === "VIDEO" ? (
                  <video src={m.url} muted playsInline preload="metadata" className="size-full object-cover" />
                ) : (
                  <Image src={m.url} alt={m.alt ?? ""} fill sizes="200px" className="object-cover" />
                )}
                <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded bg-background/90 px-1.5 py-0.5 text-[0.65rem] font-semibold">
                  <GripVertical className="size-3" />
                  {i === 0 ? "Main" : i === 1 ? "Hover" : `#${i + 1}`}
                  {m.type === "VIDEO" && " · Video"}
                </span>
                {m.optionValueId && (
                  <span className="absolute right-1.5 top-1.5 rounded bg-brand-ink px-1.5 py-0.5 text-[0.65rem] font-semibold text-brand-paper">
                    {valueName(m.optionValueId)}
                  </span>
                )}
              </div>

              <input
                defaultValue={m.alt ?? ""}
                placeholder="Alt text (describe the photo)"
                aria-label="Alt text"
                maxLength={200}
                onBlur={(e) => {
                  const alt = e.target.value.trim();
                  if (alt !== (m.alt ?? "")) save(() => updateMediaAction(m.id, { alt }));
                }}
                className={cn(inputClass, "h-8 text-xs")}
              />

              {optionValues.length > 0 && (
                <select
                  defaultValue={m.optionValueId ?? ""}
                  aria-label="Shown for option value"
                  onChange={(e) => save(() => updateMediaAction(m.id, { optionValueId: e.target.value || null }))}
                  className={cn(inputClass, "h-8 text-xs")}
                >
                  <option value="">General (always shown)</option>
                  {optionValues.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label} only
                    </option>
                  ))}
                </select>
              )}

              <div className="flex items-center justify-between">
                <div className="flex">
                  <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label="Move earlier" className="grid size-7 place-items-center rounded hover:bg-muted disabled:opacity-30">
                    <ChevronLeft className="size-4" />
                  </button>
                  <button type="button" onClick={() => move(i, i + 1)} disabled={i === media.length - 1} aria-label="Move later" className="grid size-7 place-items-center rounded hover:bg-muted disabled:opacity-30">
                    <ChevronRight className="size-4" />
                  </button>
                </div>
                <DeleteButton
                  onConfirm={() => {
                    setMedia((all) => all.filter((x) => x.id !== m.id));
                    save(() => deleteMediaAction(m.id));
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Two-step delete (no browser pop-up): "Delete" → "Delete? Yes / No". */
export function DeleteButton({ onConfirm, label = "Delete" }: { onConfirm: () => void; label?: string }) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button type="button" onClick={() => setAsking(true)} className="flex items-center gap-1 rounded px-1.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-destructive">
        <Trash2 className="size-3.5" />
        {label}
      </button>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs">
      Sure?
      <button type="button" onClick={onConfirm} className="rounded bg-destructive px-1.5 py-0.5 font-semibold text-white">
        Yes
      </button>
      <button type="button" onClick={() => setAsking(false)} className="rounded px-1.5 py-0.5 hover:bg-muted">
        No
      </button>
    </span>
  );
}
