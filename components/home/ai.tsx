// Home section "ai" (scene: each project's AI system). Server Component. One card per
// NeuralData.ai entry, in the same order, so the scene's step i is card i; each card's
// stage chips (data-ai-stage) are exactly the stages drawn in 3D, and its "Models / Vector
// DB / Framework" line names the technologies the 3D labels repeat. "left" composition: the
// system is framed on the right while the cards stack like a deck on the left ([data-deck],
// desktop): the top card's project is drawn, and its chips light as the request reaches
// each stage. Without JS, with motion off and on phones the cards are a plain list. On
// phones (no 3D labels there) an aria-hidden caption under the section's opening names the
// system drawn in it (the first project) while the 3D runs, its stages lighting in step.
import Link from "next/link";
import type { CSSProperties } from "react";
import { Accent, PillList } from "../ui/primitives";
import type { Project } from "@/lib/data";
import type { NeuralData } from "../neural";
import { cn } from "@/lib/utils";
import { firstSentence, liveLabel } from "./derive";
import { HomeSection, NeuralGlyph, SectionHead, aiBorder, aiText, column, panel } from "./ui";
import { aiRoles } from "../neural/scenes/ai/system";

export type AiStep = NeuralData["ai"][number] & { project: Project };

const EDGE_STAGES = new Set(["Input", "Output"]);

/**
 * Phones: the first project's name and stages at the foot of the AI section's opening (the
 * 3D draws that project there). A decorative duplicate of its card (aria-hidden), shown only
 * while the 3D runs ([data-ai-sync], app/globals.css fm3-ai); its chips light in step.
 */
export function AiCaption({ slug, title, stages }: { slug: string; title: string; stages: string[] }) {
  const llm = stages.findIndex((x) => /\bllm\b/i.test(x));
  return (
    <p
      aria-hidden="true"
      data-ai-caption={slug}
      className="ai-caption pointer-events-none absolute inset-x-0 bottom-full mb-3 flex flex-col items-center gap-1.5 text-center lg:hidden"
    >
      <span className="font-mono text-[11px] uppercase leading-4 tracking-[0.16em] text-foreground">● {title}</span>
      <span className="flex flex-wrap items-center justify-center gap-[3px] font-mono text-[10px] leading-4 text-muted-foreground">
        {stages.map((stage, j) => (
          <span key={stage} className="inline-flex items-center gap-[3px]">
            {j > 0 ? "→" : null}
            <span data-ai-stage={stage} data-ai-tone={llm >= 0 && j > llm ? "out" : undefined} className="rounded border border-border bg-background/70 px-1">
              {stage}
            </span>
          </span>
        ))}
      </span>
    </p>
  );
}

export function AiSection({ steps, total }: { steps: AiStep[]; total: number }) {
  if (!steps.length) return null;
  const count = String(steps.length).padStart(2, "0");
  return (
    <HomeSection id="ai" section="ai" stage="left" scene labelledBy="ai-heading">
      <div className={cn(column.left, "relative")}>
        <AiCaption slug={steps[0].slug} title={steps[0].title} stages={steps[0].stages} />
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
            scene="The 3D draws the current project's AI system answering one request: the prompt is typed, retrieval lights the closest matches in the vector store, an agent calls its tools, the model writes the answer token by token and the answer card fills in. The card's stage chips light in step; with a mouse, hover a stage to hold the request there."
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
            const roles = aiRoles(s.stages, p.technologies ?? []);
            const llm = s.stages.findIndex((x) => /\bllm\b/i.test(x));
            const built = [
              ["Models", roles.models],
              ["Vector DB", roles.stores],
              ["Framework", roles.frameworks],
              ["Speech", roles.speech],
            ].filter(([, list]) => list.length) as [string, string[]][];
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
                          data-ai-stage={stage}
                          data-ai-tone={llm >= 0 && j > llm ? "out" : undefined}
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

                  {built.length ? (
                    <dl data-card-part="" className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] leading-5">
                      {built.map(([label, list]) => (
                        <div key={label} className="flex gap-1.5">
                          <dt className="text-muted-foreground">{label}</dt>
                          <dd className="text-foreground">{list.join(" · ")}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}

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
