// The one FAQ markup of the site (home, /about, /contact, every service page). Server
// Component, no client JS: native <details>/<summary> (keyboard and screen readers as the
// platform gives them; one open at a time per list via `name`). Render the SAME FAQ array
// that feeds the page's FAQPage JSON-LD, so visible questions/answers and schema never drift.
// Each item carries what the FAQ scene draws (components/neural/scenes/faq.tsx), all derived
// from its own strings (faq-meta.ts): data-focus-id="faq:<topic>:<slug>", the figures quoted
// in its answer and its verdict word. CSS lives in app/globals.css (fm3-faq block).
import type { ReactNode } from "react";
import type { FAQ } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { faqMeta } from "./faq-meta";

const pad = (n: number) => String(n).padStart(2, "0");

/** The question cards; `name` groups them into one exclusive accordion. */
export function FaqItems({ faqs, name }: { faqs: FAQ[]; name: string }) {
  return (
    <ul data-card-group="" data-faq-list="" className="grid grid-cols-1 gap-3">
      {faqs.map((f, i) => {
        const m = faqMeta(f);
        return (
          <li key={f.q} data-card="">
            <details
              name={name}
              data-faq-item=""
              data-focus-id={m.id}
              data-faq-figures={m.figures.length ? JSON.stringify(m.figures) : undefined}
              data-faq-verdict={m.verdict ?? undefined}
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

/** The plain-language caption of the FAQ scene (the head's 3D note). */
export const FAQ_SCENE_NOTE = "Each question is a node beside its card. Open one and its answer becomes a picture made from real data: the career rings, the stack, live local time or the figures it quotes.";
