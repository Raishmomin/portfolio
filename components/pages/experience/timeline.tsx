import type { ReactNode } from "react";
import { Container, Pill, Section, StatusDot } from "../../ui/primitives";
import { revealProps } from "../../reveal";
import { parsePeriod } from "@/lib/seo";
import type { ExperienceItem } from "@/lib/data";

/** "Sept 2021 - Dec 2022" -> ["SEPT 2021", "DEC 2022"]. */
const periodParts = (period: string) =>
  period.split(/\s*[-–—]\s*/).map((p) => p.trim().toUpperCase());

/** Whole months between two ISO "YYYY-MM" values (end defaults to now). */
function monthsBetween(start?: string, end?: string, now: Date = new Date()): number | null {
  if (!start) return null;
  const [sy, sm] = start.split("-").map(Number);
  const [ey, em] = end ? end.split("-").map(Number) : [now.getUTCFullYear(), now.getUTCMonth() + 1];
  if (!sy || !sm || !ey || !em) return null;
  const months = (ey - sy) * 12 + (em - sm);
  return months > 0 ? months : null;
}

function durationLabel(months: number | null): string | null {
  if (!months) return null;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return [y ? `${y} yr${y > 1 ? "s" : ""}` : "", m ? `${m} mo${m > 1 ? "s" : ""}` : ""].filter(Boolean).join(" ");
}

/** Bold the real figures already in the DB copy ("20%", "3x", "10+"); never adds any. */
function emphasizeNumbers(text: string): ReactNode[] {
  return text.split(/(\d+(?:\.\d+)?(?:\s?%|x\b|\+)?)/g).map((part, i) =>
    i % 2 ? (
      <strong key={i} className="font-semibold text-foreground">
        {part}
      </strong>
    ) : (
      part
    )
  );
}

/** Timeline rows: mono date column, Role · Company, description, achievements, tech pills. */
export function ExperienceTimeline({ roles }: { roles: ExperienceItem[] }) {
  return (
    <Section section="experience" id="timeline" aria-label="Experience timeline" className="py-0 md:py-0">
      <Container>
        <ol>
          {roles.map((role, i) => {
            const { startDate, endDate, current } = parsePeriod(role.period);
            const [from, to] = periodParts(role.period);
            const duration = durationLabel(monthsBetween(startDate, endDate));
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
                        {" — "}
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
                        <li key={a} className="flex gap-3">
                          <span aria-hidden="true" className="mt-[13px] block h-0.5 w-2.5 shrink-0 bg-primary" />
                          <span>{emphasizeNumbers(a)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {role.technologies.length ? (
                    <ul className="mt-6 flex flex-wrap gap-1.5" aria-label={`${role.company} stack`}>
                      {role.technologies.map((t) => (
                        <li key={t}>
                          <Pill>{t}</Pill>
                        </li>
                      ))}
                    </ul>
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
