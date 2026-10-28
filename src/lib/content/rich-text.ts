/**
 * Rich text for shop pages (About, FAQ, …), as written by the Tiptap editor in
 * the admin. It's stored as Tiptap's JSON document, not HTML, and shown by
 * <RichText> (src/components/rich-text.tsx), which only knows the node types
 * below — so nothing typed or pasted into the editor can run code on the shop.
 */

export type RichMark = { type: "bold" | "italic" | "underline" | "strike" | "code" } | { type: "link"; attrs: { href: string } };

export type RichNode =
  | { type: "text"; text: string; marks?: RichMark[] }
  | { type: "hardBreak" | "horizontalRule" }
  | { type: "heading"; attrs: { level: 2 | 3 | 4 }; content?: RichNode[] }
  | { type: "paragraph" | "bulletList" | "orderedList" | "listItem" | "blockquote"; content?: RichNode[] };

export type RichDoc = { type: "doc"; content: RichNode[] };

export const emptyDoc = (): RichDoc => ({ type: "doc", content: [{ type: "paragraph" }] });

/** Links may go to a shop page, a website, an email address or a phone number. */
export function safeHref(href: unknown): string | null {
  if (typeof href !== "string") return null;
  const h = href.trim();
  if (h.length === 0 || h.length > 500) return null;
  if (h.startsWith("/") && !h.startsWith("//") && !h.startsWith("/\\")) return h;
  if (h.startsWith("#")) return h;
  return /^(https?:\/\/|mailto:|tel:)/i.test(h) ? h : null;
}

const BLOCKS = new Set(["paragraph", "bulletList", "orderedList", "listItem", "blockquote"]);
const SIMPLE_MARKS = new Set(["bold", "italic", "underline", "strike", "code"]);
const MAX_NODES = 5000;

/**
 * Keeps only what <RichText> can show: known node types and marks, safe links,
 * headings 2–4. Anything else is dropped. Returns null if it isn't a document.
 */
export function cleanRichText(input: unknown): RichDoc | null {
  if (!input || typeof input !== "object" || (input as { type?: unknown }).type !== "doc") return null;
  let budget = MAX_NODES;

  function marks(raw: unknown): RichMark[] | undefined {
    if (!Array.isArray(raw)) return undefined;
    const out: RichMark[] = [];
    for (const m of raw) {
      const type = (m as { type?: unknown })?.type;
      if (typeof type === "string" && SIMPLE_MARKS.has(type)) out.push({ type } as RichMark);
      if (type === "link") {
        const href = safeHref((m as { attrs?: { href?: unknown } }).attrs?.href);
        if (href) out.push({ type: "link", attrs: { href } });
      }
    }
    return out.length ? out : undefined;
  }

  function nodes(raw: unknown, depth: number): RichNode[] | undefined {
    if (!Array.isArray(raw) || depth > 12) return undefined;
    const out: RichNode[] = [];
    for (const n of raw) {
      if (--budget < 0) break;
      const node = n as { type?: unknown; text?: unknown; content?: unknown; marks?: unknown; attrs?: { level?: unknown } };
      if (node?.type === "text") {
        if (typeof node.text === "string" && node.text.length) {
          const m = marks(node.marks);
          out.push(m ? { type: "text", text: node.text.slice(0, 20_000), marks: m } : { type: "text", text: node.text.slice(0, 20_000) });
        }
      } else if (node?.type === "hardBreak" || node?.type === "horizontalRule") {
        out.push({ type: node.type });
      } else if (node?.type === "heading") {
        const level = Math.min(4, Math.max(2, Number(node.attrs?.level) || 2)) as 2 | 3 | 4;
        out.push({ type: "heading", attrs: { level }, content: nodes(node.content, depth + 1) });
      } else if (typeof node?.type === "string" && BLOCKS.has(node.type)) {
        out.push({ type: node.type as "paragraph", content: nodes(node.content, depth + 1) });
      }
    }
    return out;
  }

  return { type: "doc", content: nodes((input as { content?: unknown }).content, 0) ?? [] };
}

/** The words in a document, e.g. for a page's description in Google. */
export function plainText(doc: RichDoc | null): string {
  const parts: string[] = [];
  const walk = (list: RichNode[] | undefined) => {
    for (const n of list ?? []) {
      if (n.type === "text") parts.push(n.text);
      else if ("content" in n) {
        walk(n.content);
        parts.push(" ");
      }
    }
  };
  walk(doc?.content);
  return parts.join("").replace(/\s+/g, " ").trim();
}

// ── Building documents in code (the seed's starter pages) ───────

export const rt = {
  doc: (...content: RichNode[]): RichDoc => ({ type: "doc", content }),
  h2: (text: string): RichNode => ({ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text }] }),
  p: (...content: (string | RichNode)[]): RichNode => ({
    type: "paragraph",
    content: content.map((c) => (typeof c === "string" ? { type: "text", text: c } : c)),
  }),
  bold: (text: string): RichNode => ({ type: "text", text, marks: [{ type: "bold" }] }),
  link: (text: string, href: string): RichNode => ({ type: "text", text, marks: [{ type: "link", attrs: { href } }] }),
  list: (...items: string[]): RichNode => ({
    type: "bulletList",
    content: items.map((text) => ({ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text }] }] })),
  }),
};
