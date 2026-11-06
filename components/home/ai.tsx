// Home section "ai" (scene: an AI pipeline). Server Component. One [data-step] card per
// NeuralData.ai entry, in the same order, so the scene's step i is card i; each card's
// stage chips are exactly the stages drawn in 3D. The section is [data-pin]: on desktop
// the motion layer pins it and steps through the cards. Without JS (or with motion off)
// the cards are a plain horizontal scroll-snap track, every word server-rendered.
import Link from "next/link";
import { Accent, PillList } from "../ui/primitives";
import type { Project } from "@/lib/data";
import type { NeuralData } from "../neural";
import { cn } from "@/lib/utils";
import { firstSentence, liveLabel } from "./derive";
import { HomeSection, NeuralGlyph, SectionHead, aiBorder, aiText, panel, reveal } from "./ui";

export type AiStep = NeuralData["ai"][number] & { project: Project };

const EDGE_STAGES = new Set(["Input", "Output"]);

export function AiSection({ steps, total }: { steps: AiStep[]; total: number }) {
  if (!steps.length) return null;
  const count = String(steps.length).padStart(2, "0");
  return (
    <HomeSection id="ai" section="ai" labelledBy="ai-heading" scene data-pin="">
      <div className="flex flex-col gap-8 lg:min-h-[calc(100svh-14rem)] lg:justify-between">
        <div className={cn(panel, "p-6 md:p-8 lg:max-w-[34rem]")} {...reveal()}>
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

        <ol
          aria-label="AI projects"
          data-steps=""
          className="relative -mx-4 flex snap-x snap-proximity scroll-px-4 gap-4 overflow-x-auto px-4 pb-3 [scrollbar-width:thin] md:-mx-8 md:scroll-px-8 md:px-8"
        >
          {steps.map((s, i) => {
            const p = s.project;
            return (
              <li
                key={s.slug}
                data-step={String(i)}
                data-focus-id={s.slug}
                className="flex w-[min(84vw,21.5rem)] shrink-0 snap-start"
                {...reveal(Math.min(i, 4) * 80)}
              >
                <article className={cn(panel, "flex w-full flex-col p-5 transition-colors duration-150 hover:border-foreground/30 focus-within:border-primary")}>
                  <p className={cn("flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.14em] tabular-nums", aiText)}>
                    <span className="inline-flex items-center gap-2">
                      <NeuralGlyph />
                      AI project
                    </span>
                    <span className="text-muted-foreground">
                      {String(i + 1).padStart(2, "0")} / {count}
                    </span>
                  </p>
                  <h3 className="mt-3 text-lg font-semibold leading-6 tracking-[-0.015em] text-foreground">{s.title}</h3>
                  <p className="mt-2 line-clamp-3 text-[15px] leading-6 text-muted-foreground">{firstSentence(p.description)}</p>

                  <ol aria-label="Pipeline stages" className="mt-4 flex flex-wrap items-center gap-x-1 gap-y-1.5">
                    {s.stages.map((stage, j) => (
                      <li key={stage} className="inline-flex items-center gap-1">
                        {j > 0 ? (
                          <span aria-hidden="true" className="text-muted-foreground">
                            →
                          </span>
                        ) : null}
                        <span
                          className={cn(
                            "rounded-md border px-2 py-0.5 font-mono text-[11px] leading-5 tracking-[0.02em]",
                            EDGE_STAGES.has(stage) ? "border-border text-muted-foreground" : cn(aiBorder, aiText),
                          )}
                        >
                          {stage}
                        </span>
                      </li>
                    ))}
                  </ol>

                  {p.technologies.length ? (
                    <PillList
                      items={p.technologies.slice(0, 4)}
                      more={Math.max(0, p.technologies.length - 4)}
                      label="Technologies"
                      className="mt-4"
                    />
                  ) : null}

                  <div className="mt-auto flex flex-wrap gap-x-5 pt-4 text-sm">
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
