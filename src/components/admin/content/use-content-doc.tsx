"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Eye, History, Loader2, Trash2, Undo2 } from "lucide-react";
import { cn } from "cn";
import { FormAlert } from "@/components/auth/form-bits";
import { Button } from "@/components/ui/button";
import {
  discardDraftAction,
  publishAction,
  restoreVersionAction,
  saveDraftAction,
  type ContentState,
} from "@/lib/admin/content-actions";
import { Panel } from "../ui";

/**
 * Shared by every content editor (home page, menus, announcement bar, pop-ups,
 * pages): holds the document being edited and runs Save draft / Preview /
 * Publish / Discard / Restore.
 */
export function useContentDoc<T>(key: string, initial: T, initialHasDraft: boolean) {
  const router = useRouter();
  const [doc, setDocState] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [hasDraft, setHasDraft] = useState(initialHasDraft);
  const [state, setState] = useState<ContentState>(undefined);
  const [pending, start] = useTransition();

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const setDoc = (next: T | ((d: T) => T)) => {
    setDocState(next);
    setDirty(true);
  };

  function run(action: () => Promise<ContentState>, after?: (r: ContentState) => void) {
    start(async () => {
      let result: ContentState;
      try {
        result = await action();
      } catch {
        result = { error: "Couldn't reach the server — check your connection and try again. Your changes are still here." };
      }
      setState(result);
      if (!result?.error) {
        setDirty(false);
        if (result?.doc !== undefined) setDocState(result.doc as T);
        if (result?.hasDraft !== undefined) setHasDraft(result.hasDraft);
        after?.(result);
      }
      router.refresh(); // version list, draft badges
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  return {
    doc,
    setDoc,
    dirty,
    hasDraft,
    state,
    pending,
    saveDraft: () => run(() => saveDraftAction(key, doc)),
    publish: () => run(() => publishAction(key, doc)),
    discard: () => run(() => discardDraftAction(key)),
    restore: (versionId: string) => run(() => restoreVersionAction(versionId)),
    /** Saves the draft, then opens the shop in Preview in a new tab. */
    preview: (path: string) => {
      // Open the tab now (browsers block tabs opened after a wait), then point it at the preview.
      const tab = window.open("about:blank", "_blank");
      run(
        () => saveDraftAction(key, doc),
        () => {
          const url = `/api/preview?to=${encodeURIComponent(path)}`;
          // A full page load (not client navigation): the preview address is a route handler.
          if (tab) tab.location.href = url;
          else window.open(url, "_self");
        },
      );
    },
  };
}

type Editor = ReturnType<typeof useContentDoc<unknown>>;

/** Messages at the top of an editor: saved / published / problems to fix. */
export function EditorMessages({ editor }: { editor: Pick<Editor, "state"> }) {
  const { state } = editor;
  if (!state?.error && !state?.message) return null;
  return (
    <div className="grid gap-2">
      {state.error && (
        <FormAlert tone="error">
          {state.error}
          {state.problems && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-left">
              {state.problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
        </FormAlert>
      )}
      {state.message && <FormAlert tone="success">{state.message}</FormAlert>}
    </div>
  );
}

/** Sticky bar along the bottom: where things stand, and the Save draft / Preview / Publish buttons. */
export function PublishBar({ editor, previewPath }: { editor: Omit<Editor, "doc" | "setDoc">; previewPath: string }) {
  const { dirty, hasDraft, pending } = editor;
  const status = dirty ? "Unsaved changes" : hasDraft ? "Draft saved — not live yet" : "Everything is live";
  return (
    <div className="sticky bottom-0 z-30 -mx-4 mt-6 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:-mx-8 sm:px-8" style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("mr-auto flex items-center gap-2 text-sm", dirty || hasDraft ? "font-medium text-amber-700" : "text-muted-foreground")}>
          <span className={cn("size-2 rounded-full", dirty || hasDraft ? "bg-amber-500" : "bg-emerald-500")} />
          {status}
        </span>
        {hasDraft && !dirty && (
          <Button type="button" variant="ghost" disabled={pending} onClick={editor.discard} className="h-9 gap-1.5 px-3 text-muted-foreground">
            <Trash2 /> Discard draft
          </Button>
        )}
        <Button type="button" variant="outline" disabled={pending} onClick={editor.saveDraft} className="h-9 px-3">
          Save draft
        </Button>
        <Button type="button" variant="outline" disabled={pending} onClick={() => editor.preview(previewPath)} className="h-9 gap-1.5 px-3">
          <Eye /> Preview
        </Button>
        <Button type="button" disabled={pending} onClick={editor.publish} className="h-9 gap-1.5 px-4 font-semibold">
          {pending && <Loader2 className="animate-spin" />}
          Publish
        </Button>
      </div>
    </div>
  );
}

export type VersionItem = { id: string; createdAt: string; when: string; by: string | null };

/** The last few published versions; any older one can be put back live. */
export function VersionsPanel({ versions, onRestore, pending }: { versions: VersionItem[]; onRestore: (id: string) => void; pending: boolean }) {
  const [asking, setAsking] = useState<string | null>(null);
  return (
    <Panel title="Version history" description="The last few times this was published. Restore puts an older version back live.">
      {versions.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <History className="size-4" /> Nothing published from here yet.
        </p>
      ) : (
        <ol className="grid gap-2 text-sm">
          {versions.map((v, i) => (
            <li key={v.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-medium tabular-nums">{v.when}</span>
              <span className="text-xs text-muted-foreground">{v.by ?? "Before the first change"}</span>
              <span className="ml-auto">
                {i === 0 ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[0.7rem] font-semibold text-emerald-800">Live now</span>
                ) : asking === v.id ? (
                  <span className="flex items-center gap-1 text-xs">
                    Put this back live?
                    <button type="button" disabled={pending} onClick={() => { setAsking(null); onRestore(v.id); }} className="rounded bg-brand-ink px-1.5 py-0.5 font-semibold text-brand-paper">
                      Yes
                    </button>
                    <button type="button" onClick={() => setAsking(null)} className="rounded px-1.5 py-0.5 hover:bg-muted">
                      No
                    </button>
                  </span>
                ) : (
                  <button type="button" disabled={pending} onClick={() => setAsking(v.id)} className="flex items-center gap-1 rounded px-1.5 py-1 text-xs hover:bg-muted">
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

/** Move up / move down / remove buttons for one item in a list. */
export function ItemControls({ index, count, onMove, onRemove, removeLabel = "Remove" }: { index: number; count: number; onMove: (to: number) => void; onRemove: () => void; removeLabel?: string }) {
  const btn = "grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30";
  return (
    <span className="flex items-center">
      <button type="button" className={btn} disabled={index === 0} onClick={() => onMove(index - 1)} aria-label="Move up">
        <ArrowUp className="size-4" />
      </button>
      <button type="button" className={btn} disabled={index === count - 1} onClick={() => onMove(index + 1)} aria-label="Move down">
        <ArrowDown className="size-4" />
      </button>
      <button type="button" className={cn(btn, "hover:text-destructive")} onClick={onRemove} aria-label={removeLabel}>
        <Trash2 className="size-4" />
      </button>
    </span>
  );
}

/** A copy of the list with one item moved. */
export function move<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** All the shop's pages as suggestions for link boxes (<input list="shop-links">). */
export function ShopLinks({ links }: { links: { label: string; url: string }[] }) {
  return (
    <datalist id="shop-links">
      {links.map((l) => (
        <option key={l.url} value={l.url}>
          {l.label}
        </option>
      ))}
    </datalist>
  );
}
