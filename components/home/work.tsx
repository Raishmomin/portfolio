// Home section 04 · work: six featured case-study cards (DB order) + a numbered
// archive index of the rest. Server Component. Cards carry data-project-slug for the
// cluster scene (hover/focus raises that project's column via event delegation).
import Link from "next/link";
import { Accent, Pill, Section, SectionHeader } from "../ui/primitives";
import { revealProps } from "../reveal";
import type { Project } from "@/lib/data";
import { slugify } from "@/lib/utils";
import { firstSentence, liveLabel, projectDomain } from "./derive";

const stackOf = (p: Project, n: number) => p.technologies.slice(0, n).join(" / ");

export function WorkSection({ featured, archive }: { featured: Project[]; archive: Project[] }) {
  return (
    <Section id="work" section="work" aria-labelledby="work-heading">
      <SectionHeader
        id="work-heading"
        kicker="04 · work"
        title={
          <>
            Selected work, <Accent>end to end.</Accent>
          </>
        }
      />

      <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {featured.map((p) => {
          const slug = slugify(p.title);
          return (
            <li key={slug} {...revealProps()} className="flex">
              <article
                data-project-slug={slug}
                className="flex w-full flex-col rounded-lg border border-border bg-card p-5 transition-colors duration-150 hover:border-foreground/30 focus-within:border-primary"
              >
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  {projectDomain(p)} · {stackOf(p, 2)}
                </p>
                <h3 className="mt-3 text-lg font-semibold leading-6 tracking-[-0.015em] text-foreground">{p.title}</h3>
                <p className="mt-2 line-clamp-3 text-[15px] leading-6 text-muted-foreground">
                  {firstSentence(p.description)}
                </p>
                {p.technologies.length ? (
                  <ul aria-label="Technologies" className="mt-4 flex flex-wrap gap-1.5">
                    {p.technologies.slice(0, 4).map((t) => (
                      <li key={t}>
                        <Pill>{t}</Pill>
                      </li>
                    ))}
                    {p.technologies.length > 4 ? (
                      <li>
                        <Pill>+{p.technologies.length - 4}</Pill>
                      </li>
                    ) : null}
                  </ul>
                ) : null}
                <div className="mt-auto flex flex-wrap gap-x-5 pt-4 text-sm">
                  {p.liveUrl ? (
                    <a
                      href={p.liveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 items-center gap-1 font-medium text-foreground underline decoration-border underline-offset-4 transition-colors duration-150 hover:decoration-primary"
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
        <div className="mt-14" {...revealProps()}>
          <h3 className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Archive · {archive.length} more projects
          </h3>
          <ol className="archive mt-4 border-t border-border">
            {archive.map((p, i) => {
              const slug = slugify(p.title);
              return (
                <li key={slug} className="border-b border-border">
                  <Link
                    href={`/projects#${slug}`}
                    className="grid min-h-12 grid-cols-[2.25rem_1fr_auto] items-baseline gap-x-3 py-3 sm:grid-cols-[2.25rem_1fr_auto_1.25rem]"
                  >
                    <span className="font-mono text-xs text-muted-foreground tabular-nums">
                      {String(featured.length + i + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[15px] font-medium leading-6 text-foreground">{p.title}</span>
                      <span className="block font-mono text-[11px] uppercase leading-5 tracking-[0.12em] text-muted-foreground sm:hidden">
                        {projectDomain(p)} · {stackOf(p, 2)}
                      </span>
                    </span>
                    <span className="hidden font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground sm:block">
                      {projectDomain(p)} · {stackOf(p, 2)}
                    </span>
                    <span aria-hidden="true" className="archive-arrow text-muted-foreground">
                      ↗
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}
    </Section>
  );
}
