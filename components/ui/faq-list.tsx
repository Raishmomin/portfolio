// The one FAQ markup of the site (home, /about, /contact, every service page). Server
// Component, no client JS: native <details>/<summary> (keyboard and screen readers as the
// platform gives them; one open at a time per list via `name`). Render the SAME FAQ array
// that feeds the page's FAQPage JSON-LD, so visible questions/answers and schema never drift.
// Each item carries what the FAQ scene draws (components/neural/scenes/faq.tsx), all derived
// from its own strings (faq-meta.ts): data-focus-id="faq:<topic>:<slug>" and data-faq (the
// figures quoted in its answer, its verdict word, its steps or list, the alternatives it
// weighs). Below lg an empty slot after the open card is where the scene draws its answer.
// CSS lives in app/globals.css (fm3-faq block).
import type { ReactNode } from "react";
import type { FAQ } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { SceneNote } from "../home/ui";
import { faqMeta } from "./faq-meta";

const pad = (n: number) => String(n).padStart(2, "0");

/** The question cards; `name` groups them into one exclusive accordion. */
export function FaqItems({ faqs, name }: { faqs: FAQ[]; name: string }) {
  return (
    <ul data-card-group="" data-faq-list="" className="grid grid-cols-1 gap-3">
      {faqs.map((f, i) => {
        const m = faqMeta(f);
        // Only what the scene draws (short keys: it is inlined once per question).
        const scene = { f: m.figures, v: m.verdict, s: m.steps, l: m.list, h: m.title, o: m.options };
        return (
          <li key={f.q} data-card="" className="faq-li">
            <details
              name={name}
              data-faq-item=""
              data-focus-id={m.id}
              data-faq={JSON.stringify(scene)}
              data-spotlight=""
              className="panel faq faq-card group"
            >
              <summary className="faq-q flex min-h-12 cursor-pointer list-none items-start gap-4 rounded-xl px-5 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background [&::-webkit-details-marker]:hidden">
                <span aria-hidden="true" className="faq-i mt-[3px] shrink-0 font-mono text-[11px] leading-5 tracking-[0.12em] text-muted-foreground tabular-nums">
                  {pad(i + 1)}
                </span>
                <h3 className="min-w-0 flex-1 text-[17px] font-medium leading-6 tracking-[-0.01em] text-foreground">{f.q}</h3>
                <span aria-hidden="true" className="faq-x mt-0.5 shrink-0 font-mono text-lg leading-5 text-muted-foreground">
                  +
                </span>
              </summary>
              <div className="faq-a">
                <p className="max-w-[62ch] pb-5 pl-[3.25rem] pr-5 text-[15px] leading-6 text-muted-foreground">{f.a}</p>
              </div>
            </details>
            <div aria-hidden="true" data-faq-pic="" className="faq-pic" />
          </li>
        );
      })}
    </ul>
  );
}

/**
 * FAQ composition: the head and the cards in one column, and beside them (desktop) an
 * empty sticky window the FAQ scene draws into, so the 3D never sits under the text.
 * `side` = where the content sits (the section's data-stage: left or right).
 */
export function FaqLayout({ side, head, faqs, name }: { side: "left" | "right"; head: ReactNode; faqs: FAQ[]; name: string }) {
  return (
    <div className={cn("faq-grid lg:grid lg:gap-x-12", side === "left" ? "faq-l lg:grid-cols-[minmax(0,38rem)_minmax(0,1fr)]" : "faq-r lg:grid-cols-[minmax(0,1fr)_minmax(0,40rem)]")}>
      <div className={cn("min-w-0", side === "right" && "lg:col-start-2 lg:row-start-1")}>
        {head}
        <div className="mt-4">
          <FaqItems faqs={faqs} name={name} />
        </div>
      </div>
      <div aria-hidden="true" className={cn("faq-win-col hidden lg:block", side === "right" && "lg:col-start-1 lg:row-start-1")}>
        <div className="faq-win-track">
          <div data-faq-window="" className="faq-win" />
        </div>
      </div>
    </div>
  );
}

/** The plain-language caption of the FAQ scene (the head's 3D note; hidden when 3D is off). */
export const FAQ_SCENE_NOTE =
  "Every question is a numbered node in the scene. Open one and its answer becomes a picture made from real data right beside it: the career rings, the stack, live local time, or the figures, steps and choices it states.";
/** Below lg only the pictures that read without words open under their card. */
export const FAQ_SCENE_NOTE_SMALL =
  "Every question is a node in the scene above. Open the experience, stack or availability question and its picture, made from real data, opens right under the answer.";

/** The FAQ head's 3D note (its own class, so CSS can drop it when the 3D is off). */
export function FaqNote() {
  return (
    <SceneNote className="faq-note">
      <span className="hidden lg:inline">{FAQ_SCENE_NOTE}</span>
      <span className="lg:hidden">{FAQ_SCENE_NOTE_SMALL}</span>
    </SceneNote>
  );
}
