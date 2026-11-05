import { Container, Section } from "../../ui/primitives";
import { revealProps } from "../../reveal";
import { SubsectionHeading } from "../about/subpage";
import type { Project, SkillGroup } from "@/lib/data";

const GROUP_LABELS: Record<string, string> = {
  frontend: "Frontend",
  backend: "Backend",
  database: "Data",
  devops: "DevOps",
};
const HOOK_GROUPS = new Set(["frontend", "backend", "database", "devops"]);

const groupLabel = (category: string) =>
  GROUP_LABELS[category] ?? category.charAt(0).toUpperCase() + category.slice(1);

/** Case-insensitive key that also treats "React" / "React.js" and "Express" / "Express.js" as one. */
const techKey = (name: string) =>
  name
    .toLowerCase()
    .trim()
    .replace(/\.js$/, "")
    .replace(/[^a-z0-9]+/g, "");

/** Number of projects whose technologies list names each skill (each project counted once). */
export function projectUsage(projects: Pick<Project, "technologies">[]): (skill: string) => number {
  const counts = new Map<string, number>();
  for (const p of projects) {
    for (const key of new Set(p.technologies.map(techKey))) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return (skill) => counts.get(techKey(skill)) ?? 0;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Stack map: groups Frontend / Backend / Data / DevOps with "used in N projects" (omitted at 0). */
export function StackMap({ groups, projects }: { groups: SkillGroup[]; projects: Project[] }) {
  const usage = projectUsage(projects);

  return (
    <Section section="stack" id="stack" aria-labelledby="stack-heading">
      <Container>
        <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
          <SubsectionHeading kicker="01 · stack map" id="stack-heading" className="lg:col-span-7">
            Grouped by layer
          </SubsectionHeading>
          <p className="max-w-[60ch] text-[15px] leading-7 text-muted-foreground lg:col-span-5">
            Usage counts come from the technologies listed on each of the {projects.length} projects in the{" "}
            archive. Skills that no listed project names show no count.
          </p>
        </div>

        <div className="mt-10 grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-2 xl:grid-cols-4">
          {groups.map((g, i) => {
            const label = groupLabel(g.category);
            const headingId = `skill-group-${g.category}`;
            return (
              <article
                key={g.category}
                aria-labelledby={headingId}
                data-skill-group={HOOK_GROUPS.has(g.category) ? g.category : undefined}
                className="min-w-0 bg-background p-5 md:p-6"
                {...revealProps({ delay: i * 0.06, y: 12 })}
              >
                <header className="flex items-baseline justify-between gap-4">
                  <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground tabular-nums">
                    {pad2(i + 1)} · {g.category}
                  </p>
                  <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground tabular-nums">
                    {pad2(g.skills.length)} skills
                  </p>
                </header>
                <h3 id={headingId} className="mt-4 text-2xl font-semibold tracking-[-0.02em] text-foreground">
                  {label}
                </h3>
                <ul className="mt-5 divide-y divide-border border-t border-border">
                  {g.skills.map((s) => {
                    const n = usage(s.name);
                    return (
                      <li key={s.name} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-3">
                        <span className="text-[15px] text-foreground">{s.name}</span>
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
            );
          })}
        </div>
      </Container>
    </Section>
  );
}

/** The technologies named by the most projects (real counts from projects[].technologies). */
export function TopTechnologies({ projects, limit = 12 }: { projects: Project[]; limit?: number }) {
  const tally = new Map<string, { name: string; count: number }>();
  for (const p of projects) {
    const seen = new Set<string>();
    for (const name of p.technologies) {
      const key = techKey(name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const entry = tally.get(key);
      if (entry) entry.count += 1;
      else tally.set(key, { name, count: 1 });
    }
  }
  const top = [...tally.values()]
    .filter((t) => t.count > 1)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);
  if (!top.length) return null;
  const max = top[0].count;

  return (
    <Section id="in-production" aria-labelledby="top-tech-heading">
      <Container className="grid gap-10 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-4">
          <SubsectionHeading kicker="02 · in production" id="top-tech-heading">
            Most used across projects
          </SubsectionHeading>
          <p className="mt-4 max-w-[48ch] text-[15px] leading-7 text-muted-foreground">
            The {top.length} technologies that appear in the most of the {projects.length} projects, by project count.
          </p>
        </div>
        <ol className="min-w-0 divide-y divide-border border-y border-border lg:col-span-8">
          {top.map((t, i) => (
            <li key={t.name} className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-3 py-3 sm:grid-cols-[2.5rem_12rem_minmax(0,1fr)_auto] sm:gap-x-4">
              <span className="font-mono text-xs text-muted-foreground tabular-nums">{pad2(i + 1)}</span>
              <span className="truncate text-[15px] text-foreground">{t.name}</span>
              <span aria-hidden="true" className="hidden h-2 sm:block">
                <span
                  className="block h-full bg-[repeating-linear-gradient(90deg,hsl(var(--muted-foreground)/0.55)_0_8px,transparent_8px_11px)]"
                  style={{ width: `${(t.count / max) * 100}%` }}
                />
              </span>
              <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground tabular-nums">
                {t.count} projects
              </span>
            </li>
          ))}
        </ol>
      </Container>
    </Section>
  );
}
