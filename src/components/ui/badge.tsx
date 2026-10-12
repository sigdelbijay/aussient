import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

const badgeVariants = cva(
  "inline-flex items-center justify-center gap-1 rounded-sm px-2 py-0.5 text-[0.65rem] font-heading font-extrabold uppercase tracking-wider leading-none whitespace-nowrap select-none [&_svg]:size-3 [&_svg]:pointer-events-none",
  {
    variants: {
      variant: {
        /* NEW — soft gold */
        new: "bg-brand-gold text-brand-gold-foreground",
        /* SALE — the bright accent, the loudest tag */
        sale: "bg-brand-accent text-brand-accent-foreground",
        /* LOW STOCK — outlined, urgent but quieter than SALE */
        low: "border border-brand-accent/40 bg-brand-accent/10 text-brand-accent",
        neutral: "bg-brand-ink text-brand-paper",
        outline: "border border-border bg-background text-foreground",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ variant, className }))} {...props} />
  );
}

export { Badge, badgeVariants };
