// Home section "ai" (scene: an AI pipeline). Server Component. One card per
// NeuralData.ai entry, in the same order, so the scene's step i is card i; each card's
// stage chips are exactly the stages drawn in 3D. "left" composition: the pipeline is
// framed on the right while the cards stack like a deck on the left ([data-deck], desktop):
// the top card's chips light input → output, the scene shows that project's pipeline.
// Without JS, with motion off and on phones the cards are a plain list.
import Link from "next/link";
import type { CSSProperties } from "react";
import { Accent, PillList } from "../ui/primitives";
import type { Project } from "@/lib/data";
import type { NeuralData } from "../neural";
import { cn } from "@/lib/utils";
import { firstSentence, liveLabel } from "./derive";
import { HomeSection, NeuralGlyph, SectionHead, aiBorder, aiText, column, panel } from "./ui";

export type AiStep = NeuralData["ai"][number] & { project: Project };

const EDGE_STAGES = new Set(["Input", "Output"]);

export function AiSection({ steps, total }: { steps: AiStep[]; total: number }) {
  if (!steps.length) return null;
  const count = String(steps.length).padStart(2, "0");
  return (
    <HomeSection id="ai" section="ai" stage="left" scene labelledBy="ai-heading">
      <div className={column.left}>
        <div data-card="" className={cn(panel, "p-6 md:p-8")}>
          <SectionHead
            id="ai-heading"
            index="03"
            kicker="ai"
            title={
              <>
                AI products, <Accent>stage by stage.</Accent>
              </>
            }
            scene="Each glowing node is one stage of an AI pipeline, such as speech-to-text, retrieval, the LLM or text-to-speech; the particles are data flowing through it. Scroll, or hover a project, to see its pipeline."
            lead={
              <>
                <span data-count={steps.length}>{steps.length}</span> of my {total} projects involve AI. Each card lists its
                pipeline stages, from input to output.
              </>
            }
          />
        </div>

        <ol aria-label="AI projects" data-deck="" data-card-group="" className="mt-4 flex flex-col gap-6">
          {steps.map((s, i) => {
            const p = s.project;
            return (
              <li key={s.slug} data-card="" data-focus-id={s.slug} className="relative">
                <article
                  data-ai-card=""
                  data-spotlight=""
                  className={cn(panel, "flex min-h-[21rem] w-full flex-col p-6 transition-colors duration-150 focus-within:border-primary")}
                >
                  <p
                    data-card-part=""
                    className={cn("flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.14em] tabular-nums", aiText)}
                  >
                    <span className="inline-flex items-center gap-2">
                      <NeuralGlyph />
                      AI project
                    </span>
                    <span className="text-muted-foreground">
                      {String(i + 1).padStart(2, "0")} / {count}
                    </span>
                  </p>
                  <h3 data-card-part="" className="mt-4 text-[22px] font-semibold leading-7 tracking-[-0.02em] text-foreground">
                    {s.title}
                  </h3>
                  <p data-card-part="" className="mt-2 line-clamp-3 text-[15px] leading-6 text-muted-foreground">
                    {firstSentence(p.description)}
                  </p>

                  <ol data-card-part="pop" aria-label="Pipeline stages" className="mt-5 flex flex-wrap items-center gap-x-1 gap-y-2">
                    {s.stages.map((stage, j) => (
                      <li key={stage} className="inline-flex items-center gap-1">
                        {j > 0 ? (
                          <span aria-hidden="true" className="text-muted-foreground">
                            →
                          </span>
                        ) : null}
                        <span
                          className={cn(
                            "stage-chip rounded-md border px-2 py-0.5 font-mono text-[11px] leading-5 tracking-[0.02em]",
                            EDGE_STAGES.has(stage) ? "border-border text-muted-foreground" : cn(aiBorder, aiText),
                          )}
                          style={{ "--k": j } as CSSProperties}
                        >
                          {stage}
                        </span>
                      </li>
                    ))}
                  </ol>

                  {p.technologies.length ? (
                    <div data-card-part="">
                      <PillList
                        items={p.technologies.slice(0, 5)}
                        more={Math.max(0, p.technologies.length - 5)}
                        label="Technologies"
                        className="mt-5"
                      />
                    </div>
                  ) : null}

                  <div data-card-part="" className="mt-auto flex flex-wrap gap-x-5 pt-4 text-sm">
                    {p.liveUrl ? (
                      <a
                        href={p.liveUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-11 min-w-11 items-center gap-1 font-medium text-foreground underline decoration-border underline-offset-4 transition-colors duration-150 hover:decoration-primary"
                      >
                        {liveLabel(p.liveUrl)}
                        <span className="sr-only"> site of {s.title} (opens in a new tab)</span>
                        <span aria-hidden="true">↗</span>
                      </a>
                    ) : null}
                    <Link
                      href={`/projects#${s.slug}`}
                      className="inline-flex min-h-11 items-center gap-1 text-muted-foreground transition-colors duration-150 hover:text-foreground"
                    >
                      Details<span className="sr-only"> on {s.title}</span>
                      <span aria-hidden="true">→</span>
                    </Link>
                  </div>
                </article>
              </li>
            );
          })}
        </ol>
      </div>
    </HomeSection>
  );
}
