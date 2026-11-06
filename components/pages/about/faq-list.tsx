import type { FAQ } from "@/lib/seo";
import { reveal } from "../motion";

/**
 * Visible FAQ (server-rendered <details>; answers stay in the DOM when closed).
 * Render the same FAQ array that feeds the page's FAQPage JSON-LD.
 */
export function FaqList({ faqs }: { faqs: FAQ[] }) {
  if (!faqs.length) return null;
  return (
    <ul className="divide-y divide-border border-y border-border">
      {faqs.map((f, i) => (
        <li key={f.q} {...reveal(i, 40)}>
          <details className="group">
            <summary className="flex min-h-11 cursor-pointer list-none items-start justify-between gap-6 rounded-sm py-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background [&::-webkit-details-marker]:hidden">
              <h3 className="text-base font-medium leading-7 tracking-[-0.01em] text-foreground md:text-lg">{f.q}</h3>
              <span
                aria-hidden="true"
                className="mt-1 shrink-0 font-mono text-lg leading-none text-muted-foreground transition-transform duration-150 group-open:rotate-45 group-hover:text-primary"
              >
                +
              </span>
            </summary>
            <p className="max-w-[68ch] pb-6 pr-10 text-[15px] leading-7 text-muted-foreground md:text-base">{f.a}</p>
          </details>
        </li>
      ))}
    </ul>
  );
}
