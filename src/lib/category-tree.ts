/** Categories nest up to this many levels, e.g. Women > Clothing > Dresses. */
export const MAX_CATEGORY_DEPTH = 3;

type Node = { id: string; parentId: string | null; order: number; name: string };

/**
 * Categories in tree order (each parent followed by its children), with
 * `depth` 0 for top level — handy for indented lists and dropdowns.
 */
export function flattenTree<T extends Node>(all: T[]): (T & { depth: number })[] {
  const byOrder = (a: T, b: T) => a.order - b.order || a.name.localeCompare(b.name);
  const out: (T & { depth: number })[] = [];
  const visit = (parentId: string | null, depth: number) => {
    for (const c of all.filter((x) => x.parentId === parentId).sort(byOrder)) {
      out.push({ ...c, depth });
      if (depth < 5) visit(c.id, depth + 1);
    }
  };
  visit(null, 0);
  return out;
}
