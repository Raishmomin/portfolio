import type { ReactNode } from "react";
import type { FAQ } from "@/lib/seo";
import { FAQ_SCENE_NOTE, FaqItems, FaqLayout } from "../../ui/faq-list";
import { PageSection, SectionHead, card, panel, type PageScene, type StageLayout } from "../ui";

/**
 * Visible FAQ cards (server-rendered <details>; answers stay in the DOM when closed). Render
 * the same FAQ array that feeds the page's FAQPage JSON-LD.
 */
export function FaqList({ faqs, name = "faq" }: { faqs: FAQ[]; name?: string }) {
  if (!faqs.length) return null;
  return <FaqItems faqs={faqs} name={name} />;
}

/**
 * FAQ section of a subpage, in the home FAQ's design: the head panel and the question cards
 * on the `stage` side, the FAQ scene's window on the other (desktop), the scene in the
 * section's opening on phones. The section always drives the "faq" scene; `scene` is kept
 * for existing callers and ignored.
 */
export function FaqSection({
  faqs,
  index,
  title,
  stage,
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
    <PageSection
      id={id}
      section="faq"
      scene="ambient"
      // "faq" is a scene key the stage knows (components/neural/types.ts) but PageScene in
      // components/pages/ui.tsx (not this lane's file) does not list it yet: this attribute
      // is spread after PageSection's own data-scene, so it wins.
      data-scene="faq"
      stage={stage as StageLayout}
      labelledBy={`${id}-heading`}
      className="pt-[38svh] lg:pt-28"
    >
      <FaqLayout
        side={stage}
        name={`${id}-list`}
        faqs={faqs}
        head={
          <div {...card()} className={`${panel} p-6 md:p-8`}>
            <SectionHead id={`${id}-heading`} index={index} kicker="faq" scene={FAQ_SCENE_NOTE} title={title} />
          </div>
        }
      />
    </PageSection>
  );
}
