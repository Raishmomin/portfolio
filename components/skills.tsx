"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Section, RevealHeading } from "./section";
import { usePersonalStore } from "@/lib/zutand";

const FALLBACK_SKILLS: Record<string, { name: string; level: number }[]> = {
  frontend: [
    { name: "React", level: 95 },
    { name: "Next.js", level: 92 },
    { name: "TypeScript", level: 90 },
    { name: "Tailwind CSS", level: 95 },
    { name: "Framer Motion", level: 85 },
    { name: "Redux", level: 80 },
  ],
  backend: [
    { name: "Node.js", level: 90 },
    { name: "Express", level: 88 },
    { name: "REST APIs", level: 92 },
    { name: "GraphQL", level: 75 },
    { name: "Python", level: 70 },
  ],
  database: [
    { name: "MongoDB", level: 90 },
    { name: "PostgreSQL", level: 82 },
    { name: "Redis", level: 75 },
    { name: "Prisma", level: 78 },
  ],
  devops: [
    { name: "Docker", level: 85 },
    { name: "AWS", level: 78 },
    { name: "CI/CD", level: 80 },
    { name: "Linux", level: 82 },
    { name: "Nginx", level: 75 },
  ],
};

const CATEGORY_ORDER = ["frontend", "backend", "database", "devops"] as const;

type SkillRow = { name: string; level: number };

export function Skills() {
  const { value } = usePersonalStore();
  const reduce = useReducedMotion();

  const grouped = useMemo(() => {
    const fromStore = value?.skils?.[0];
    if (fromStore && typeof fromStore === "object") {
      const out: Record<string, SkillRow[]> = {};
      for (const [k, v] of Object.entries(fromStore)) {
        if (k === "_id" || !Array.isArray(v)) continue;
        out[k] = v as SkillRow[];
      }
      if (Object.keys(out).length > 0) return out;
    }
    return FALLBACK_SKILLS;
  }, [value]);

  const categories = CATEGORY_ORDER.filter((c) => grouped[c]?.length > 0);
  const otherCategories = Object.keys(grouped).filter(
    (c) => !CATEGORY_ORDER.includes(c as never)
  );
  const allCategories = [...categories, ...otherCategories];

  return (
    <Section
      id="skills"
      ariaLabel="Skills"
      className="bg-muted/30"
    >
      <RevealHeading
        id="skills"
        eyebrow="Skills"
        title="Tools I reach for."
        description="A working stack honed across years of shipping. Comfortable across the stack, opinionated where it matters."
      />

      <div className="space-y-6 mask-edge-x">
        {allCategories.map((category, idx) => {
          const skills = grouped[category] || [];
          if (skills.length === 0) return null;
          const doubled = [...skills, ...skills];
          const direction = idx % 2 === 0 ? "marquee" : "marquee";
          const isReverse = idx % 2 === 1;
          return (
            <motion.div
              key={category}
              initial={reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: reduce ? 0 : 0.6, delay: reduce ? 0 : idx * 0.08 }}
              className="group relative"
            >
              <div className="flex items-baseline justify-between mb-3">
                <h3 className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                  {category}
                </h3>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {String(skills.length).padStart(2, "0")} tools
                </span>
              </div>
              <div className="overflow-hidden border-y border-border py-4">
                <div
                  className="flex gap-4 will-change-transform"
                  style={{
                    width: "max-content",
                    animation: reduce
                      ? undefined
                      : `${direction} ${30 + idx * 6}s linear infinite ${
                          isReverse ? "reverse" : "normal"
                        }`,
                    animationPlayState: "running",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.animationPlayState = "paused";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.animationPlayState = "running";
                  }}
                >
                  {doubled.map((s, i) => (
                    <SkillChip key={`${s.name}-${i}`} name={s.name} level={s.level} />
                  ))}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </Section>
  );
}

function SkillChip({ name, level }: { name: string; level: number }) {
  return (
    <div className="group/chip flex items-center gap-3 px-5 py-3 rounded-full border border-border bg-background hover:bg-foreground hover:text-background hover:border-foreground transition-colors duration-300 whitespace-nowrap">
      <span className="text-sm font-medium tracking-tight">{name}</span>
      <span className="text-[10px] tabular-nums text-muted-foreground group-hover/chip:text-background/70">
        {level}
      </span>
    </div>
  );
}
