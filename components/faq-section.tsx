import type { FAQ } from "@/lib/seo";

export function FAQSection({
  faqs,
  heading = "Frequently asked questions",
  eyebrow = "FAQ",
}: {
  faqs: FAQ[];
  heading?: string;
  eyebrow?: string;
}) {
  if (!faqs || faqs.length === 0) return null;

  return (
    <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24" aria-label={heading}>
      <div className="mb-12 md:mb-16 text-center">
        <span className="inline-flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-muted-foreground mb-6">
          <span className="h-px w-8 bg-muted-foreground/40" />
          {eyebrow}
          <span className="h-px w-8 bg-muted-foreground/40" />
        </span>
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
          {heading}
        </h2>
      </div>

      <ul className="divide-y divide-border border-y border-border">
        {faqs.map((f, i) => (
          <li key={i}>
            <details className="group py-6">
              <summary className="flex items-start justify-between gap-6 cursor-pointer list-none focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">
                <h3 className="text-base md:text-lg font-medium tracking-tight text-foreground pr-4">
                  {f.q}
                </h3>
                <span
                  aria-hidden="true"
                  className="mt-1 shrink-0 text-muted-foreground transition-transform group-open:rotate-45 text-xl leading-none"
                >
                  +
                </span>
              </summary>
              <div className="mt-4 text-sm md:text-base text-muted-foreground leading-relaxed">
                {f.a}
              </div>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}
