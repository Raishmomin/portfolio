// Pure, server-safe: turns DB data into FormationData. No three.js imports.
import type { SkillGroup, ExperienceItem, Project } from "@/lib/data";
import { slugify } from "@/lib/utils";
import type { FormationData, SkillGroupKey } from "./types";

const GROUP_ALIASES: Record<SkillGroupKey, RegExp> = {
  frontend: /front/i,
  backend: /back|api|server/i,
  database: /data|db/i,
  devops: /devops|cloud|infra|ops/i,
};

const MONTHS: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11 };

function parseMonth(part: string, now: Date): Date | null {
  if (/present|now|current/i.test(part)) return now;
  const m = part.trim().match(/^([A-Za-z]+)\.?\s+(\d{4})$/);
  if (!m) return null;
  const mi = MONTHS[m[1].toLowerCase().slice(0, m[1].toLowerCase().startsWith("sept") ? 4 : 3)];
  return mi === undefined ? null : new Date(Date.UTC(Number(m[2]), mi, 1));
}

export function monthsInPeriod(period: string, now: Date = new Date()): number {
  const [a, b] = period.split(/\s*[-–—]\s*/);
  const start = a ? parseMonth(a, now) : null;
  const end = b ? parseMonth(b, now) : null;
  if (!start || !end) return 12;
  return Math.max(1, (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth());
}

export function toFormationData(input: {
  skills: SkillGroup[];
  experience: ExperienceItem[];
  featuredProjects: Project[];
}): FormationData {
  const skills = (Object.keys(GROUP_ALIASES) as SkillGroupKey[]).map((group) => ({
    group,
    count: input.skills
      .filter((g) => GROUP_ALIASES[group].test(g.category))
      .reduce((n, g) => n + g.skills.length, 0),
  }));
  return {
    skills,
    experience: input.experience.map((e) => ({ company: e.company, months: monthsInPeriod(e.period) })),
    projects: input.featuredProjects.map((p) => ({ slug: slugify(p.title), techCount: p.technologies.length })),
  };
}
