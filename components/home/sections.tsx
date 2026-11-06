// Home sections 01–03 (about, stack, experience). Server Components; reveals are the
// CSS progressive enhancement from components/reveal.tsx (never on the hero).
import { Accent, Section, SectionHeader, WithFigures } from "../ui/primitives";
import { revealProps } from "../reveal";
import type { ExperienceItem } from "@/lib/data";
import { formatPeriod } from "@/lib/derive";
import type { StackGroup } from "./derive";

export function AboutSection({
  bio,
  stats,
}: {
  bio: string;
  stats: { value: string; label: string }[];
}) {
  return (
    <Section id="about" section="about" aria-labelledby="about-heading">
      <SectionHeader
        id="about-heading"
        kicker="01 · about"
        title={
          <>
            Product engineer, <Accent>from UI to infrastructure.</Accent>
          </>
        }
      />
      <div {...revealProps()}>
        {bio ? <p className="mt-6 max-w-[62ch] text-muted-foreground">{bio}</p> : null}
        {/* Three columns from 360px; stacked below that, where the longest one-word label cannot fit a third. */}
        <dl className="mt-10 grid grid-cols-1 divide-y divide-border border-y border-border min-[360px]:grid-cols-3 min-[360px]:divide-x min-[360px]:divide-y-0">
          {stats.map((s) => (
            <div
              key={s.label}
              className="flex min-w-0 flex-col-reverse justify-end gap-1 py-5 min-[360px]:px-2.5 min-[360px]:first:pl-0 min-[360px]:last:pr-0 sm:px-5"
            >
              <dt className="font-mono text-[11px] uppercase leading-4 tracking-[0.08em] text-muted-foreground sm:text-xs sm:tracking-[0.14em]">
                {s.label}
              </dt>
              <dd className="text-[clamp(1.75rem,4vw,2.75rem)] font-semibold leading-none tracking-[-0.03em] tabular-nums text-foreground">
                {s.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </Section>
  );
}

export function StackSection({ groups }: { groups: StackGroup[] }) {
  return (
    <Section id="stack" section="stack" aria-labelledby="stack-heading">
      <SectionHeader
        id="stack-heading"
        kicker="02 · stack"
        title={
          <>
            The stack, <Accent>mapped to real projects.</Accent>
          </>
        }
        lead="Grouped by layer. Counts come from the technologies listed on each project in the work section."
      />
      <div
        {...revealProps()}
        className="mt-10 grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2"
      >
        {groups.map((g) => (
          <div key={g.key} data-skill-group={g.key} className="bg-background p-5">
            <h3 className="flex items-baseline justify-between font-mono text-xs uppercase tracking-[0.14em] text-foreground">
              {g.label}
              <span className="text-muted-foreground tabular-nums">{String(g.items.length).padStart(2, "0")}</span>
            </h3>
            <ul className="mt-4 space-y-1.5">
              {g.items.map((item) => (
                <li key={item.name} className="flex flex-wrap items-baseline justify-between gap-x-3 whitespace-nowrap text-[15px] leading-6 text-foreground">
                  {item.name}{" "}
                  {item.used > 0 ? (
                    <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground tabular-nums">
                      used in {item.used} {item.used === 1 ? "project" : "projects"}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  );
}

export function ExperienceSection({ items }: { items: ExperienceItem[] }) {
  return (
    <Section id="experience" section="experience" aria-labelledby="experience-heading">
      <SectionHeader
        id="experience-heading"
        kicker="03 · experience"
        title={
          <>
            Where I&apos;ve <Accent>shipped.</Accent>
          </>
        }
      />
      <ol className="mt-10 border-b border-border">
        {items.map((e) => (
          <li
            key={`${e.company}-${e.period}`}
            {...revealProps()}
            className="grid gap-3 border-t border-border py-8 md:grid-cols-[10.5rem_1fr] md:gap-6"
          >
            <p className="font-mono text-xs uppercase leading-6 tracking-[0.14em] text-muted-foreground tabular-nums">
              {formatPeriod(e.period)}
            </p>
            <div>
              <h3 className="text-xl font-semibold leading-7 tracking-[-0.015em] text-foreground">
                {e.title} <span className="font-normal text-muted-foreground">· {e.company}</span>
              </h3>
              {e.description ? (
                <p className="mt-3 text-[15px] leading-6 text-muted-foreground">
                  <WithFigures text={e.description} />
                </p>
              ) : null}
              {e.achievements.length ? (
                <ul className="mt-4 space-y-2">
                  {e.achievements.map((a) => (
                    <li key={a} className="dash-item text-[15px] leading-6 text-muted-foreground">
                      <WithFigures text={a} />
                    </li>
                  ))}
                </ul>
              ) : null}
              {e.technologies.length ? (
                <p className="mt-4 font-mono text-[11px] uppercase leading-5 tracking-[0.12em] text-muted-foreground">
                  {e.technologies.join(" · ")}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}
