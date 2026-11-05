// Pure, server-safe derivations for the home page. Every figure shown on "/" is
// computed here from DB data (app/lib/data.ts) — never typed by hand.
import type { ExperienceItem, Project, SkillGroup } from "@/lib/data";
import type { SkillGroupKey } from "../cluster";
import { parsePeriod } from "@/lib/seo";

export const GROUP_ORDER: readonly SkillGroupKey[] = ["frontend", "backend", "database", "devops"];
export const GROUP_LABEL: Record<SkillGroupKey, string> = {
  frontend: "Frontend",
  backend: "Backend",
  database: "Data",
  devops: "DevOps",
};

const GROUP_ALIASES: Record<SkillGroupKey, RegExp> = {
  frontend: /front/i,
  backend: /back|api|server/i,
  database: /data|db/i,
  devops: /devops|cloud|infra|ops/i,
};

export function groupKey(category: string): SkillGroupKey | null {
  const exact = GROUP_ORDER.find((k) => k === category.toLowerCase());
  return exact ?? GROUP_ORDER.find((k) => GROUP_ALIASES[k].test(category)) ?? null;
}

/** "Node.js" / "NodeJS" -> "node", "Tailwind CSS" -> "tailwindcss", "CI/CD" -> "cicd". */
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/\.?js$/, "")
    .replace(/[^a-z0-9]/g, "");

/** Does a project's technology entry name this skill? Whole name, or one word of it ("AWS S3" -> AWS). */
function mentions(tech: string, skill: string): boolean {
  const s = norm(skill);
  if (!s) return false;
  return norm(tech) === s || tech.split(/\s+/).some((w) => norm(w) === s);
}

/** Number of projects whose technologies mention the skill. */
export function projectsUsing(skill: string, projects: Project[]): number {
  return projects.filter((p) => p.technologies.some((t) => mentions(t, skill))).length;
}

export type StackGroup = {
  key: SkillGroupKey;
  label: string;
  items: { name: string; level: number; used: number }[];
};

/** Skill groups in display order, each item with its "used in N projects" count. */
export function stackMap(skills: SkillGroup[], projects: Project[]): StackGroup[] {
  const groups: StackGroup[] = [];
  for (const key of GROUP_ORDER) {
    const items = skills
      .filter((g) => groupKey(g.category) === key)
      .flatMap((g) => g.skills)
      .map((s) => ({ name: s.name, level: s.level, used: projectsUsing(s.name, projects) }));
    if (items.length) groups.push({ key, label: GROUP_LABEL[key], items });
  }
  return groups;
}

/** Proof ticker skills: per group, the two most-used in projects (ties: higher DB level). */
export function tickerSkills(groups: StackGroup[], perGroup = 2): string[] {
  return groups.flatMap((g) =>
    [...g.items]
      .filter((i) => i.used > 0)
      .sort((a, b) => b.used - a.used || b.level - a.level)
      .slice(0, perGroup)
      .map((i) => i.name),
  );
}

/** Distinct technologies in the skills DB. */
export function technologyCount(skills: SkillGroup[]): number {
  return new Set(skills.flatMap((g) => g.skills.map((s) => norm(s.name)))).size;
}

/** "Sept 2021 - Dec 2022" -> "SEP 2021 — DEC 2022"; "Present" stays a word. */
export function formatPeriod(period: string): string {
  return period
    .split(/\s*[-–—]\s*/)
    .map((part) => part.trim().replace(/^([A-Za-z]{3})[A-Za-z]*\.?(?=\s+\d{4})/, "$1").toUpperCase())
    .join(" — ");
}

/** Most recent role first. */
export function byRecency(items: ExperienceItem[]): ExperienceItem[] {
  return [...items].sort((a, b) => {
    const sa = parsePeriod(a.period).startDate ?? "";
    const sb = parsePeriod(b.period).startDate ?? "";
    return sb.localeCompare(sa);
  });
}

/** Splits text so real figures from the DB ("20%", "50+", "3x") can be bolded. */
export function splitFigures(text: string): { text: string; figure: boolean }[] {
  const out: { text: string; figure: boolean }[] = [];
  const re = /\b\d+(?:[.,]\d+)?(?:%|\+|x\b|k\b|ms\b)?/g;
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

const DOMAIN_ORDER = ["ai", "web3", "devops", "fullstack", "backend", "frontend"] as const;
const DOMAIN_LABEL: Record<(typeof DOMAIN_ORDER)[number], string> = {
  ai: "AI",
  web3: "Web3",
  devops: "DevOps",
  fullstack: "Full stack",
  backend: "Backend",
  frontend: "Frontend",
};

/** The most specific category of a project, e.g. ["frontend","fullstack","ai"] -> "AI". */
export function projectDomain(p: Project): string {
  const cats = p.category.map((c) => c.toLowerCase());
  const hit = DOMAIN_ORDER.find((d) => cats.includes(d));
  return hit ? DOMAIN_LABEL[hit] : p.category[0] ?? "Project";
}

/** First sentence of a description. */
export function firstSentence(text: string): string {
  const m = text.match(/^.+?[.!?](?=\s|$)/);
  return (m ? m[0] : text).trim();
}

/** External link label: source repos read "Source", everything else "Live". */
export function liveLabel(url: string): string {
  return /github\.com|gitlab\.com/i.test(url) ? "Source" : "Live";
}
