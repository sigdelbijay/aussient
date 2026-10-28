/** Helpers for the brand accent colour chosen in Settings. */

/** "#e6007e" → true. Only this exact form is ever put into the page's CSS. */
export const isHexColor = (c: unknown): c is string => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c);

/** Black or white text, whichever is easier to read on this colour (WCAG contrast). */
export function textOn(hex: string): "#ffffff" | "#16161a" {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // Contrast with white is (1.05)/(lum+0.05); with near-black about (lum+0.05)/0.059.
  return 1.05 / (lum + 0.05) >= (lum + 0.05) / 0.059 ? "#ffffff" : "#16161a";
}

/** CSS that swaps the shop's accent colour, or "" for the built-in one. */
export function accentCss(hex: string | null) {
  if (!isHexColor(hex)) return "";
  return `:root{--brand-accent:${hex.toLowerCase()};--brand-accent-foreground:${textOn(hex)}}`;
}
