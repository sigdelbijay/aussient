"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X, ZoomIn } from "lucide-react";
import { cn } from "cn";

export type GalleryMedia = { id: string; url: string; type: "IMAGE" | "VIDEO"; alt: string };

/**
 * Product photos and videos. Swipe between them on phones (scroll-snap),
 * use the thumbnails/arrows on desktop, and tap a photo to open the zoom view.
 */
export function Gallery({ media }: { media: GalleryMedia[] }) {
  const [index, setIndex] = useState(0);
  const [zoomAt, setZoomAt] = useState<number | null>(null);
  const track = useRef<HTMLDivElement>(null);

  function onScroll() {
    const el = track.current;
    if (el) setIndex(Math.round(el.scrollLeft / el.clientWidth));
  }

  function go(i: number) {
    const el = track.current;
    el?.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  }

  if (media.length === 0) return <div className="aspect-[4/5] rounded-lg bg-muted" />;

  return (
    <div className="grid gap-3">
      <div className="group/gallery relative">
        <div
          ref={track}
          onScroll={onScroll}
          role="region"
          aria-roledescription="carousel"
          aria-label="Product photos"
          className="flex aspect-[4/5] snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-lg bg-muted [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {media.map((m, i) => (
            <div
              key={m.id}
              className="relative w-full shrink-0 snap-center"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${media.length}`}
            >
              {m.type === "VIDEO" ? (
<GalleryVideo src={m.url} alt={m.alt} active={i === index} />
              ) : (
                <button
                  type="button"
                  onClick={() => setZoomAt(i)}
                  aria-label={`Zoom: ${m.alt}`}
                  className="absolute inset-0 cursor-zoom-in"
                >
                  <Image
                    src={m.url}
                    alt={m.alt}
                    fill
                    // The first photo is what shoppers see first, so it loads before anything else.
                    loading={i === 0 ? "eager" : undefined}
                    fetchPriority={i === 0 ? "high" : undefined}
                    sizes="(min-width: 1024px) 50vw, 100vw"
                    // Whole photo, square or tall; white backgrounds blend into the grey frame.
                    className="object-contain mix-blend-multiply dark:mix-blend-normal"
                  />
                </button>
              )}
            </div>
          ))}
        </div>

        <span className="pointer-events-none absolute bottom-3 right-3 grid size-9 place-items-center rounded-full bg-background/80 shadow-sm backdrop-blur-sm">
          <ZoomIn className="size-4" />
        </span>

        {media.length > 1 && (
          <>
            {/* Arrows on desktop */}
            {([-1, 1] as const).map((dir) => (
              <button
                key={dir}
                type="button"
                onClick={() => go(Math.min(media.length - 1, Math.max(0, index + dir)))}
                disabled={index + dir < 0 || index + dir >= media.length}
                aria-label={dir === -1 ? "Previous photo" : "Next photo"}
                className={cn(
                  "absolute top-1/2 hidden size-10 -translate-y-1/2 place-items-center rounded-full bg-background/90 shadow-md transition-opacity duration-200 disabled:opacity-0 md:grid md:opacity-0 md:group-hover/gallery:opacity-100 md:disabled:opacity-0 focus-visible:opacity-100",
                  dir === -1 ? "left-3" : "right-3",
                )}
              >
                {dir === -1 ? <ChevronLeft className="size-5" /> : <ChevronRight className="size-5" />}
              </button>
            ))}

            {/* Dots on phones */}
            <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5 md:hidden" aria-hidden>
              {media.map((m, i) => (
                <span
                  key={m.id}
                  className={cn(
                    "size-1.5 rounded-full bg-foreground/30 transition-all duration-200",
                    i === index && "w-4 bg-foreground",
                  )}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Thumbnails on desktop */}
      {media.length > 1 && (
        <div className="hidden grid-cols-5 gap-2 md:grid">
          {media.map((m, i) => (
            <button
              key={m.id}
              type="button"
              onClick={() => go(i)}
              aria-label={`Show photo ${i + 1}`}
              aria-current={i === index}
              className={cn(
                "relative aspect-square overflow-hidden rounded-md bg-muted ring-offset-2 ring-offset-background transition-shadow",
                i === index ? "ring-2 ring-foreground" : "opacity-70 hover:opacity-100",
              )}
            >
              {m.type === "VIDEO" ? (
                <video src={m.url} muted playsInline preload="metadata" className="size-full object-cover" />
              ) : (
                <Image src={m.url} alt="" fill sizes="10vw" className="object-cover" />
              )}
            </button>
          ))}
        </div>
      )}

      {zoomAt !== null && (
        <Lightbox
          media={media}
          start={zoomAt}
          onClose={(last) => {
            setZoomAt(null);
            go(last);
          }}
        />
      )}
    </div>
  );
}

/** Muted, looping product video that only loads fully and plays while it's the slide in view. */
function GalleryVideo({ src, alt, active }: { src: string; alt: string; active: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (active) video.play().catch(() => {}); // autoplay can be blocked (e.g. low-power mode)
    else video.pause();
  }, [active]);
  return (
    <video
      ref={ref}
      src={src}
      aria-label={alt}
      muted
      loop
      playsInline
      preload="metadata"
      className="size-full object-cover"
    />
  );
}

/** Full-screen viewer: tap/click to zoom, pinch to zoom, drag to pan. */
function Lightbox({
  media,
  start,
  onClose,
}: {
  media: GalleryMedia[];
  start: number;
  onClose: (index: number) => void;
}) {
  const [index, setIndex] = useState(start);
  const step = (dir: 1 | -1) => setIndex((i) => (i + dir + media.length) % media.length);
  const m = media[index];

  useEffect(() => {
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose(index);
      if (e.key === "ArrowLeft") step(-1);
      if (e.key === "ArrowRight") step(1);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      className="fixed inset-0 z-[70] flex flex-col bg-background"
    >
      <div className="flex items-center justify-between px-4 py-3 text-sm">
        <span className="text-muted-foreground">
          {index + 1} / {media.length}
        </span>
        <button
          type="button"
          onClick={() => onClose(index)}
          aria-label="Close photo viewer"
          autoFocus
          className="grid size-10 place-items-center rounded-full hover:bg-muted"
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="relative min-h-0 flex-1">
        {m.type === "VIDEO" ? (
          <video src={m.url} controls autoPlay playsInline className="size-full object-contain" />
        ) : (
          <ZoomableImage key={m.id} src={m.url} alt={m.alt} />
        )}

        {media.length > 1 &&
          ([-1, 1] as const).map((dir) => (
            <button
              key={dir}
              type="button"
              onClick={() => step(dir)}
              aria-label={dir === -1 ? "Previous photo" : "Next photo"}
              className={cn(
                "absolute top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-background/90 shadow-md",
                dir === -1 ? "left-3" : "right-3",
              )}
            >
              {dir === -1 ? <ChevronLeft className="size-5" /> : <ChevronRight className="size-5" />}
            </button>
          ))}
      </div>
      <p className="py-3 text-center text-xs text-muted-foreground">
        Tap to zoom · pinch or scroll to zoom further · drag to move
      </p>
    </div>
  );
}

const MAX_ZOOM = 4;
const TAP_ZOOM = 2.5;

type View = { s: number; x: number; y: number };
type Point = { x: number; y: number };

function ZoomableImage({ src, alt }: { src: string; alt: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [view, setViewState] = useState<View>({ s: 1, x: 0, y: 0 });
  const [gesturing, setGesturing] = useState(false);
  const current = useRef(view);
  const pointers = useRef(new Map<number, Point>());
  const pinch = useRef<{ dist: number; mid: Point; from: View } | null>(null);
  const moved = useRef(0);

  /** Keeps the photo covering the frame — no panning past its edges. */
  function setView(next: View) {
    const el = box.current;
    const s = Math.min(MAX_ZOOM, Math.max(1, next.s));
    const maxX = el ? (el.clientWidth * (s - 1)) / 2 : 0;
    const maxY = el ? (el.clientHeight * (s - 1)) / 2 : 0;
    const clamped = {
      s,
      x: Math.max(-maxX, Math.min(maxX, next.x)),
      y: Math.max(-maxY, Math.min(maxY, next.y)),
    };
    current.current = clamped;
    setViewState(clamped);
  }

  /** Screen point relative to the frame's centre. */
  function rel(clientX: number, clientY: number): Point {
    const r = box.current!.getBoundingClientRect();
    return { x: clientX - r.left - r.width / 2, y: clientY - r.top - r.height / 2 };
  }

  /** Zoom to `s` while keeping the photo point under `p` in place. */
  function zoomAround(from: View, s: number, p: Point, at: Point = p) {
    const k = Math.min(MAX_ZOOM, Math.max(1, s)) / from.s;
    setView({ s, x: at.x - (p.x - from.x) * k, y: at.y - (p.y - from.y) * k });
  }

  function twoFingers() {
    const [a, b] = [...pointers.current.values()];
    return {
      dist: Math.hypot(a.x - b.x, a.y - b.y),
      mid: rel((a.x + b.x) / 2, (a.y + b.y) / 2),
    };
  }

  function onPointerDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) moved.current = 0;
    if (pointers.current.size === 2) pinch.current = { ...twoFingers(), from: current.current };
    setGesturing(true);
  }

  function onPointerMove(e: React.PointerEvent) {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved.current += Math.abs(dx) + Math.abs(dy);

    if (pointers.current.size === 2 && pinch.current) {
      const { dist, mid } = twoFingers();
      const { from } = pinch.current;
      zoomAround(from, (from.s * dist) / pinch.current.dist, pinch.current.mid, mid);
    } else if (pointers.current.size === 1 && current.current.s > 1) {
      const v = current.current;
      setView({ ...v, x: v.x + dx, y: v.y + dy });
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) setGesturing(false);
  }

  function onClick(e: React.MouseEvent) {
    if (moved.current > 6) return; // that was a drag or pinch, not a tap
    const v = current.current;
    if (v.s > 1) setView({ s: 1, x: 0, y: 0 });
    else zoomAround(v, TAP_ZOOM, rel(e.clientX, e.clientY));
  }

  function onWheel(e: React.WheelEvent) {
    const v = current.current;
    zoomAround(v, v.s * Math.exp(-e.deltaY * 0.002), rel(e.clientX, e.clientY));
  }

  return (
    <div
      ref={box}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={onClick}
      onWheel={onWheel}
      className={cn(
        "absolute inset-0 touch-none select-none overflow-hidden",
        view.s > 1 ? "cursor-zoom-out" : "cursor-zoom-in",
      )}
    >
      <div
        className="absolute inset-0"
        style={{
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})`,
          transition: gesturing ? "none" : "transform 200ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <Image src={src} alt={alt} fill sizes="100vw" draggable={false} className="object-contain" />
      </div>
    </div>
  );
}
