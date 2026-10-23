"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, GripVertical, Loader2, Plus } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  deleteCategoryAction,
  reorderCategoriesAction,
  saveCategoryAction,
} from "@/lib/admin/catalog-actions";
import { MAX_CATEGORY_DEPTH } from "@/lib/category-tree";
import { DeleteButton } from "./media-manager";
import { AdminField, inputClass } from "./ui";
import { UploadButton, type CloudinaryPublic } from "./upload-button";
import { useAdminForm } from "./use-admin-form";

type Category = {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  parentId: string | null;
  /** 0 = top level. */
  depth: number;
  products: number;
};

/**
 * Category tree (parents followed by the categories inside them): drag or use
 * the arrows to reorder within a level, edit inline, add new.
 */
export function CategoriesEditor({
  categories: initial,
  cloudinary,
}: {
  categories: Category[];
  cloudinary: CloudinaryPublic;
}) {
  const router = useRouter();
  const [categories, setCategories] = useState(initial);
  const [dragging, setDragging] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function run(fn: () => Promise<unknown>) {
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

  /** Same-level neighbours of a category, in order. */
  const siblings = (c: Category) => categories.filter((x) => x.parentId === c.parentId);

  /** Swaps a category (with everything inside it) with the sibling at position `to`. */
  function move(c: Category, to: number) {
    const level = siblings(c);
    const from = level.indexOf(c);
    if (to < 0 || to >= level.length || from === to) return;
    const reordered = [...level];
    reordered.splice(from, 1);
    reordered.splice(to, 0, c);
    // Rebuild the tree order: each parent followed by its children.
    const ordered: Category[] = [];
    const visit = (parentId: string | null) => {
      const kids =
        parentId === c.parentId ? reordered : categories.filter((x) => x.parentId === parentId);
      for (const k of kids) {
        ordered.push(k);
        visit(k.id);
      }
    };
    visit(null);
    setCategories(ordered);
    run(() => reorderCategoriesAction(ordered.map((x) => x.id)));
  }

  return (
    <div className="grid gap-4">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <ul className="grid gap-2">
        {categories.map((c) => {
          const level = siblings(c);
          const i = level.indexOf(c);
          return (
            <li
              key={c.id}
              draggable={editing !== c.id}
              onDragStart={() => setDragging(c.id)}
              onDragEnd={() => setDragging(null)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                // Dropping only reorders within the same level.
                const dragged = categories.find((x) => x.id === dragging);
                if (dragged && dragged.parentId === c.parentId) move(dragged, i);
                setDragging(null);
              }}
              style={{ marginLeft: `${c.depth * 1.5}rem` }}
              className={cn(
                "rounded-xl border border-border bg-background",
                dragging === c.id && "opacity-40",
              )}
            >
              <div className="flex items-center gap-3 p-3">
                <GripVertical
                  className="size-4 shrink-0 cursor-grab text-muted-foreground"
                  aria-hidden
                />
                <div className="relative size-12 shrink-0 overflow-hidden rounded-md bg-muted">
                  {c.image && (
                    <Image src={c.image} alt="" fill sizes="48px" className="object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    /collections/{c.slug} ·{" "}
                    <Link
                      href={`/admin/products?q=${encodeURIComponent(c.name)}`}
                      className="underline"
                    >
                      {c.products} products
                    </Link>
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => move(c, i - 1)}
                    disabled={i === 0}
                    aria-label={`Move ${c.name} up`}
                    className="grid size-8 place-items-center rounded hover:bg-muted disabled:opacity-30"
                  >
                    <ArrowUp className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(c, i + 1)}
                    disabled={i === level.length - 1}
                    aria-label={`Move ${c.name} down`}
                    className="grid size-8 place-items-center rounded hover:bg-muted disabled:opacity-30"
                  >
                    <ArrowDown className="size-4" />
                  </button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditing(editing === c.id ? null : c.id)}
                    aria-expanded={editing === c.id}
                  >
                    {editing === c.id ? "Close" : "Edit"}
                  </Button>
                </div>
              </div>
              {editing === c.id && (
                <div className="border-t border-border p-4">
                  <CategoryForm
                    category={c}
                    categories={categories}
                    cloudinary={cloudinary}
                    onSaved={() => router.refresh()}
                  />
                  <div className="mt-3 flex justify-end">
                    <DeleteButton
                      label="Delete category"
                      onConfirm={() =>
                        run(async () => {
                          const res = await deleteCategoryAction(c.id);
                          if (res.error) throw new Error(res.error);
                        })
                      }
                    />
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {pending && <p className="text-xs text-muted-foreground">Saving…</p>}

      <div className="rounded-xl border border-dashed border-border bg-background p-4">
        <h2 className="mb-3 flex items-center gap-2 font-heading font-bold">
          <Plus className="size-4" /> Add a category
        </h2>
        <CategoryForm
          key={categories.length}
          categories={categories}
          cloudinary={cloudinary}
          onSaved={() => router.refresh()}
        />
      </div>
    </div>
  );
}

function CategoryForm({
  category,
  categories,
  cloudinary,
  onSaved,
}: {
  category?: Category;
  categories: Category[];
  cloudinary: CloudinaryPublic;
  onSaved: () => void;
}) {
  const { state, onSubmit, pending } = useAdminForm(async (prev, data) => {
    const result = await saveCategoryAction(prev, data);
    if (result?.message) onSaved();
    return result;
  });
  const [image, setImage] = useState(category?.image ?? "");
  const err = state?.fieldErrors ?? {};

  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-start">
      {category && <input type="hidden" name="id" value={category.id} />}
      <input type="hidden" name="image" value={image} />
      <AdminField label="Name" error={err.name}>
        <input
          name="name"
          defaultValue={category?.name}
          required
          maxLength={60}
          className={inputClass}
        />
      </AdminField>
      <AdminField label="Web address" error={err.slug} hint="Blank = made from the name">
        <input name="slug" defaultValue={category?.slug} maxLength={60} className={inputClass} />
      </AdminField>
      <AdminField label="Inside" error={err.parentId} hint={`Up to ${MAX_CATEGORY_DEPTH} levels`}>
        <select name="parentId" defaultValue={category?.parentId ?? ""} className={inputClass}>
          <option value="">— Top level —</option>
          {/* Only categories that leave room for another level (the server checks too). */}
          {categories
            .filter((p) => p.depth < MAX_CATEGORY_DEPTH - 1 && p.id !== category?.id)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {"– ".repeat(p.depth)}
                {p.name}
              </option>
            ))}
        </select>
      </AdminField>
      <div className="grid gap-1.5">
        <span className="text-sm font-medium">Image</span>
        <div className="flex items-center gap-2">
          {image && (
            <div className="relative size-10 overflow-hidden rounded bg-muted">
              <Image src={image} alt="" fill sizes="40px" className="object-cover" />
            </div>
          )}
          <UploadButton
            config={cloudinary}
            folder="categories"
            accept="image"
            multiple={false}
            label={image ? "Replace" : "Upload"}
            onUploaded={(files) => setImage(files[0].url)}
          />
        </div>
        {err.image && <span className="text-xs text-destructive">{err.image}</span>}
      </div>
      <div className="flex items-center gap-3 sm:col-span-4">
        <Button type="submit" disabled={pending} className="h-10 px-5 font-semibold">
          {pending && <Loader2 className="animate-spin" />}
          {category ? "Save" : "Add category"}
        </Button>
        {state?.message && <span className="text-sm text-emerald-700">{state.message}</span>}
        {state?.error && !state.fieldErrors && (
          <span className="text-sm text-destructive">{state.error}</span>
        )}
      </div>
    </form>
  );
}
