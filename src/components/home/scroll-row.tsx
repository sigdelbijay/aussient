"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Horizontal, swipeable row that snaps to each card. Arrow buttons appear on
 * larger screens; on phones you just swipe.
 */
export function ScrollRow({ children, label }: { children: React.ReactNode; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: 1 | -1) =>
    ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: "smooth" });

  return (
    <div className="group/row relative">
      <div
        ref={ref}
        role="region"
        aria-label={label}
        tabIndex={0}
        className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      {([-1, 1] as const).map((dir) => (
        <button
          key={dir}
          type="button"
          onClick={() => scroll(dir)}
          aria-label={dir === -1 ? "Scroll left" : "Scroll right"}
          className={`absolute top-[38%] z-10 hidden size-10 -translate-y-1/2 place-items-center rounded-full bg-background shadow-md transition-opacity duration-200 hover:bg-muted md:grid md:opacity-0 md:group-hover/row:opacity-100 focus-visible:opacity-100 ${dir === -1 ? "-left-3" : "-right-3"}`}
        >
          {dir === -1 ? <ChevronLeft className="size-5" /> : <ChevronRight className="size-5" />}
        </button>
      ))}
    </div>
  );
}
