import Link from "next/link";

/**
 * Scrolling announcement bar, fed by Banners with placement "announcement".
 * Pure-CSS marquee (see `--animate-marquee` in globals.css) that pauses on hover
 * and stops entirely under reduced-motion. The track is duplicated so the -50%
 * translate loops seamlessly.
 */
export function AnnouncementBar({
  items,
}: {
  items: { id: string; text: string; link: string | null }[];
}) {
  if (items.length === 0) return null;
  const track = [...items, ...items];

  return (
    <div className="group/announce overflow-hidden bg-brand-ink text-brand-paper">
      <div className="flex w-max animate-marquee items-center group-hover/announce:[animation-play-state:paused] motion-reduce:animate-none motion-reduce:justify-center">
        {track.map((item, i) => {
          const hidden = i >= items.length; // the duplicate copy, for the loop
          const content = (
            <>
              {item.text}
              <span className="text-brand-orange">✦</span>
            </>
          );
          const className =
            "flex items-center gap-3 px-6 py-2 text-[0.7rem] font-heading font-bold uppercase tracking-widest";
          return item.link ? (
            <Link
              key={`${item.id}-${i}`}
              href={item.link}
              className={`${className} hover:text-brand-orange`}
              aria-hidden={hidden || undefined}
              tabIndex={hidden ? -1 : undefined}
            >
              {content}
            </Link>
          ) : (
            <span key={`${item.id}-${i}`} className={className} aria-hidden={hidden || undefined}>
              {content}
            </span>
          );
        })}
      </div>
    </div>
  );
}
