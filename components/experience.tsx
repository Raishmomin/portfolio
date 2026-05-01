"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Section, RevealHeading } from "./section";
import { usePersonalStore } from "@/lib/zutand";
import { cn } from "@/lib/utils";

const FALLBACK: ExperienceItem[] = [
  {
    title: "Senior Full Stack Developer",
    company: "Freelance",
    period: "2023 — Present",
    description:
      "Building production web apps and cloud infrastructure for startups and SMBs. End-to-end ownership from architecture to deploy.",
    achievements: [
      "Shipped 10+ production apps on Next.js / Node.js stack",
      "Cut infra costs ~40% via container right-sizing & caching",
      "Mentored 3 junior engineers across 2 client teams",
    ],
    technologies: ["Next.js", "Node.js", "MongoDB", "Docker", "AWS"],
  },
  {
    title: "Full Stack Developer",
    company: "Tech Studio",
    period: "2021 — 2023",
    description:
      "Owned features across the React frontend and Node API. Drove migration to TypeScript across the platform.",
    achievements: [
      "Led TypeScript migration of a 60k LOC codebase",
      "Built CI/CD pipeline cutting release time from 45 → 8 min",
    ],
    technologies: ["React", "TypeScript", "Express", "PostgreSQL"],
  },
  {
    title: "Junior Developer",
    company: "Studio One",
    period: "2020 — 2021",
    description:
      "Started in product engineering — UI components, API endpoints, and a lot of code review.",
    achievements: ["Built component library used across 4 products"],
    technologies: ["React", "Node.js", "MongoDB"],
  },
];

type ExperienceItem = {
  title: string;
  company: string;
  period: string;
  description: string;
  achievements?: string[];
  technologies: string[];
};

export function Experience() {
  const { value } = usePersonalStore();
  const reduce = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);

  const items: ExperienceItem[] =
    Array.isArray(value?.experience) && value.experience.length > 0
      ? value.experience
      : FALLBACK;

  useEffect(() => {
    if (reduce || paused) return;
    const el = containerRef.current;
    if (!el) return;
    const id = setInterval(() => {
      const max = el.scrollWidth - el.clientWidth;
      const next = el.scrollLeft + el.clientWidth * 0.6;
      if (next >= max - 8) el.scrollTo({ left: 0, behavior: "smooth" });
      else el.scrollTo({ left: next, behavior: "smooth" });
    }, 4500);
    return () => clearInterval(id);
  }, [reduce, paused, items.length]);

  function nudge(dir: -1 | 1) {
    const el = containerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.7, behavior: "smooth" });
  }

  return (
    <Section id="experience" ariaLabel="Experience">
      <div className="flex items-end justify-between gap-6 mb-12 md:mb-20">
        <RevealHeading
          id="experience"
          eyebrow="Experience"
          title="A working timeline."
          description="Roles, projects, and the through-line that connects them."
          className="mb-0"
        />
        <div className="hidden md:flex gap-2 pb-2 shrink-0">
          <button
            onClick={() => nudge(-1)}
            aria-label="Previous"
            className="grid place-items-center w-10 h-10 rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => nudge(1)}
            aria-label="Next"
            className="grid place-items-center w-10 h-10 rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={() => setPaused(true)}
        className="flex gap-6 overflow-x-auto snap-x snap-mandatory pb-6 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 no-scrollbar"
        style={{ scrollbarWidth: "none" }}
      >
        {items.map((exp, i) => (
          <motion.article
            key={i}
            initial={reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ duration: reduce ? 0 : 0.6, delay: reduce ? 0 : i * 0.08 }}
            className={cn(
              "snap-start shrink-0 w-[88vw] sm:w-[440px] rounded-2xl border border-border bg-card p-8 flex flex-col gap-6",
              "transition-colors hover:border-foreground/40"
            )}
          >
            <header className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
                  {exp.company}
                </div>
                <h3 className="text-xl font-semibold tracking-tight text-foreground">
                  {exp.title}
                </h3>
              </div>
              <div className="text-3xl font-semibold tracking-tight tabular-nums shrink-0 text-foreground/40">
                {String(i + 1).padStart(2, "0")}
              </div>
            </header>

            <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              {exp.period}
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              {exp.description}
            </p>

            {exp.achievements && exp.achievements.length > 0 && (
              <ul className="space-y-2 pl-0 text-sm text-foreground/80">
                {exp.achievements.slice(0, 3).map((a, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <span className="mt-2 block w-3 h-px bg-foreground/40 shrink-0" />
                    <span className="leading-relaxed">{a}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex flex-wrap gap-1.5 mt-auto pt-4 border-t border-border">
              {exp.technologies.map((t, idx) => (
                <span
                  key={idx}
                  className="text-[11px] px-2.5 py-1 rounded-full border border-border text-muted-foreground"
                >
                  {t}
                </span>
              ))}
            </div>
          </motion.article>
        ))}
      </div>
    </Section>
  );
}
