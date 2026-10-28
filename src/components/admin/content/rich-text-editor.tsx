"use client";

import { useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Heading2, Heading3, Italic, Link2, List, ListOrdered, Minus, Quote, Redo2, Underline, Undo2 } from "lucide-react";
import { cn } from "cn";
import { safeHref } from "@/lib/content/rich-text";
import { inputClass } from "../ui";

/**
 * A simple word-processor box for shop pages (Tiptap). It produces Tiptap's
 * JSON document; the server cleans it (cleanRichText) and the shop shows it
 * with <RichText>.
 */
export function RichTextEditor({ value, onChange }: { value: unknown; onChange: (doc: unknown) => void }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        codeBlock: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: "https", isAllowedUri: (url) => safeHref(url) !== null },
      }),
    ],
    content: value as object,
    immediatelyRender: false, // the page is rendered on the server first
    shouldRerenderOnTransaction: true, // keeps the toolbar's "on" states current
    editorProps: { attributes: { class: "rich-text min-h-72 px-4 py-3 outline-none", "aria-label": "Page text" } },
    // Copied as plain JSON: some of Tiptap's objects aren't plain, and React won't send those to the server.
    onUpdate: ({ editor }) => onChange(JSON.parse(JSON.stringify(editor.getJSON()))),
  });

  return (
    <div className="overflow-hidden rounded-md border border-input bg-background focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/40">
      {editor ? <Toolbar editor={editor} /> : <div className="h-11 border-b border-border bg-muted/40" />}
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const [linking, setLinking] = useState<string | null>(null);
  const chain = () => editor.chain().focus();
  const tools = [
    { label: "Bold", icon: Bold, on: editor.isActive("bold"), run: () => chain().toggleBold().run() },
    { label: "Italic", icon: Italic, on: editor.isActive("italic"), run: () => chain().toggleItalic().run() },
    { label: "Underline", icon: Underline, on: editor.isActive("underline"), run: () => chain().toggleUnderline().run() },
    { label: "Heading", icon: Heading2, on: editor.isActive("heading", { level: 2 }), run: () => chain().toggleHeading({ level: 2 }).run() },
    { label: "Smaller heading", icon: Heading3, on: editor.isActive("heading", { level: 3 }), run: () => chain().toggleHeading({ level: 3 }).run() },
    { label: "Bullet list", icon: List, on: editor.isActive("bulletList"), run: () => chain().toggleBulletList().run() },
    { label: "Numbered list", icon: ListOrdered, on: editor.isActive("orderedList"), run: () => chain().toggleOrderedList().run() },
    { label: "Quote", icon: Quote, on: editor.isActive("blockquote"), run: () => chain().toggleBlockquote().run() },
    { label: "Divider line", icon: Minus, on: false, run: () => chain().setHorizontalRule().run() },
    { label: "Link", icon: Link2, on: editor.isActive("link"), run: () => setLinking(editor.getAttributes("link").href ?? "") },
    { label: "Undo", icon: Undo2, on: false, run: () => chain().undo().run() },
    { label: "Redo", icon: Redo2, on: false, run: () => chain().redo().run() },
  ];

  function applyLink() {
    const href = safeHref(linking ?? "");
    if (href) chain().extendMarkRange("link").setLink({ href }).run();
    else chain().extendMarkRange("link").unsetLink().run();
    setLinking(null);
  }

  return (
    <div className="border-b border-border bg-muted/40">
      <div className="flex flex-wrap gap-0.5 p-1" role="toolbar" aria-label="Formatting">
        {tools.map(({ label, icon: Icon, on, run }) => (
          <button
            key={label}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={on}
            onMouseDown={(e) => e.preventDefault()} // keep the text selected
            onClick={run}
            className={cn("grid size-9 place-items-center rounded-md hover:bg-background", on && "bg-background text-brand-accent shadow-xs")}
          >
            <Icon className="size-4" />
          </button>
        ))}
      </div>
      {linking !== null && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border p-2">
          <input
            autoFocus
            value={linking}
            onChange={(e) => setLinking(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyLink();
              }
              if (e.key === "Escape") setLinking(null);
            }}
            placeholder="/pages/returns, https://… or mailto:hello@…"
            aria-label="Link address"
            className={cn(inputClass, "h-9 min-w-0 flex-1")}
          />
          <button type="button" onClick={applyLink} className="h-9 rounded-md bg-brand-ink px-3 text-sm font-semibold text-brand-paper">
            {linking ? "Apply" : "Remove link"}
          </button>
          <button type="button" onClick={() => setLinking(null)} className="h-9 rounded-md px-3 text-sm hover:bg-background">
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
