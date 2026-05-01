"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Plus } from "lucide-react";
import { Section, RevealHeading } from "./section";
import { Tilt } from "./tilt-card";
import { usePersonalStore } from "@/lib/zutand";
import { cn } from "@/lib/utils";

const FALLBACK_PROJECTS: Project[] = [
  {
    title: "Portfolio Platform",
    description:
      "A monochrome, motion-rich developer portfolio with a MongoDB-backed CMS and edge-rendered OG images.",
    features: ["Edge OG image", "MongoDB CMS", "Framer Motion"],
    technologies: ["Next.js", "TypeScript", "MongoDB", "Tailwind"],
    category: ["fullstack", "frontend"],
    liveUrl: "https://raish-portfolio.vercel.app",
  },
  {
    title: "Analytics Dashboard",
    description:
      "Real-time KPI dashboard with live charts, role-based access, and incremental data fetching.",
    features: ["WebSocket streams", "RBAC", "Incremental fetch"],
    technologies: ["React", "Node.js", "PostgreSQL", "Recharts"],
    category: ["fullstack", "frontend"],
  },
  {
    title: "Container Pipeline",
    description:
      "GitHub Actions → Docker → ECS pipeline with blue-green deploys and metric-driven rollback.",
    features: ["Blue-green deploys", "Auto-rollback", "Slack alerts"],
    technologies: ["Docker", "AWS", "GitHub Actions", "Bash"],
    category: ["devops"],
  },
  {
    title: "Commerce API",
    description:
      "High-throughput cart and checkout API with idempotent payments and event-driven inventory.",
    features: ["Idempotent payments", "Event sourcing"],
    technologies: ["Node.js", "Express", "Redis", "Stripe"],
    category: ["backend"],
  },
];

type Project = {
  title: string;
  description: string;
  features?: string[];
  technologies: string[];
  category: string[];
  liveUrl?: string;
};

const FILTERS = [
  { id: "all", label: "All" },
  { id: "frontend", label: "Frontend" },
  { id: "backend", label: "Backend" },
  { id: "fullstack", label: "Full Stack" },
  { id: "devops", label: "DevOps" },
];

const PAGE_SIZE = 5;

export function Projects() {
  const { value } = usePersonalStore();
  const reduce = useReducedMotion();
  const [filter, setFilter] = useState("all");
  const [shown, setShown] = useState(PAGE_SIZE);

  const projects: Project[] =
    Array.isArray(value?.projects) && value.projects.length > 0
      ? value.projects
      : FALLBACK_PROJECTS;

  const filtered = useMemo(() => {
    if (filter === "all") return projects;
    return projects.filter(
      (p) => Array.isArray(p.category) && p.category.includes(filter)
    );
  }, [projects, filter]);

  useEffect(() => {
    setShown(PAGE_SIZE);
  }, [filter]);

  const visible = filtered.slice(0, shown);
  const remaining = Math.max(0, filtered.length - shown);

  return (
    <Section id="projects" ariaLabel="Projects" className="bg-muted/30">
      <RevealHeading
        id="projects"
        eyebrow="Selected work"
        title="Projects with sharp edges."
        description="A small set of things I've built and shipped — each one had a real constraint or stakeholder."
      />

      <div className="mb-12 flex flex-wrap items-center gap-2 relative">
        {FILTERS.map((f) => {
          const isActive = filter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
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
        <AnimatePresence mode="popLayout">
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
                  <ProjectCard project={p} featured={isFeatured} />
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
            onClick={() => setShown((n) => n + PAGE_SIZE)}
            aria-label={`Load ${Math.min(PAGE_SIZE, remaining)} more projects`}
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
    </Section>
  );
}

function ProjectCard({ project, featured }: { project: Project; featured: boolean }) {
  const Inner = (
    <article className="group relative h-full overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-foreground/40 flex flex-col">
      <div className="relative flex-1 p-7 md:p-8 flex flex-col">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex flex-wrap gap-1.5">
            {project.category?.slice(0, 2).map((c, i) => (
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

        <h3
          className={cn(
            "font-semibold tracking-tight text-foreground mb-3",
            featured ? "text-2xl md:text-3xl" : "text-xl"
          )}
        >
          {project.title}
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed mb-6">
          {project.description}
        </p>

        {featured && project.features && project.features.length > 0 && (
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 mb-6 text-xs text-muted-foreground">
            {project.features.slice(0, 4).map((f, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-foreground/60" />
                {f}
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap gap-1.5 mt-auto pt-4 border-t border-border">
          {project.technologies.slice(0, featured ? 6 : 4).map((t, i) => (
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

  if (project.liveUrl) {
    return (
      <a
        href={project.liveUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block h-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background rounded-2xl"
        aria-label={`${project.title} — open live demo`}
      >
        {Inner}
      </a>
    );
  }
  return Inner;
}
