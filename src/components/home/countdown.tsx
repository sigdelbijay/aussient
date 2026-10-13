"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { cn } from "cn";
import { buttonVariants } from "@/components/ui/button";

// One shared 1-second ticker for every countdown on the page.
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;
let now = Date.now();
function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!timer) {
    timer = setInterval(() => {
      now = Date.now();
      listeners.forEach((l) => l());
    }, 1000);
  }
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

/** Sale countdown. The server renders dashes; the live numbers start in the browser. */
export function Countdown({
  heading,
  text,
  endsAt,
  button,
}: {
  heading: string;
  text?: string;
  endsAt: string;
  button?: { label: string; href: string };
}) {
  const current = useSyncExternalStore(
    subscribe,
    () => now,
    () => null,
  );
  const end = Date.parse(endsAt);
  const left = current === null ? null : Math.max(0, end - current);

  // Sale's over — hide it (the cached page also rebuilds at the end time).
  if (left === 0) return null;

  const parts =
    left === null
      ? null
      : {
          Days: Math.floor(left / 86_400_000),
          Hours: Math.floor(left / 3_600_000) % 24,
          Mins: Math.floor(left / 60_000) % 60,
          Secs: Math.floor(left / 1000) % 60,
        };

  return (
    <section className="bg-brand-accent text-brand-accent-foreground">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-4 py-12 text-center lg:flex-row lg:justify-between lg:text-left">
        <div>
          <h2 className="text-display text-3xl sm:text-4xl">{heading}</h2>
          {text && <p className="mt-1 opacity-90">{text}</p>}
        </div>
        <div className="flex gap-3" role="timer" aria-label="Time left in the sale">
          {(["Days", "Hours", "Mins", "Secs"] as const).map((unit) => (
            <div
              key={unit}
              className="grid w-16 place-items-center rounded-lg bg-black/15 py-2 sm:w-20"
            >
              <span className="font-heading text-3xl font-extrabold tabular-nums sm:text-4xl">
                {parts ? String(parts[unit]).padStart(2, "0") : "--"}
              </span>
              <span className="text-[0.65rem] font-bold uppercase tracking-widest opacity-80">
                {unit}
              </span>
            </div>
          ))}
        </div>
        {button && (
          <Link
            href={button.href}
            className={cn(
              buttonVariants({ size: "lg" }),
              "h-11 bg-brand-ink px-6 font-heading font-bold uppercase text-brand-paper hover:bg-brand-ink/85",
            )}
          >
            {button.label}
          </Link>
        )}
      </div>
    </section>
  );
}
