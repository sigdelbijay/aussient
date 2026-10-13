import Link from "next/link";

/** Title row used by most home sections, with an optional "View all" link. */
export function SectionHeading({
  title,
  link,
}: {
  title: string | null;
  link?: { label: string; href: string };
}) {
  if (!title && !link) return null;
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      {title && <h2 className="text-display text-3xl sm:text-4xl">{title}</h2>}
      {link && (
        <Link
          href={link.href}
          className="shrink-0 text-sm font-medium text-brand-accent hover:underline"
        >
          {link.label} →
        </Link>
      )}
    </div>
  );
}

/** Standard page-width wrapper with vertical spacing between sections. */
export function SectionShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`mx-auto w-full max-w-7xl px-4 py-10 sm:py-14 ${className ?? ""}`}>
      {children}
    </section>
  );
}
