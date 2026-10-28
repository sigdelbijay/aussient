import { cn } from "cn";

/** Small building blocks shared by the admin pages. */

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-heading text-2xl font-extrabold sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Panel({
  title,
  description,
  actions,
  className,
  children,
}: {
  title?: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("rounded-xl border border-border bg-background p-5", className)}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && <h2 className="font-heading text-base font-bold">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

/** Label + input + hint/error. Pass the control as children. */
export function AdminField({
  label,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("grid content-start gap-1.5", className)}>
      <span className="text-sm font-medium">{label}</span>
      {children}
      {error ? (
        <span className="text-xs text-destructive">{error}</span>
      ) : (
        hint && <span className="text-xs text-muted-foreground">{hint}</span>
      )}
    </label>
  );
}

export const inputClass =
  "h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 aria-invalid:border-destructive";

export const textareaClass = cn(inputClass, "h-auto py-2 leading-relaxed");

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-background p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-heading text-3xl font-extrabold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const tone: Record<string, string> = {
    LIVE: "bg-emerald-100 text-emerald-800",
    DRAFT: "bg-muted text-muted-foreground",
    PAID: "bg-amber-100 text-amber-800",
    SHIPPED: "bg-emerald-100 text-emerald-800",
    CANCELLED: "bg-muted text-muted-foreground",
    REFUNDED: "bg-red-100 text-red-800",
  };
  return (
    <span className={cn("inline-block rounded-full px-2 py-0.5 text-[0.7rem] font-semibold", tone[status] ?? "bg-muted")}>
      {status === "PAID" ? "To ship" : status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

/** Horizontally scrollable table wrapper so wide tables don't break phones. `narrow` tables fit a phone without scrolling. */
export function TableWrap({ children, narrow = false }: { children: React.ReactNode; narrow?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-background">
      <table className={cn("w-full text-left", narrow ? "min-w-0" : "min-w-[40rem]", "text-sm [&_td]:px-4 [&_td]:py-3 [&_th]:px-4 [&_th]:py-2.5 [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-muted-foreground [&_thead]:border-b [&_thead]:border-border [&_tbody_tr]:border-b [&_tbody_tr]:border-border [&_tbody_tr:last-child]:border-0")}>
        {children}
      </table>
    </div>
  );
}
