// Home FAQ section (lane-owned: fm3-faq). Server Component; the FAQ JSON-LD on the home
// page is built from the same FAQ objects, so visible questions and schema never drift.
import { Accent } from "../ui/primitives";
import { FaqLayout, FaqNote } from "../ui/faq-list";
import type { FAQ } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { HomeSection, SectionHead, panel } from "./ui";

/**
 * "left" composition: the question cards on the left, the FAQ scene's window on the right
 * (desktop). Opening a question turns the scene into that answer's visual; on phones the
 * question field shows in the section's opening and each answer's picture under its card.
 */
export function FaqSection({ faqs }: { faqs: FAQ[] }) {
  return (
    <HomeSection id="faq" section="faq" stage="left" scene labelledBy="faq-heading">
      <FaqLayout
        side="left"
        name="faq-home"
        faqs={faqs}
        head={
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
            <FaqNote />
          </div>
        }
      />
    </HomeSection>
  );
}
