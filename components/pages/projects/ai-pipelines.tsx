// /projects "AI" band: every AI project (isAiProject, the same rule as the home AI scene)
// as a card with its real pipeline stages, input → output. Each card focuses its 3D
// system (data-focus-id = slug; its stage pills, data-ai-stage, light as the 3D request
// passes) and links to the project's full card below. On desktop the cards stack as a
// deck while you scroll (data-deck), like the home AI section; on phones the section opens
// with a window onto the 3D system (pt-[34svh], up to lg: the scene's phone framing runs
// below 1024 px), as the home scene sections do, captioned with the project it draws.
import type { NeuralData } from "../../neural";
import { Accent } from "../../ui/primitives";
import { AiCaption } from "../../home/ai";
import { NeuralGlyph } from "../ai-badge";
import { PageSection, SectionHead, aiText, card, column, part, pop } from "../ui";
import { cn } from "@/lib/utils";

export function AiPipelines({ ai, total }: { ai: NeuralData["ai"]; total: number }) {
  if (!ai.length) return null;
  return (
    <PageSection id="ai" section="ai" scene="ai" stage="left" labelledBy="ai-heading" className="pt-[34svh] md:pt-[34svh] lg:pt-28">
      <div className={cn(column.left, "relative")}>
        <AiCaption slug={ai[0].slug} title={ai[0].title} stages={ai[0].stages} />
        <div {...card()} className="panel p-6 md:p-8">
          <SectionHead
            id="ai-heading"
            index="01"
            kicker="ai"
            title={
              <>
                {ai.length} of {total} projects <Accent>use AI.</Accent>
              </>
            }
            scene="The 3D draws each AI project as a working system: a request runs from the input through its real stages to the answer, and the project's stages light as it passes. With a mouse, hover a project to rebuild its system, or one of its stages to hold the request there."
          />
        </div>
        <ol aria-label="AI projects" data-deck="" data-card-group="" className="mt-4 flex flex-col gap-4">
          {ai.map((p, i) => (
            <li key={p.slug} {...card()} className="relative">
              {/* Spotlight only: in the deck the card's inner surface carries the CSS scale. */}
              <a
                href={`#${p.slug}`}
                data-focus-id={p.slug}
                data-spotlight=""
                className="panel group block p-5 transition-colors duration-150 hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span {...part} className="flex items-center justify-between gap-4">
                  <span className="text-lg font-semibold leading-6 tracking-[-0.015em] text-foreground group-hover:text-primary">
                    {p.title}
                  </span>
                  <span className={cn("inline-flex shrink-0 items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em]", aiText)}>
                    <NeuralGlyph />
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </span>
                <ul {...pop} aria-label={`${p.title} pipeline`} className="mt-3 flex flex-wrap items-center gap-1.5">
                  {p.stages.map((s, k) => (
                    <li key={s} className="flex items-center gap-1.5">
                      {k > 0 ? <span aria-hidden="true" className="text-muted-foreground">→</span> : null}
                      <span data-ai-stage={s} className="pill normal-case tracking-normal">
                        {s}
                      </span>
                    </li>
                  ))}
                </ul>
              </a>
            </li>
          ))}
        </ol>
      </div>
    </PageSection>
  );
}
