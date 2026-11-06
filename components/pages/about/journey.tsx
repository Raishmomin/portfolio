import Link from "next/link";
import type { CSSProperties } from "react";
import { Accent } from "../../ui/primitives";
import { PageSection, SectionHead, card, lit, part } from "../ui";
import { TEXT_LINK } from "./subpage";
import { durationLabel } from "../experience/timeline";
import { formatPeriod, periodMonths, periodParts } from "@/lib/derive";
import { sortRoles } from "@/lib/llms";
import type { ExperienceItem } from "@/lib/data";
import { cn } from "@/lib/utils";

/**
 * Career at a glance, "band" composition: the 3D career path owns the top of the viewport;
 * underneath, the roles run oldest → newest on one line that draws as you scroll (vertical
 * on phones), each role a card that rises in on its stop. Same roles as /experience.
 */
export function CareerJourney({ experience }: { experience: ExperienceItem[] }) {
  const roles = [...sortRoles(experience)].reverse();
  if (!roles.length) return null;
  return (
    <PageSection id="journey" section="journey" scene="experience" stage="band" labelledBy="journey-heading">
      <div className="panel p-6 md:p-8 lg:max-w-[46rem]" {...card()}>
        <SectionHead
          id="journey-heading"
          index="02"
          kicker="journey"
          title={
            <>
              {roles.length} roles, <Accent>one path.</Accent>
            </>
          }
          scene="The glowing path above is my career from oldest to newest; each milestone is a company, spaced by how long I worked there."
        />
      </div>

      <ol
        data-card-group=""
        style={{ "--n": roles.length } as CSSProperties}
        className="relative mt-10 grid grid-cols-1 gap-5 pl-7 lg:grid-cols-[repeat(var(--n),minmax(0,1fr))] lg:pl-0 lg:pt-8"
      >
        {/* The line through every stop: horizontal on desktop, vertical on phones. Drawn on scroll. */}
        <svg
          aria-hidden="true"
          data-draw=""
          viewBox="0 0 100 2"
          preserveAspectRatio="none"
          className="absolute inset-x-0 top-[11px] hidden h-[2px] w-full text-primary/70 lg:block"
        >
          <line x1="0" y1="1" x2="100" y2="1" stroke="currentColor" strokeWidth="2" />
        </svg>
        <svg
          aria-hidden="true"
          data-draw=""
          viewBox="0 0 2 100"
          preserveAspectRatio="none"
          className="absolute bottom-2 left-[4px] top-2 h-[calc(100%-1rem)] w-[2px] text-primary/70 lg:hidden"
        >
          <line x1="1" y1="0" x2="1" y2="100" stroke="currentColor" strokeWidth="2" />
        </svg>

        {roles.map((role) => {
          const { current } = periodParts(role.period);
          const duration = durationLabel(periodMonths(role.period));
          return (
            <li key={`${role.company}-${role.period}`} {...card()} className="relative">
              <span
                aria-hidden="true"
                className={cn(
                  "absolute -left-7 top-5 h-[10px] w-[10px] rounded-full border lg:-top-[25px] lg:left-5",
                  current ? "border-ok bg-ok shadow-[0_0_0_4px_hsl(var(--ok)/0.18)]" : "border-primary bg-primary shadow-[0_0_0_4px_hsl(var(--primary)/0.16)]",
                )}
              />
              <article {...lit} className="panel h-full p-5">
                <p {...part} className="font-mono text-[11px] uppercase leading-5 tracking-[0.14em] text-muted-foreground tabular-nums">
                  {formatPeriod(role.period)}
                  {duration ? <span className="block">{duration}</span> : null}
                </p>
                <h3 {...part} className="mt-3 text-lg font-semibold leading-6 tracking-[-0.015em] text-foreground">
                  {role.title}
                </h3>
                <p {...part} className="mt-1 text-[15px] leading-6 text-muted-foreground">
                  {role.company}
                  {current ? (
                    <span className="ml-2 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-ok">
                      <span aria-hidden="true">●</span> now
                    </span>
                  ) : null}
                </p>
              </article>
            </li>
          );
        })}
      </ol>
      <p className="mt-8">
        <Link href="/experience" className={`inline-flex min-h-11 items-center text-sm font-medium text-foreground ${TEXT_LINK}`}>
          Every role, with results <span aria-hidden="true" className="ml-1">→</span>
        </Link>
      </p>
    </PageSection>
  );
}
