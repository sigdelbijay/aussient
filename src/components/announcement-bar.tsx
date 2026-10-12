import { announcements } from "@/lib/placeholder-data";

/**
 * Scrolling announcement bar. Pure-CSS marquee (see `--animate-marquee` in
 * globals.css) that pauses on hover and stops entirely under reduced-motion.
 * The track is duplicated so the -50% translate loops seamlessly.
 */
export function AnnouncementBar() {
  const items = [...announcements, ...announcements];

  return (
    <div className="group/announce overflow-hidden bg-brand-ink text-brand-paper">
      <div className="flex w-max animate-marquee items-center group-hover/announce:[animation-play-state:paused] motion-reduce:animate-none motion-reduce:justify-center">
        {items.map((text, i) => (
          <span
            key={i}
            className="flex items-center gap-3 px-6 py-2 text-[0.7rem] font-heading font-bold uppercase tracking-widest"
            aria-hidden={i >= announcements.length ? true : undefined}
          >
            {text}
            <span className="text-brand-accent">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}
