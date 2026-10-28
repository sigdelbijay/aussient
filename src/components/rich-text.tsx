import Link from "next/link";
import { Fragment } from "react";
import { safeHref, type RichDoc, type RichMark, type RichNode } from "@/lib/content/rich-text";

/**
 * Shows text written in the admin page editor. Only the node types in
 * src/lib/content/rich-text.ts are drawn, as normal React elements — no raw HTML.
 */
export function RichText({ doc, className = "rich-text" }: { doc: RichDoc; className?: string }) {
  return <div className={className}>{doc.content.map((n, i) => <Node key={i} node={n} />)}</div>;
}

function Children({ nodes }: { nodes?: RichNode[] }) {
  return <>{nodes?.map((n, i) => <Node key={i} node={n} />)}</>;
}

function Node({ node }: { node: RichNode }) {
  switch (node.type) {
    case "text":
      return <Marked text={node.text} marks={node.marks ?? []} />;
    case "hardBreak":
      return <br />;
    case "horizontalRule":
      return <hr />;
    case "heading": {
      const Tag = `h${node.attrs.level}` as "h2" | "h3" | "h4";
      return <Tag><Children nodes={node.content} /></Tag>;
    }
    case "paragraph":
      return <p><Children nodes={node.content} /></p>;
    case "bulletList":
      return <ul><Children nodes={node.content} /></ul>;
    case "orderedList":
      return <ol><Children nodes={node.content} /></ol>;
    case "listItem":
      return <li><Children nodes={node.content} /></li>;
    case "blockquote":
      return <blockquote><Children nodes={node.content} /></blockquote>;
    default:
      return null;
  }
}

/** Text with its bold/italic/… marks, wrapped in a link if it has one. */
function Marked({ text, marks }: { text: string; marks: RichMark[] }) {
  let out: React.ReactNode = <Fragment>{text}</Fragment>;
  for (const m of marks) {
    if (m.type === "bold") out = <strong>{out}</strong>;
    else if (m.type === "italic") out = <em>{out}</em>;
    else if (m.type === "underline") out = <u>{out}</u>;
    else if (m.type === "strike") out = <s>{out}</s>;
    else if (m.type === "code") out = <code>{out}</code>;
  }
  const link = marks.find((m) => m.type === "link");
  const href = link && "attrs" in link ? safeHref(link.attrs.href) : null;
  if (!href) return out;
  return href.startsWith("/") ? <Link href={href}>{out}</Link> : <a href={href} rel="noopener noreferrer" target={href.startsWith("http") ? "_blank" : undefined}>{out}</a>;
}
