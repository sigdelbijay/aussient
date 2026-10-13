import { NewsletterForm } from "@/components/newsletter-form";

export function NewsletterSection({ heading, text }: { heading: string; text?: string }) {
  return (
    <section className="bg-brand-ink text-brand-paper">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-4 py-16 text-center">
        <h2 className="text-display text-3xl sm:text-5xl">{heading}</h2>
        {text && <p className="max-w-md text-brand-paper/75">{text}</p>}
        <div className="w-full max-w-sm">
          <NewsletterForm tone="dark" />
        </div>
      </div>
    </section>
  );
}
