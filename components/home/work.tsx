// Home section "work" (scene: one floating 3D card per featured project). Server
// Component. "full" composition: the scene is centred behind a scrim and the featured
// cards float over it across the full width, entering as a wave from depth. Cards carry
// data-focus-id (hover/focus lifts that project's 3D twin), tilt and a pointer
// spotlight; AI projects get the same neural glyph as their 3D twin. Below them, a
// numbered archive index of the rest, whose rows cascade in.
import Link from "next/link";
import { Accent, PillList } from "../ui/primitives";
import type { Project } from "@/lib/data";
import { cn, slugify } from "@/lib/utils";
import { isAiProject } from "../neural";
import { firstSentence, liveLabel, projectDomain } from "./derive";
import { HomeSection, NeuralGlyph, SectionHead, aiText, panel } from "./ui";

const stackOf = (p: Project, n: number) => p.technologies.slice(0, n).join(" / ");

export function WorkSection({ featured, archive }: { featured: Project[]; archive: Project[] }) {
  return (
    <HomeSection id="work" section="work" stage="full" scene labelledBy="work-heading">
      <div>
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
            scene="Each floating card is one of these projects. Hover a card to bring its 3D twin forward; cards with a neural glyph are AI projects."
          />
        </div>

        <ul data-card-group="" className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:mt-14 lg:grid-cols-3 lg:gap-5">
          {featured.map((p) => {
            const slug = slugify(p.title);
            const ai = isAiProject(p);
            return (
              <li key={slug} data-card="" className="flex">
                <article
                  data-focus-id={slug}
                  data-tilt=""
                  data-spotlight=""
                  className={cn(
                    panel,
                    "flex w-full flex-col p-5 transition-colors duration-150 hover:border-foreground/30 focus-within:border-primary",
                  )}
                >
                  <p data-card-part="" className="flex items-center justify-between gap-3 font-mono text-[11px] uppercase leading-5 tracking-[0.14em] text-muted-foreground">
                    <span className="truncate">
                      {projectDomain(p)} · {stackOf(p, 2)}
                    </span>
                    {ai ? (
                      <span className={cn("inline-flex shrink-0 items-center gap-1.5", aiText)}>
                        <NeuralGlyph />
                        AI
                      </span>
                    ) : null}
                  </p>
                  <h3 data-card-part="" className="mt-3 text-lg font-semibold leading-6 tracking-[-0.015em] text-foreground">
                    {p.title}
                  </h3>
                  <p data-card-part="" className="mt-2 line-clamp-3 text-[15px] leading-6 text-muted-foreground">
                    {firstSentence(p.description)}
                  </p>
                  {p.technologies.length ? (
                    <div data-card-part="">
                      <PillList
                        items={p.technologies.slice(0, 4)}
                        more={Math.max(0, p.technologies.length - 4)}
                        label="Technologies"
                        className="mt-4"
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
                        <span className="sr-only"> site of {p.title} (opens in a new tab)</span>
                        <span aria-hidden="true">↗</span>
                      </a>
                    ) : null}
                    <Link
                      href={`/projects#${slug}`}
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
        </ul>

        {archive.length ? (
          <div data-card="" className={cn(panel, "mt-4 p-6 md:p-8 lg:mt-5")}>
            <h3 data-card-part="" className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
              Archive · {archive.length} more projects
            </h3>
            <ol className="archive mt-4 grid grid-cols-1 border-t border-border lg:grid-cols-2 lg:gap-x-10">
              {archive.map((p, i) => {
                const slug = slugify(p.title);
                return (
                  <li key={slug} data-card-part="" className="border-b border-border">
                    {/* One kicker, placed by the grid: under the title on mobile, its own column from sm. */}
                    <Link
                      href={`/projects#${slug}`}
                      className="grid min-h-12 grid-cols-[2.25rem_1fr_auto] items-baseline gap-x-3 py-3 sm:grid-cols-[2.25rem_1fr_auto_1.25rem]"
                    >
                      <span className="font-mono text-xs text-muted-foreground tabular-nums">
                        {String(featured.length + i + 1).padStart(2, "0")}
                      </span>{" "}
                      <span className="min-w-0 text-[15px] font-medium leading-6 text-foreground">{p.title}</span>
                      <span className="col-start-2 row-start-2 font-mono text-[11px] uppercase leading-5 tracking-[0.12em] text-muted-foreground sm:col-start-3 sm:row-start-1">
                        {" "}
                        {projectDomain(p)} · {stackOf(p, 2)}
                      </span>
                      <span aria-hidden="true" className="archive-arrow col-start-3 row-start-1 text-muted-foreground sm:col-start-4">
                        ↗
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </div>
        ) : null}
      </div>
    </HomeSection>
  );
}
