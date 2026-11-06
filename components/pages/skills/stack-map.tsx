import { Accent } from "../../ui/primitives";
import { PageSection, SectionHead, card, column, lit, part } from "../ui";
import type { Project, SkillGroup } from "@/lib/data";
import { projectUsage, techKey, topTechnologies } from "@/lib/derive";

const GROUP_LABELS: Record<string, string> = {
  frontend: "Frontend",
  backend: "Backend",
  database: "Data",
  devops: "DevOps",
};
const HOOK_GROUPS = new Set(["frontend", "backend", "database", "devops"]);

const groupLabel = (category: string) =>
  GROUP_LABELS[category] ?? category.charAt(0).toUpperCase() + category.slice(1);

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * Stack map, "full" composition: one floating card per layer over the centred 3D skill
 * network, entering as a wave; hovering a skill lights its node (data-focus-id = the
 * scene's skill id). "Used in N projects" (omitted at 0) is the shared projectUsage
 * from @/lib/derive, the same counter as the home stack map.
 */
export function StackMap({ groups, projects }: { groups: SkillGroup[]; projects: Project[] }) {
  const usage = projectUsage(projects);

  return (
    <PageSection id="stack" section="stack" scene="stack" stage="full" labelledBy="stack-heading">
      <SectionHead
        id="stack-heading"
        index="01"
        kicker="stack map"
        center
        title={
          <>
            Grouped by layer, <Accent>linked by projects.</Accent>
          </>
        }
        scene="Each glowing node is a technology I use; lines connect tools I've combined in real projects. Hover a skill to light up its connections."
        lead={`Usage counts come from the technologies listed on each of the ${projects.length} projects in the archive. Skills that no listed project names show no count.`}
      />

      <div data-card-group="" className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:gap-5 xl:grid-cols-4">
        {groups.map((g, i) => {
          const label = groupLabel(g.category);
          const headingId = `skill-group-${g.category}`;
          return (
            <div key={g.category} {...card()} className="flex min-w-0">
              <article
                aria-labelledby={headingId}
                data-skill-group={HOOK_GROUPS.has(g.category) ? g.category : undefined}
                {...lit}
                className="panel w-full min-w-0 p-5 md:p-6"
              >
                <header {...part} className="flex items-baseline justify-between gap-4">
                  <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground tabular-nums">
                    {pad2(i + 1)} · {g.category}
                  </p>
                  <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground tabular-nums">
                    {pad2(g.skills.length)} skills
                  </p>
                </header>
                <h3 {...part} id={headingId} className="mt-4 text-2xl font-semibold tracking-[-0.02em] text-foreground">
                  {label}
                </h3>
                <ul {...part} className="mt-5 divide-y divide-border border-t border-border">
                  {g.skills.map((s) => {
                    const n = usage(s.name);
                    return (
                      <li
                        key={s.name}
                        data-focus-id={techKey(s.name)}
                        className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-3 text-[15px] text-foreground transition-colors duration-150 hover:text-primary"
                      >
                        {s.name}{" "}
                        {n > 0 ? (
                          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground tabular-nums">
                            used in {n} project{n === 1 ? "" : "s"}
                          </span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </article>
            </div>
          );
        })}
      </div>
    </PageSection>
  );
}

/**
 * The technologies named by the most projects (real counts from projects[].technologies),
 * "right" composition: each bar draws as it scrolls in.
 */
export function TopTechnologies({ projects, limit = 12 }: { projects: Project[]; limit?: number }) {
  const top = topTechnologies(projects, { min: 2, limit });
  if (!top.length) return null;
  const max = top[0].count;

  return (
    <PageSection id="in-production" section="in-production" scene="stack" stage="right" labelledBy="top-tech-heading">
      <div {...card()} className={`panel p-6 md:p-8 ${column.right}`}>
        <SectionHead
          id="top-tech-heading"
          index="02"
          kicker="in production"
          title={
            <>
              Most used <Accent>across projects.</Accent>
            </>
          }
          lead={`The ${top.length} technologies that appear in the most of the ${projects.length} projects, by project count.`}
        />
        <ol className="mt-8 divide-y divide-border border-y border-border">
          {top.map((t, i) => (
            <li
              key={t.name}
              {...part}
              data-focus-id={techKey(t.name)}
              className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-3 py-3 sm:grid-cols-[2.25rem_9.5rem_minmax(0,1fr)_auto] sm:gap-x-4"
            >
              <span className="font-mono text-xs text-muted-foreground tabular-nums">{pad2(i + 1)}</span>
              <span className="truncate text-[15px] text-foreground">{t.name}</span>
              <svg
                aria-hidden="true"
                data-draw=""
                viewBox="0 0 100 2"
                preserveAspectRatio="none"
                className="hidden h-1.5 w-full text-primary sm:block"
              >
                <line x1="0" y1="1" x2={(t.count / max) * 100} y2="1" stroke="currentColor" strokeWidth="2" strokeOpacity={0.35 + 0.65 * (t.count / max)} />
              </svg>
              <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground tabular-nums">
                <span data-count={t.count}>{t.count}</span> projects
              </span>
            </li>
          ))}
        </ol>
      </div>
    </PageSection>
  );
}
