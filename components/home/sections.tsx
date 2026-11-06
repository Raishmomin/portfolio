// Home scene sections "stack" and "experience". Server Components. Each mirrors its 3D
// scene in the DOM: skills carry the same ids as the constellation nodes (data-focus-id),
// and the career cards follow the same oldest→newest path, tenure bars sized by months.
import type { CSSProperties } from "react";
import Link from "next/link";
import { Accent, StatusDot, WithFigures } from "../ui/primitives";
import type { ExperienceItem } from "@/lib/data";
import { formatPeriod } from "@/lib/derive";
import { cn } from "@/lib/utils";
import { durationLabel, type SkillLayerGroup } from "./derive";
import { HomeSection, SectionHead, column, panel } from "./ui";

/** Track item width while the experience track runs horizontally (app/globals.css). */
const hsWidth = (w: string) => ({ "--hs-w": w }) as CSSProperties;

/**
 * "right" composition: the constellation is framed on the left, the layers float in on
 * the right as cards (a wave), their skill chips pop in, and hovering a chip lights its
 * node and connections in 3D.
 */
export function StackSection({ layers, linkCount }: { layers: SkillLayerGroup[]; linkCount: number }) {
  const total = layers.reduce((n, l) => n + l.skills.length, 0);
  return (
    <HomeSection id="stack" section="stack" stage="right" scene labelledBy="stack-heading">
      <div className={column.right}>
        <div data-card="" className={cn(panel, "p-6 md:p-8")}>
          <SectionHead
            id="stack-heading"
            index="01"
            kicker="stack"
            title={
              <>
                The stack, <Accent>as a network.</Accent>
              </>
            }
            scene="Each glowing node is a technology I use; lines connect tools I've combined in real projects. Hover a skill to light up its connections."
          />
          <p
            data-card-part=""
            className="mt-5 font-mono text-[11px] uppercase leading-5 tracking-[0.12em] text-muted-foreground tabular-nums"
          >
            <span data-count={total}>{total}</span> technologies · <span data-count={linkCount}>{linkCount}</span>{" "}
            connections from real projects · the number on a skill is how many projects use it
          </p>
        </div>
        <ul aria-label="Skills by layer" data-card-group="" className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {layers.map((l, i) => (
            <li
              key={l.layer}
              data-card=""
              data-skill-layer={l.layer}
              className={cn("flex", i === layers.length - 1 && layers.length % 2 === 1 && "sm:col-span-2")}
            >
              <article data-spotlight="" className={cn(panel, "w-full p-5")}>
                <h3
                  data-card-part=""
                  className="flex items-baseline justify-between border-b border-border pb-2 font-mono text-xs uppercase tracking-[0.14em] text-foreground"
                >
                  {l.label}
                  <span className="text-muted-foreground tabular-nums">{String(l.skills.length).padStart(2, "0")}</span>
                </h3>
                <ul data-card-part="pop" className="mt-3 flex flex-wrap gap-1.5">
                  {l.skills.map((s) => (
                    <li
                      key={s.id}
                      data-focus-id={s.id}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-[13px] leading-5 text-foreground transition-colors duration-150 hover:border-primary/60 hover:bg-accent"
                    >
                      {s.name}
                      {s.uses > 0 ? (
                        <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                          <span className="sr-only">, used in </span>
                          {s.uses}
                          <span className="sr-only"> {s.uses === 1 ? "project" : "projects"}</span>
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </article>
            </li>
          ))}
        </ul>
      </div>
    </HomeSection>
  );
}

export type CareerStop = ExperienceItem & { months: number; current: boolean };

/**
 * "band" composition: the 3D career path owns the top of the viewport and the roles
 * travel underneath it. On desktop the section pins and the track scrolls sideways
 * ([data-hscroll]): a rail lights stop by stop and each role swings in from depth. Without
 * motion (and on phones) it is a plain grid / vertical timeline, every word in the HTML.
 */
export function ExperienceSection({ items, years }: { items: CareerStop[]; years: number }) {
  const longest = Math.max(1, ...items.map((e) => e.months));
  return (
    <HomeSection
      id="experience"
      section="experience"
      stage="band"
      scene
      labelledBy="experience-heading"
      data-hscroll=""
    >
      <div data-hscroll-track="" data-card-group="" className="flex flex-col gap-5 lg:grid lg:grid-cols-3">
        <div data-card="" className={cn(panel, "p-6 md:p-8 lg:col-span-3")} style={hsWidth("27rem")}>
          <SectionHead
            id="experience-heading"
            index="02"
            kicker="experience"
            title={
              <>
                Career path, <Accent>milestone by milestone.</Accent>
              </>
            }
            scene="The glowing path is my career from oldest to newest. Each milestone is a company, spaced by how long I worked there, and the current role pulses."
          />
          <p
            aria-hidden="true"
            className="hs-hint mt-6 items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground"
          >
            Scroll to travel the path <span className="text-primary">→</span>
          </p>
        </div>

        {items.map((e) => (
          <article
            key={`${e.company}-${e.period}`}
            data-card=""
            aria-label={`${e.title} at ${e.company}`}
            className="relative flex flex-col pl-7 lg:pl-0"
            style={hsWidth("30rem")}
          >
            {/* Desktop rail through every stop (lit while the track scrolls). */}
            <div aria-hidden="true" className="exp-rail hidden lg:block">
              <span className="exp-rail-fill" />
              <span className="exp-node" data-current={e.current ? "" : undefined} />
            </div>
            {/* Phone timeline: drawn as you scroll. */}
            <svg
              aria-hidden="true"
              data-draw=""
              viewBox="0 0 2 100"
              preserveAspectRatio="none"
              className="absolute left-[4px] top-3 h-[calc(100%+0.5rem)] w-[2px] text-primary/70 lg:hidden"
            >
              <line x1="1" y1="0" x2="1" y2="100" stroke="currentColor" strokeWidth="2" />
            </svg>
            <span
              aria-hidden="true"
              className={cn(
                "absolute left-0 top-1.5 h-[10px] w-[10px] rounded-full border lg:hidden",
                e.current ? "border-ok bg-ok" : "border-primary bg-primary",
              )}
            />
            <div data-spotlight="" className={cn(panel, "flex flex-1 flex-col p-5 md:p-6 lg:mt-3")}>
              <p
                data-card-part=""
                className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs uppercase leading-6 tracking-[0.14em] text-muted-foreground tabular-nums"
              >
                {formatPeriod(e.period)}
                <span aria-hidden="true">·</span>
                <span>{durationLabel(e.months)}</span>
                {e.current ? (
                  <span className="inline-flex items-center gap-1.5 text-foreground">
                    <StatusDot /> Now
                  </span>
                ) : null}
              </p>
              <h3 data-card-part="" className="mt-2 text-xl font-semibold leading-7 tracking-[-0.015em] text-foreground">
                {e.title} <span className="font-normal text-muted-foreground">· {e.company}</span>
              </h3>
              {/* Tenure ∝ months, as on the 3D path. */}
              <span data-card-part="" aria-hidden="true" className="mt-3 block h-0.5 rounded-full bg-border">
                <span
                  className={cn("block h-full rounded-full", e.current ? "bg-ok" : "bg-primary/70")}
                  style={{ width: `${Math.round((e.months / longest) * 100)}%` }}
                />
              </span>
              {e.description ? (
                <p data-card-part="" className="mt-3 text-[15px] leading-6 text-muted-foreground">
                  <WithFigures text={e.description} />
                </p>
              ) : null}
              {e.achievements.length ? (
                <ul data-card-part="" className="mt-3 space-y-1.5">
                  {e.achievements.map((a) => (
                    <li key={a} className="dash-item text-[15px] leading-6 text-muted-foreground">
                      <WithFigures text={a} />
                    </li>
                  ))}
                </ul>
              ) : null}
              {e.technologies.length ? (
                <ul data-card-part="pop" aria-label="Technologies" className="mt-auto flex flex-wrap gap-1.5 pt-4">
                  {e.technologies.map((t) => (
                    <li key={t} className="pill">
                      {t}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </article>
        ))}

        <div
          data-card=""
          className={cn(panel, "flex flex-col justify-between gap-6 p-6 md:p-8 lg:col-span-3 lg:mt-9")}
          style={hsWidth("21rem")}
        >
          <p data-card-part="" className="text-[clamp(1.25rem,2vw,1.625rem)] font-medium leading-snug tracking-[-0.02em] text-foreground">
            {years}+ years, {items.length} roles, <Accent>one path.</Accent>
          </p>
          <Link
            data-card-part=""
            href="/experience"
            className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-medium text-foreground underline decoration-border underline-offset-4 transition-colors duration-150 hover:decoration-primary"
          >
            Full experience <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </HomeSection>
  );
}
