import type { ReactNode } from "react";
import type { FAQ } from "@/lib/seo";
import { PageSection, SectionHead, card, column, type PageScene, type StageLayout } from "../ui";

/**
 * Visible FAQ (server-rendered <details>; answers stay in the DOM when closed). Render the
 * same FAQ array that feeds the page's FAQPage JSON-LD. Rows flip down as a wave.
 */
export function FaqList({ faqs }: { faqs: FAQ[] }) {
  if (!faqs.length) return null;
  return (
    <ul data-card-group="" className="divide-y divide-border border-y border-border">
      {faqs.map((f) => (
        <li key={f.q} {...card("flip")}>
          <details className="faq group">
            <summary className="flex min-h-11 cursor-pointer list-none items-start justify-between gap-6 rounded-sm py-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background [&::-webkit-details-marker]:hidden">
              <h3 className="text-base font-medium leading-7 tracking-[-0.01em] text-foreground md:text-lg">{f.q}</h3>
              <span
                aria-hidden="true"
                className="mt-1 shrink-0 font-mono text-lg leading-none text-muted-foreground transition-transform duration-300 group-open:rotate-45 group-hover:text-primary"
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

/** FAQ section: one panel (left or right composition) with the section head and the rows. */
export function FaqSection({
  faqs,
  index,
  title,
  stage,
  scene = "ambient",
  id = "faq",
}: {
  faqs: FAQ[];
  index: string;
  title: ReactNode;
  stage: "left" | "right";
  scene?: PageScene;
  id?: string;
}) {
  if (!faqs.length) return null;
  return (
    <PageSection id={id} section="faq" scene={scene} stage={stage as StageLayout} labelledBy={`${id}-heading`}>
      <div className={`panel p-6 md:p-8 ${column[stage]}`}>
        <SectionHead id={`${id}-heading`} index={index} kicker="faq" title={title} />
        <div className="mt-8">
          <FaqList faqs={faqs} />
        </div>
      </div>
    </PageSection>
  );
}
