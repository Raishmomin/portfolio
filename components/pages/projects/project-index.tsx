// Every project, server-rendered as a card in one grid. Each item carries id={slugify(title)}
// so home cards can link to /projects#<slug>, data-categories for the filter island, and
// data-card (the wave entrance); the inner card carries data-focus-id (its 3D twin) and
// the hover light (data-tilt + data-spotlight). AI projects (isAiProject) get the AI badge.
// The first project is featured across both columns.
import type { Project } from "@/lib/data";
import { cn, slugify } from "@/lib/utils";
import { isAiProject } from "../../neural";
import { Kicker } from "../../ui/primitives";
import { AiBadge } from "../ai-badge";
import { PopPills, card, lit, part } from "../ui";
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
    <ol id="project-index" data-card-group="" className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:gap-5">
      {projects.map((p, i) => {
        const slug = slugify(p.title);
        const stack = p.technologies.slice(0, 2).join(" · ");
        const ai = isAiProject(p);
        const featured = i === 0;
        // The badge says "AI"; the kicker keeps the other domains.
        const domain = domainLabel(ai ? p.category.filter((c) => c !== "ai") : p.category);
        const kicker = [domain, stack].filter(Boolean).join(" · ");
        return (
          <li
            key={slug}
            id={slug}
            data-categories={projectCategories(p).join(" ")}
            {...card(featured ? "zoom" : "rise")}
            className={cn("flex min-w-0 scroll-mt-24 [&[hidden]]:hidden", featured && "md:col-span-2")}
          >
            <article
              aria-labelledby={`${slug}-title`}
              data-focus-id={slug}
              {...lit}
              className={cn(
                "panel flex w-full min-w-0 flex-col p-6 transition-colors duration-200 hover:border-foreground/25 md:p-8",
                featured && "lg:p-10",
              )}
            >
              <div {...part} className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground tabular-nums">
                    <span className="text-foreground">{String(i + 1).padStart(pad, "0")}</span>
                    <span aria-hidden="true"> / </span>
                    <span className="sr-only"> of </span>
                    {String(projects.length).padStart(pad, "0")}
                  </p>
                  {ai ? <AiBadge /> : null}
                </div>
                {kicker ? <Kicker className="max-w-full truncate">{kicker}</Kicker> : null}
              </div>

              <h3
                {...part}
                id={`${slug}-title`}
                className={cn(
                  "mt-5 font-semibold leading-[1.1] tracking-[-0.025em] text-foreground",
                  featured ? "text-[clamp(1.75rem,3.4vw,2.75rem)]" : "text-[clamp(1.375rem,2.4vw,1.875rem)]",
                )}
              >
                {p.title}
              </h3>
              {p.description ? (
                <p {...part} className={cn("mt-4 text-[17px] leading-7 text-muted-foreground", featured && "max-w-[72ch]")}>
                  {p.description}
                </p>
              ) : null}

              {p.features.length > 0 ? (
                <div {...part}>
                  <h4 className="sr-only">Key features of {p.title}</h4>
                  <ul className={cn("mt-6 grid grid-cols-1 gap-x-8 gap-y-2.5", featured && "lg:grid-cols-2")}>
                    {p.features.map((f) => (
                      <li key={f} className="dash-item text-[15px] leading-6 text-foreground/90">
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {p.technologies.length > 0 ? (
                <PopPills items={p.technologies} label={`Technologies used in ${p.title}`} className="mt-6" />
              ) : null}

              {p.liveUrl || p.githubUrl ? (
                <div {...part} className="mt-auto flex flex-wrap gap-2 pt-6">
                  {p.liveUrl ? <ExternalLink href={p.liveUrl} label="Live" title={p.title} /> : null}
                  {p.githubUrl ? <ExternalLink href={p.githubUrl} label="GitHub" title={p.title} /> : null}
                </div>
              ) : null}
            </article>
          </li>
        );
      })}
    </ol>
  );
}
