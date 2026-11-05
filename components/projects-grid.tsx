"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Plus } from "lucide-react";
import { Tilt } from "./tilt-card";
import { cn } from "@/lib/utils";
import type { Project } from "@/lib/data";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "frontend", label: "Frontend" },
  { id: "backend", label: "Backend" },
  { id: "fullstack", label: "Full Stack" },
  { id: "devops", label: "DevOps" },
];

type ProjectsGridProps = {
  projects: Project[];
  /** Cards shown initially and per "Load more" click. */
  pageSize: number;
  /** One level below the section heading, so the outline never skips a level. */
  cardHeadingAs: "h2" | "h3";
};

/** Client island: category filter, "Load more" and card motion. */
export function ProjectsGrid({ projects, pageSize, cardHeadingAs }: ProjectsGridProps) {
  const reduce = useReducedMotion();
  const [filter, setFilter] = useState("all");
  const [shown, setShown] = useState(pageSize);

  const filtered = useMemo(() => {
    if (filter === "all") return projects;
    return projects.filter((p) => p.category.includes(filter));
  }, [projects, filter]);

  const visible = filtered.slice(0, shown);
  const remaining = Math.max(0, filtered.length - shown);

  function selectFilter(id: string) {
    if (id === filter) return;
    setFilter(id);
    setShown(pageSize);
  }

  return (
    <>
      <div className="mb-12 flex flex-wrap items-center gap-2 relative">
        {FILTERS.map((f) => {
          const isActive = filter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => selectFilter(f.id)}
              className={cn(
                "relative px-4 py-2 text-sm rounded-full transition-colors duration-200",
                isActive
                  ? "text-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="project-filter"
                  className="absolute inset-0 bg-foreground rounded-full"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              <span className="relative z-10">{f.label}</span>
            </button>
          );
        })}
      </div>

      <motion.div
        layout={!reduce}
        className="grid grid-cols-1 md:grid-cols-6 gap-4 md:gap-6 auto-rows-[minmax(220px,_auto)]"
      >
        {/* initial={false}: cards present on first render are server HTML and must
            not start at opacity 0; only cards added by filtering or "Load more" animate in. */}
        <AnimatePresence mode="popLayout" initial={false}>
          {visible.map((p, i) => {
            const isFeatured = i % 5 === 0;
            return (
              <motion.div
                key={`${p.title}-${i}`}
                layout={!reduce}
                initial={reduce ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.5, delay: i * 0.05 }}
                className={cn(
                  isFeatured ? "md:col-span-4" : "md:col-span-2"
                )}
              >
                <Tilt className="h-full">
                  <ProjectCard project={p} featured={isFeatured} headingAs={cardHeadingAs} />
                </Tilt>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>

      {visible.length === 0 && (
        <p className="text-center py-16 text-muted-foreground">
          No projects in this category yet.
        </p>
      )}

      {remaining > 0 && (
        <div className="mt-12 flex justify-center">
          <button
            onClick={() => setShown((n) => n + pageSize)}
            aria-label={`Load ${Math.min(pageSize, remaining)} more projects`}
            className="group inline-flex items-center gap-3 h-12 pl-5 pr-3 rounded-full border border-border text-sm font-medium text-foreground hover:bg-foreground hover:text-background hover:border-foreground transition-colors"
          >
            <span>Load more</span>
            <span className="text-xs tabular-nums opacity-60 group-hover:opacity-100">
              +{remaining}
            </span>
            <span
              aria-hidden="true"
              className="grid place-items-center w-9 h-9 rounded-full border border-border bg-background text-foreground transition-transform group-hover:rotate-90"
            >
              <Plus className="w-4 h-4" />
            </span>
          </button>
        </div>
      )}
    </>
  );
}

function ProjectCard({
  project,
  featured,
  headingAs: Heading,
}: {
  project: Project;
  featured: boolean;
  headingAs: "h2" | "h3";
}) {
  const Inner = (
    <article className="group relative h-full overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-foreground/40 flex flex-col">
      <div className="relative flex-1 p-7 md:p-8 flex flex-col">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex flex-wrap gap-1.5">
            {project.category.slice(0, 2).map((c, i) => (
              <span
                key={i}
                className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground"
              >
                {c}
                {i === 0 && project.category.length > 1 && (
                  <span className="mx-2">·</span>
                )}
              </span>
            ))}
          </div>
          <span
            aria-hidden="true"
            className="grid place-items-center w-9 h-9 rounded-full border border-border text-foreground/60 group-hover:bg-foreground group-hover:text-background group-hover:border-foreground transition-colors"
          >
            <ArrowUpRight className="w-4 h-4 transition-transform group-hover:rotate-12" />
          </span>
        </div>

        <Heading
          className={cn(
            "font-semibold tracking-tight text-foreground mb-3",
            featured ? "text-2xl md:text-3xl" : "text-xl"
          )}
        >
          {project.title}
        </Heading>
        <p className="text-sm text-muted-foreground leading-relaxed mb-6">
          {project.description}
        </p>

        {featured && project.features.length > 0 && (
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 mb-6 text-xs text-muted-foreground">
            {project.features.slice(0, 4).map((f, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-foreground/60" />
                {f}
              </li>
            ))}
          </ul>
        )}

        {/* Every technology is listed: the /projects ItemList JSON-LD names them all. */}
        <div className="flex flex-wrap gap-1.5 mt-auto pt-4 border-t border-border">
          {project.technologies.map((t, i) => (
            <span
              key={i}
              className="text-[11px] px-2.5 py-1 rounded-full border border-border text-muted-foreground"
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    </article>
  );

  // Link to the live site, or to the source when there is no live site.
  const href = project.liveUrl ?? project.githubUrl;
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="block h-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background rounded-2xl"
        aria-label={`${project.title} — ${project.liveUrl ? "open live demo" : "view source code"}`}
      >
        {Inner}
      </a>
    );
  }
  return Inner;
}
