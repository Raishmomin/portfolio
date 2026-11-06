// Home scene sections "stack" and "experience". Server Components. Each mirrors its 3D
// scene in the DOM: skills carry the same ids as the constellation nodes (data-focus-id),
// and the career list is drawn as the same oldest→newest path with segments sized by months.
import { Accent, StatusDot, WithFigures } from "../ui/primitives";
import type { ExperienceItem } from "@/lib/data";
import { formatPeriod } from "@/lib/derive";
import { cn } from "@/lib/utils";
import { durationLabel, type SkillLayerGroup } from "./derive";
import { HomeSection, SectionHead, panel, reveal } from "./ui";

export function StackSection({ layers, linkCount }: { layers: SkillLayerGroup[]; linkCount: number }) {
  const total = layers.reduce((n, l) => n + l.skills.length, 0);
  return (
    <HomeSection id="stack" section="stack" labelledBy="stack-heading" scene>
      <div className={cn(panel, "p-6 md:p-8 lg:max-w-[36rem]")} {...reveal()}>
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
        <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground tabular-nums">
          <span data-count={total}>{total}</span> technologies · <span data-count={linkCount}>{linkCount}</span>{" "}
          connections from real projects
        </p>
        <div className="mt-6 grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2">
          {layers.map((l) => (
            <div key={l.layer} data-skill-layer={l.layer}>
              <h3 className="flex items-baseline justify-between border-b border-border pb-2 font-mono text-xs uppercase tracking-[0.14em] text-foreground">
                {l.label}
                <span className="text-muted-foreground tabular-nums">{String(l.skills.length).padStart(2, "0")}</span>
              </h3>
              <ul className="mt-2">
                {l.skills.map((s) => (
                  <li
                    key={s.id}
                    data-focus-id={s.id}
                    className="flex items-baseline justify-between gap-x-3 rounded px-1 py-1 text-[15px] leading-6 text-foreground transition-colors duration-150 hover:bg-accent"
                  >
                    {s.name}{" "}
                    {s.uses > 0 ? (
                      <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground tabular-nums">
                        {s.uses} {s.uses === 1 ? "project" : "projects"}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </HomeSection>
  );
}

export type CareerStop = ExperienceItem & { months: number; current: boolean };

export function ExperienceSection({ items }: { items: CareerStop[] }) {
  const longest = Math.max(1, ...items.map((e) => e.months));
  return (
    <HomeSection id="experience" section="experience" labelledBy="experience-heading" scene>
      <div className={cn(panel, "p-6 md:p-8 lg:max-w-[38rem]")} {...reveal()}>
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
        <ol className="relative mt-8 border-l border-border pl-6">
          {items.map((e, i) => (
            <li key={`${e.company}-${e.period}`} className="relative pb-8 last:pb-0" {...reveal(i * 90)}>
              <span
                aria-hidden="true"
                className={cn(
                  "absolute -left-[calc(1.5rem+5px)] top-1.5 h-[9px] w-[9px] rounded-full border",
                  e.current ? "border-primary bg-primary" : "border-muted-foreground bg-background",
                )}
              />
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs uppercase leading-6 tracking-[0.14em] text-muted-foreground tabular-nums">
                {formatPeriod(e.period)}
                <span aria-hidden="true">·</span>
                <span>{durationLabel(e.months)}</span>
                {e.current ? (
                  <span className="inline-flex items-center gap-1.5 text-foreground">
                    <StatusDot /> Now
                  </span>
                ) : null}
              </p>
              {/* Segment length ∝ months, as on the 3D path. */}
              <span aria-hidden="true" className="mt-2 block h-0.5 rounded-full bg-border">
                <span
                  className={cn("block h-full rounded-full", e.current ? "bg-primary" : "bg-muted-foreground/60")}
                  style={{ width: `${Math.round((e.months / longest) * 100)}%` }}
                />
              </span>
              <h3 className="mt-3 text-xl font-semibold leading-7 tracking-[-0.015em] text-foreground">
                {e.title} <span className="font-normal text-muted-foreground">· {e.company}</span>
              </h3>
              {e.description ? (
                <p className="mt-2 text-[15px] leading-6 text-muted-foreground">
                  <WithFigures text={e.description} />
                </p>
              ) : null}
              {e.achievements.length ? (
                <ul className="mt-3 space-y-1.5">
                  {e.achievements.map((a) => (
                    <li key={a} className="dash-item text-[15px] leading-6 text-muted-foreground">
                      <WithFigures text={a} />
                    </li>
                  ))}
                </ul>
              ) : null}
              {e.technologies.length ? (
                <p className="mt-3 font-mono text-[11px] uppercase leading-5 tracking-[0.12em] text-muted-foreground">
                  {e.technologies.join(" · ")}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      </div>
    </HomeSection>
  );
}
