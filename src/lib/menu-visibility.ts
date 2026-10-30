import "server-only";
import { listingScopeOf, scopeHasProducts } from "@/lib/catalog";
import type { MenuGroup, MenuLink } from "@/lib/storefront";

/** Is this link worth showing? Links to a category, collection or brand with no live products aren't. */
async function showLink(link: MenuLink): Promise<boolean> {
  const scope = await listingScopeOf(link.url);
  return scope === null || scopeHasProducts(scope);
}

async function keepShown<T extends MenuLink>(links: T[], keep: (l: T) => Promise<boolean>): Promise<T[]> {
  const flags = await Promise.all(links.map(keep));
  return links.filter((_, i) => flags[i]);
}

/**
 * Leaves out menu links (and mega-menu sub-categories) that would open an
 * empty listing — e.g. a department whose products are all set back to Draft.
 * Link groups whose own link is empty disappear with everything under them;
 * footer column headings (links to "#") always stay.
 */
export async function hideEmptyLinks(menu: MenuGroup[]): Promise<MenuGroup[]> {
  const groups = await keepShown(menu, showLink);
  return Promise.all(
    groups.map(async (group) => ({
      ...group,
      children: await Promise.all(
        (await keepShown(group.children, showLink)).map(async (child) =>
          child.children ? { ...child, children: await keepShown(child.children, showLink) } : child,
        ),
      ),
    })),
  );
}
