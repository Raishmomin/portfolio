// Every project, server-rendered as a spec-sheet card. Each item carries id={slugify(title)}
// so home cards can link to /projects#<slug>, data-categories for the filter island, and
// data-focus-id / data-tilt for the motion layer. AI projects (isAiProject) get the AI badge.
import type { Project } from "@/lib/data";
import { slugify } from "@/lib/utils";
import { isAiProject } from "../../neural";
import { Kicker, PillList } from "../../ui/primitives";
import { AiBadge } from "../ai-badge";
import { reveal, split } from "../motion";
import { domainLabel, projectCategories } from "./categories";

const linkClass =
  "inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border bg-background px-4 font-mono text-xs uppercase tracking-[0.12em] text-foreground transition-colors duration-150 hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

function ExternalLink({ href, label, title }: { href: string; label: string; title: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>
      {label}
      <span className="sr-only"> for {title} (opens in a new tab)</span>
      <span aria-hidden="true">↗</span>
    </a>
  );
}

export function ProjectIndex({ projects }: { projects: Project[] }) {
  const pad = String(projects.length).length;
  return (
    <ol id="project-index" className="grid gap-4 md:gap-6">
      {projects.map((p, i) => {
        const slug = slugify(p.title);
        const stack = p.technologies.slice(0, 2).join(" · ");
        const ai = isAiProject(p);
        // The badge says "AI"; the kicker keeps the other domains.
        const domain = domainLabel(ai ? p.category.filter((c) => c !== "ai") : p.category);
        const kicker = [domain, stack].filter(Boolean).join(" · ");
        return (
          <li key={slug} id={slug} data-categories={projectCategories(p).join(" ")} {...reveal(i % 2)}>
            <article
              aria-labelledby={`${slug}-title`}
              data-tilt=""
              data-focus-id={slug}
              className="relative grid gap-6 rounded-xl border border-border bg-card p-6 transition-colors duration-200 hover:border-foreground/25 md:grid-cols-12 md:gap-8 md:p-10"
            >
              <div className="flex items-start justify-between gap-4 md:col-span-3 md:flex-col md:justify-start">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground tabular-nums">
                    <span className="text-foreground">{String(i + 1).padStart(pad, "0")}</span>
                    <span aria-hidden="true"> / </span>
                    <span className="sr-only"> of </span>
                    {String(projects.length).padStart(pad, "0")}
                  </p>
                  {ai ? <AiBadge /> : null}
                </div>
                {p.liveUrl || p.githubUrl ? (
                  <div className="flex flex-wrap gap-2 md:mt-6">
                    {p.liveUrl ? <ExternalLink href={p.liveUrl} label="Live" title={p.title} /> : null}
                    {p.githubUrl ? <ExternalLink href={p.githubUrl} label="GitHub" title={p.title} /> : null}
                  </div>
                ) : null}
              </div>

              <div className="min-w-0 md:col-span-9">
                {kicker ? <Kicker>{kicker}</Kicker> : null}
                <h2
                  {...split}
                  id={`${slug}-title`}
                  className="mt-3 text-[clamp(1.5rem,3vw,2.25rem)] font-semibold leading-[1.1] tracking-[-0.025em] text-foreground"
                >
                  {p.title}
                </h2>
                {p.description ? (
                  <p className="mt-4 max-w-[68ch] text-[17px] leading-7 text-muted-foreground">{p.description}</p>
                ) : null}

                {p.features.length > 0 ? (
                  <>
                    <h3 className="sr-only">Key features of {p.title}</h3>
                    <ul className="mt-6 grid gap-x-8 gap-y-2.5 lg:grid-cols-2">
                      {p.features.map((f) => (
                        <li key={f} className="dash-item text-[15px] leading-6 text-foreground/90">
                          {f}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}

                {p.technologies.length > 0 ? (
                  <PillList items={p.technologies} label={`Technologies used in ${p.title}`} className="mt-6" />
                ) : null}
              </div>
            </article>
          </li>
        );
      })}
    </ol>
  );
}
