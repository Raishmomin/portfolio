import { Accent, StatusDot, WithFigures } from "../../ui/primitives";
import { PageSection, PopPills, SectionHead, card, lit, part } from "../ui";
import { formatPeriod, periodMonths, periodParts } from "@/lib/derive";
import type { ExperienceItem } from "@/lib/data";
import { cn } from "@/lib/utils";

export function durationLabel(months: number | null): string | null {
  if (!months) return null;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return [y ? `${y} yr${y > 1 ? "s" : ""}` : "", m ? `${m} mo${m > 1 ? "s" : ""}` : ""].filter(Boolean).join(" ");
}

/**
 * The full timeline, "band" composition: the 3D career path owns the top of the viewport,
 * the roles hang off one spine that draws as you scroll. On desktop the role cards
 * alternate sides (left cards rise, right cards swing in from depth) with the period in
 * large type opposite; on phones it is one column. Newest first, as the ItemList.
 */
export function ExperienceTimeline({ roles }: { roles: ExperienceItem[] }) {
  return (
    <PageSection id="timeline" section="timeline" scene="experience" stage="band" labelledBy="timeline-heading" className="lg:pt-[46vh]">
      {/* The band above this panel is the 3D path's: the scene is framed into it. */}
      <div {...card()} data-stage-content="" className="panel p-6 md:p-8 lg:max-w-[46rem]">
        <SectionHead
          id="timeline-heading"
          index="01"
          kicker="timeline"
          title={
            <>
              Every role, <Accent>newest first.</Accent>
            </>
          }
          scene="The glowing path above is my career from oldest to newest: each milestone is a company, the ticks count the quarters I spent there, and the current role pulses green."
        />
      </div>

      <ol data-card-group="" className="relative mt-14 space-y-10 pl-9 lg:space-y-16 lg:pl-0">
        {/* The spine, drawn with scroll. */}
        <svg
          aria-hidden="true"
          data-draw=""
          viewBox="0 0 2 100"
          preserveAspectRatio="none"
          className="absolute bottom-0 left-[5px] top-0 h-full w-[2px] text-primary/60 lg:left-[calc(50%-1px)]"
        >
          <line x1="1" y1="0" x2="1" y2="100" stroke="currentColor" strokeWidth="2" />
        </svg>

        {roles.map((role, i) => {
          const { from, to, startDate, endDate, current } = periodParts(role.period);
          const duration = durationLabel(periodMonths(role.period));
          const right = i % 2 === 1;
          return (
            <li key={`${role.company}-${role.period}`} className="relative lg:grid lg:grid-cols-2 lg:gap-16">
              <span
                aria-hidden="true"
                className={cn(
                  "absolute -left-9 top-7 h-3 w-3 rounded-full border lg:left-[calc(50%-6px)]",
                  current
                    ? "border-ok bg-ok shadow-[0_0_0_5px_hsl(var(--ok)/0.18)]"
                    : "border-primary bg-background shadow-[0_0_0_5px_hsl(var(--primary)/0.12)]",
                )}
              />
              {/* Opposite the card: the period in large type (decorative; the card carries the dates). */}
              <p
                aria-hidden="true"
                className={cn(
                  "hidden pt-3 lg:block",
                  right ? "lg:col-start-1 lg:row-start-1 lg:text-right" : "lg:col-start-2 lg:row-start-1",
                )}
              >
                <span className="inline-block rounded-lg border border-border bg-background/85 px-4 py-2 font-mono text-[clamp(1.125rem,1.8vw,1.5rem)] uppercase leading-tight tracking-[0.06em] text-muted-foreground tabular-nums">
                  {formatPeriod(role.period)}
                </span>
              </p>
              <div {...card(right ? "swing" : "rise")} className={cn("min-w-0 lg:row-start-1", right ? "lg:col-start-2" : "lg:col-start-1")}>
                <article {...lit} className="panel p-6 md:p-8">
                  <p {...part} className="font-mono text-[13px] uppercase tracking-[0.14em] text-foreground tabular-nums">
                    {startDate ? <time dateTime={startDate}>{from}</time> : from}
                    {to ? (
                      <>
                        {" – "}
                        {endDate ? <time dateTime={endDate}>{to}</time> : to}
                      </>
                    ) : null}
                    <span className="mt-1.5 block text-xs text-muted-foreground">
                      {[duration, role.location].filter(Boolean).join(" · ")}
                    </span>
                  </p>
                  {current ? (
                    <p {...part} className="mt-3 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.14em] text-foreground">
                      <StatusDot />
                      Current role
                    </p>
                  ) : null}
                  <h3 {...part} className="mt-4 text-[clamp(1.25rem,2.2vw,1.75rem)] font-semibold leading-tight tracking-[-0.02em] text-foreground">
                    {role.title} <span className="font-normal text-muted-foreground">· {role.company}</span>
                  </h3>
                  {role.description ? (
                    <p {...part} className="mt-4 text-[17px] leading-7 text-muted-foreground">
                      {role.description}
                    </p>
                  ) : null}
                  {role.achievements.length ? (
                    <ul {...part} className="mt-6 space-y-2.5 text-[15px] leading-7 text-foreground/90 md:text-base">
                      {role.achievements.map((a) => (
                        <li key={a} className="dash-item">
                          <WithFigures text={a} />
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {role.technologies.length ? (
                    <PopPills items={role.technologies} label={`${role.company} stack`} className="mt-6" />
                  ) : null}
                </article>
              </div>
            </li>
          );
        })}
      </ol>
    </PageSection>
  );
}
