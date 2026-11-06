// Pure, server-safe derivations shared by every page and by llms.txt, so the same
// fact (a role's dates, "used in N projects", a technology count) is computed once
// and reads identically everywhere. Inputs are DB data from ./data.

import type { Project, SkillGroup } from "./data";
import { parsePeriod } from "./seo";

// ---------- technologies ----------

/**
 * Alternative names for the same technology, keyed by normalized name. Only true
 * synonyms belong here; a product or service built on a technology is a different
 * technology and is never aliased.
 */
const TECH_ALIASES: Record<string, string> = {
  postgres: "postgresql",
  k8s: "kubernetes",
  mongo: "mongodb",
  tailwind: "tailwindcss",
};

/**
 * Matching key for a technology name. THE RULE for every "used in N projects" count:
 * a project counts toward a skill when one of its listed technologies is the same
 * technology, compared case-insensitively and ignoring punctuation, spaces and a
 * trailing ".js"/"JS" ("React.js" = "React", "Postgresql" = "PostgreSQL",
 * "NodeJS" = "Node.js"), plus the synonyms in TECH_ALIASES. Partial or one-word
 * matches never count: "AWS S3" is not "AWS" and "Upstash Redis" is not "Redis".
 */
export function techKey(name: string): string {
  const key = name
    .trim()
    .toLowerCase()
    .replace(/(.)\.?js$/, "$1")
    .replace(/[^a-z0-9]+/g, "");
  return TECH_ALIASES[key] ?? key;
}

/** Counter for "used in N projects": each project counts once per technology. */
export function projectUsage(projects: Pick<Project, "technologies">[]): (name: string) => number {
  const counts = new Map<string, number>();
  for (const p of projects) {
    for (const key of new Set(p.technologies.map(techKey))) {
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return (name) => counts.get(techKey(name)) ?? 0;
}

/** Technologies named by at least `min` projects, most used first (shown with the first spelling seen). */
export function topTechnologies(
  projects: Pick<Project, "technologies">[],
  { min = 2, limit = 12 } = {},
): { name: string; count: number }[] {
  const usage = projectUsage(projects);
  const names = new Map<string, string>();
  for (const p of projects) {
    for (const name of p.technologies) {
      const key = techKey(name);
      if (key && !names.has(key)) names.set(key, name);
    }
  }
  return [...names.values()]
    .map((name) => ({ name, count: usage(name) }))
    .filter((t) => t.count >= min)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);
}

/** Distinct skills in the skills DB (the "technologies" stat on / and /about). */
export function skillCount(skills: SkillGroup[]): number {
  return new Set(skills.flatMap((g) => g.skills.map((s) => techKey(s.name)))).size;
}

/** Distinct technologies listed across projects (the /projects "technologies used" stat). */
export function projectTechCount(projects: Pick<Project, "technologies">[]): number {
  return new Set(projects.flatMap((p) => p.technologies.map(techKey)).filter(Boolean)).size;
}

// ---------- dates ----------

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2021-09" or "2021-09-01" -> "Sep 2021"; a bare year stays as is. */
export function monthLabel(iso: string): string {
  const [year, month] = iso.split("-");
  const name = MONTHS[Number(month) - 1];
  return name ? `${name} ${year}` : year;
}

export type Period = {
  /** "Sep 2021" */
  from: string;
  /** "Dec 2022" or "Present"; empty when the DB period has no end part. */
  to: string;
  startDate?: string;
  endDate?: string;
  current: boolean;
};

/** "Sept 2021 - Dec 2022" -> { from: "Sep 2021", to: "Dec 2022", startDate: "2021-09", … }. */
export function periodParts(period: string): Period {
  const { startDate, endDate, current } = parsePeriod(period);
  const [rawFrom = "", rawTo = ""] = period.split(/\s*[-–—]\s*/).map((s) => s.trim());
  return {
    from: startDate ? monthLabel(startDate) : rawFrom,
    to: current ? "Present" : endDate ? monthLabel(endDate) : rawTo,
    startDate,
    endDate,
    current,
  };
}

/**
 * THE date-range label for a role, used on /, /experience, /about and in llms.txt:
 * "Sep 2021 – Dec 2022", "Feb 2024 – Present". Mono date columns uppercase it with CSS
 * only, so the text itself is identical on every surface.
 */
export function formatPeriod(period: string): string {
  const { from, to } = periodParts(period);
  return to ? `${from} – ${to}` : from;
}

/** Post dates: "2026-11-04T…" -> "Nov 4, 2026". UTC, so server and client agree. */
export function shortDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

/** Whole months a role lasted (open-ended roles run to `now`); null when unparseable. */
export function periodMonths(period: string, now: Date = new Date()): number | null {
  const { startDate, endDate, current } = parsePeriod(period);
  if (!startDate || (!endDate && !current)) return null;
  const [sy, sm] = startDate.split("-").map(Number);
  const [ey, em] = endDate ? endDate.split("-").map(Number) : [now.getUTCFullYear(), now.getUTCMonth() + 1];
  if (!sy || !sm || !ey || !em) return null;
  const months = (ey - sy) * 12 + (em - sm);
  return months > 0 ? months : null;
}

// ---------- copy ----------

/** Splits DB copy so the real figures already in it ("20%", "50+", "3x") can be bolded; never adds any. */
export function splitFigures(text: string): { text: string; figure: boolean }[] {
  const out: { text: string; figure: boolean }[] = [];
  const re = /\b\d+(?:[.,]\d+)?(?:\s?%|\+|x\b|k\b|ms\b)?/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ text: text.slice(last, i), figure: false });
    out.push({ text: m[0], figure: true });
    last = i + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), figure: false });
  return out;
}
