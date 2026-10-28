"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Shown only to staff in Preview: a reminder that drafts are showing, and a way out. */
export function PreviewBar() {
  const pathname = usePathname();
  return (
    <div className="sticky top-0 z-[60] flex flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-amber-300 px-4 py-2 text-center text-xs font-semibold text-amber-950">
      <span>Preview — you’re seeing unpublished drafts. Shoppers don’t see these yet.</span>
      <span className="flex gap-3">
        <Link href="/admin/content" className="underline">
          Back to admin
        </Link>
        {/* Plain links: Preview is switched off by visiting this address. */}
        <a href={`/api/preview?exit=1&to=${encodeURIComponent(pathname)}`} className="underline">
          Exit preview
        </a>
      </span>
    </div>
  );
}
