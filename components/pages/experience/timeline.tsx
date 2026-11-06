import { Container, PillList, Section, StatusDot, WithFigures } from "../../ui/primitives";
import { revealProps } from "../../reveal";
import { periodMonths, periodParts } from "@/lib/derive";
import type { ExperienceItem } from "@/lib/data";

function durationLabel(months: number | null): string | null {
  if (!months) return null;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return [y ? `${y} yr${y > 1 ? "s" : ""}` : "", m ? `${m} mo${m > 1 ? "s" : ""}` : ""].filter(Boolean).join(" ");
}

/** Timeline rows: mono date column, Role · Company, description, achievements, tech pills. */
export function ExperienceTimeline({ roles }: { roles: ExperienceItem[] }) {
  return (
    <Section section="experience" id="timeline" aria-label="Experience timeline" className="py-0 md:py-0">
      <Container>
        <ol>
          {roles.map((role, i) => {
            const { from, to, startDate, endDate, current } = periodParts(role.period);
            const duration = durationLabel(periodMonths(role.period));
            return (
              <li
                key={`${role.company}-${role.period}`}
                className="grid gap-5 border-b border-border py-10 last:border-b-0 md:grid-cols-12 md:gap-8 md:py-14"
                {...revealProps({ y: 12, delay: Math.min(i, 3) * 0.05 })}
              >
                <div className="md:col-span-4 lg:col-span-3">
                  <p className="font-mono text-[13px] uppercase tracking-[0.14em] text-foreground tabular-nums">
                    {startDate ? <time dateTime={startDate}>{from}</time> : from}
                    {to ? (
                      <>
                        {" \u2013 "}
                        {endDate ? <time dateTime={endDate}>{to}</time> : to}
                      </>
                    ) : null}
                  </p>
                  <p className="mt-2 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground tabular-nums">
                    {[duration, role.location].filter(Boolean).join(" · ")}
                  </p>
                  {current ? (
                    <p className="mt-3 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.14em] text-foreground">
                      <StatusDot />
                      Current role
                    </p>
                  ) : null}
                </div>

                <article className="min-w-0 md:col-span-8 lg:col-span-9">
                  <h2 className="text-[clamp(1.25rem,2.2vw,1.75rem)] font-semibold leading-tight tracking-[-0.02em] text-foreground">
                    {role.title} <span className="font-normal text-muted-foreground">· {role.company}</span>
                  </h2>
                  {role.description ? (
                    <p className="mt-4 max-w-[68ch] text-[17px] leading-7 text-muted-foreground">{role.description}</p>
                  ) : null}
                  {role.achievements.length ? (
                    <ul className="mt-6 max-w-[68ch] space-y-2.5 text-[15px] leading-7 text-foreground/90 md:text-base">
                      {role.achievements.map((a) => (
                        <li key={a} className="dash-item">
                          <WithFigures text={a} />
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {role.technologies.length ? (
                    <PillList items={role.technologies} label={`${role.company} stack`} className="mt-6" />
                  ) : null}
                </article>
              </li>
            );
          })}
        </ol>
      </Container>
    </Section>
  );
}
