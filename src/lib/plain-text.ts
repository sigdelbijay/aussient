/**
 * Turns HTML into plain text, keeping the line breaks — for product text
 * pasted from another shop or a supplier's CSV, e.g.
 *   "<p>Soft cotton.</p><ul><li>Machine wash</li></ul>" → "Soft cotton.\n\n• Machine wash"
 * Scripts, styles and every tag are removed; text without HTML is just trimmed.
 * (The shop shows these fields as text, so HTML could never run — this stops
 * shoppers seeing stray "<p>" tags.)
 */
export function htmlToText(input: string): string {
  if (!/[<&]/.test(input)) return tidyLines(input);
  const withoutTags = (s: string) => s.replace(/<\/?[a-z!][^>]*>/gi, "");
  const text = withoutTags(
    input
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<li\b[^>]*>/gi, "\n• ")
      .replace(/<\/(p|div|h[1-6]|ul|ol|blockquote|tr|table)\s*>/gi, "\n\n")
      .replace(/<\/li\s*>/gi, ""),
  );
  // Decode entities last, then remove any tags that were written as &lt;b&gt;.
  return tidyLines(withoutTags(decodeEntities(text)));
}

const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
};

function decodeEntities(s: string) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === "#") {
      const n =
        code[1] === "x" || code[1] === "X"
          ? parseInt(code.slice(2), 16)
          : parseInt(code.slice(1), 10);
      return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : "";
    }
    return NAMED[code.toLowerCase()] ?? whole;
  });
}

/** Trims each line and allows at most one empty line in a row. */
function tidyLines(s: string) {
  return s
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
