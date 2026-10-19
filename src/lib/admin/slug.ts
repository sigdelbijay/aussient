/** "Nova Crystal Hoops!" → "nova-crystal-hoops" */
export function slugify(text: string) {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // accents
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** First of slug, slug-2, slug-3… that `taken` says is free. */
export async function uniqueSlug(base: string, taken: (slug: string) => Promise<boolean>) {
  const root = slugify(base) || "item";
  for (let n = 1; n < 500; n++) {
    const candidate = n === 1 ? root : `${root}-${n}`;
    if (!(await taken(candidate))) return candidate;
  }
  return `${root}-${Date.now()}`;
}
