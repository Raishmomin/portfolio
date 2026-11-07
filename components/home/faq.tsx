// Home FAQ section (lane-owned: fm3-faq). Server Component; the FAQ JSON-LD on the home
// page is built from the same FAQ objects, so visible questions and schema never drift.
import { Accent } from "../ui/primitives";
import type { FAQ } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { HomeSection, SectionHead, column, panel } from "./ui";

/** "left" composition: each question is its own card; answers open smoothly. */
export function FaqSection({ faqs }: { faqs: FAQ[] }) {
  return (
    <HomeSection id="faq" section="faq" stage="left" labelledBy="faq-heading">
      <div className={column.left}>
        <div data-card="" className={cn(panel, "p-6 md:p-8")}>
          <SectionHead
            id="faq-heading"
            index="07"
            kicker="faq"
            title={
              <>
                Questions, <Accent>answered.</Accent>
              </>
            }
          />
        </div>
        <ul data-card-group="" className="mt-4 grid grid-cols-1 gap-3">
          {faqs.map((f) => (
            <li key={f.q} data-card="">
              <details data-spotlight="" className={cn(panel, "faq group px-5")}>
                <summary className="flex min-h-12 cursor-pointer list-none items-start justify-between gap-6 py-4 [&::-webkit-details-marker]:hidden">
                  <h3 className="text-[17px] font-medium leading-6 tracking-[-0.01em] text-foreground">{f.q}</h3>
                  <span
                    aria-hidden="true"
                    className="mt-0.5 font-mono text-lg leading-5 text-muted-foreground transition-transform duration-300 group-open:rotate-45 group-open:text-primary"
                  >
                    +
                  </span>
                </summary>
                <p className="max-w-[62ch] pb-5 text-[15px] leading-6 text-muted-foreground">{f.a}</p>
              </details>
            </li>
          ))}
        </ul>
      </div>
    </HomeSection>
  );
}
