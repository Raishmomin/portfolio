// Home section "work" (scene: the active project's architecture, built from its stack).
// Server Component. "full" composition with a clear scene window: on desktop the projects
// zig-zag down both sides of a sticky, empty centre column where the 3D sits, so the
// architecture is never under a card. Scrolling makes the project at the reading line the
// active one (the motion runtime's architecture spy, [data-arch]); hovering or focusing a
// card switches to it at once, and hovering a technology chip lights its node. Every card
// lists its real stack grouped by tier (client, server, data, infra, AI), the same groups
// the 3D draws. Featured projects get full cards, the rest compact ones; all of them drive
// the scene. Phones, no-JS and motion off: one plain column of cards (phones: the archive
// is one swipeable row).
import type { CSSProperties } from "react";
import Link from "next/link";
import { Accent, Container } from "../ui/primitives";
import type { Project } from "@/lib/data";
import type { NeuralData } from "../neural/types";
import { cn } from "@/lib/utils";
import { TierStack } from "../pages/projects/tier-stack";
import { firstSentence, liveLabel, projectDomain } from "./derive";
import { NeuralGlyph, SectionHead, aiText, panel } from "./ui";

export type WorkItem = NeuralData["work"][number] & { project: Project };

const nn = (n: number) => String(n).padStart(2, "0");
const row = (i: number) => ({ "--r": i + 1 }) as CSSProperties;

function AiMark() {
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5", aiText)}>
      <NeuralGlyph />
      AI
    </span>
  );
}

export function WorkSection({ items }: { items: WorkItem[] }) {
  const featured = items.filter((w) => w.featured);
  const archive = items.filter((w) => !w.featured);
  return (
    <section id="work" data-section="work" data-stage="full" aria-labelledby="work-heading" className="relative pb-20 pt-[38svh] lg:pb-28 lg:pt-28">
      <Container className="relative lg:max-w-[1560px]">
        <div data-card="">
          <SectionHead
            center
            id="work-heading"
            index="04"
            kicker="work"
            title={
              <>
                Selected work, <Accent>end to end.</Accent>
              </>
            }
            scene="The 3D is the architecture of the project you are reading, built from its real tech stack: client, server and data layers, plus AI and infra when the project uses them. Scroll or hover a project to rebuild it; hover a technology to light its node."
          />
        </div>

        <div data-arch="" className="arch relative mt-10 lg:mt-14">
          <div aria-hidden="true" className="arch-win-col">
            <div data-arch-window="" className="arch-win" />
          </div>

          <ol data-card-group="" aria-label="Featured projects" className="arch-zig grid grid-cols-1 gap-4">
            {featured.map((w, i) => {
              const p = w.project;
              return (
                <li key={w.slug} data-card="" data-arch-item="" data-focus-id={w.slug} style={row(i)} className="arch-step flex">
                  <article
                    data-tilt=""
                    data-spotlight=""
                    className={cn(panel, "flex w-full flex-col p-5 transition-colors duration-150 hover:border-foreground/30 focus-within:border-primary xl:p-6")}
                  >
                    <p
                      data-card-part=""
                      className="flex items-center justify-between gap-3 font-mono text-[11px] uppercase leading-5 tracking-[0.14em] text-muted-foreground tabular-nums"
                    >
                      <span className="truncate">
                        <span className="text-foreground">{nn(i + 1)}</span> · {projectDomain(p)}
                      </span>
                      {w.ai ? <AiMark /> : null}
                    </p>
                    <h3 data-card-part="" className="mt-3 text-lg font-semibold leading-6 tracking-[-0.015em] text-foreground">
                      {p.title}
                    </h3>
                    <p data-card-part="" className="mt-2 line-clamp-3 text-[15px] leading-6 text-muted-foreground">
                      {firstSentence(p.description)}
                    </p>
                    <TierStack stack={w.stack} className="mt-4" />
                    <div data-card-part="" className="mt-auto flex flex-wrap gap-x-5 pt-3 text-sm">
                      {p.liveUrl ? (
                        <a
                          href={p.liveUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-11 min-w-11 items-center gap-1 font-medium text-foreground underline decoration-border underline-offset-4 transition-colors duration-150 hover:decoration-primary"
                        >
                          {liveLabel(p.liveUrl)}
                          <span className="sr-only"> site of {p.title} (opens in a new tab)</span>
                          <span aria-hidden="true">↗</span>
                        </a>
                      ) : null}
                      <Link
                        href={`/projects#${w.slug}`}
                        className="inline-flex min-h-11 items-center gap-1 text-muted-foreground transition-colors duration-150 hover:text-foreground"
                      >
                        Details<span className="sr-only"> on {p.title}</span>
                        <span aria-hidden="true">→</span>
                      </Link>
                    </div>
                  </article>
                </li>
              );
            })}
          </ol>

          {archive.length ? (
            <>
              <h3 className="arch-sub mb-4 mt-10 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground lg:mt-8">
                Archive · {archive.length} more projects
              </h3>
              {/* Phones: one swipeable row (the archive would take four screens as a column). */}
              <ol
                data-card-group=""
                aria-label="More projects"
                className="arch-zig grid grid-cols-1 gap-3 sm:grid-cols-2 max-lg:-mx-4 max-lg:flex max-lg:snap-x max-lg:snap-mandatory overflow-x-auto max-lg:scroll-px-4 lg:overflow-visible max-lg:px-4 max-lg:pb-2 md:max-lg:-mx-8 md:max-lg:scroll-px-8 md:max-lg:px-8"
              >
                {archive.map((w, i) => {
                  const p = w.project;
                  return (
                    <li
                      key={w.slug}
                      data-card="flip"
                      data-arch-item=""
                      data-focus-id={w.slug}
                      style={row(i)}
                      className="arch-step arch-mini flex max-lg:w-[min(20rem,80vw)] max-lg:shrink-0 max-lg:snap-start"
                    >
                      <article
                        data-spotlight=""
                        className={cn(panel, "flex w-full flex-col p-4 transition-colors duration-150 hover:border-foreground/30 focus-within:border-primary")}
                      >
                        <p className="flex items-center justify-between gap-3 font-mono text-[11px] uppercase leading-5 tracking-[0.12em] text-muted-foreground tabular-nums">
                          <span className="truncate">
                            <span className="text-foreground">{nn(featured.length + i + 1)}</span> · {projectDomain(p)}
                          </span>
                          {w.ai ? <AiMark /> : null}
                        </p>
                        <h4 className="mt-1 text-[15px] font-medium leading-6 text-foreground">
                          <Link
                            href={`/projects#${w.slug}`}
                            className="inline-flex min-h-11 items-center gap-1.5 transition-colors duration-150 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {p.title}
                            <span aria-hidden="true" className="text-muted-foreground">
                              ↗
                            </span>
                          </Link>
                        </h4>
                        <TierStack stack={w.stack} compact />
                      </article>
                    </li>
                  );
                })}
              </ol>
            </>
          ) : null}
        </div>
      </Container>
    </section>
  );
}
