// Pure, server-safe derivations for the home page. Every figure shown on "/" is
// computed here from DB data (app/lib/data.ts) — never typed by hand.
import type { Project, SkillGroup } from "@/lib/data";
import type { SkillGroupKey } from "../cluster";
import { projectUsage } from "@/lib/derive";

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

export type StackGroup = {
  key: SkillGroupKey;
  label: string;
  items: { name: string; level: number; used: number }[];
};

/** Skill groups in display order, each item with its "used in N projects" count (rule: techKey in @/lib/derive). */
export function stackMap(skills: SkillGroup[], projects: Project[]): StackGroup[] {
  const usage = projectUsage(projects);
  const groups: StackGroup[] = [];
  for (const key of GROUP_ORDER) {
    const items = skills
      .filter((g) => groupKey(g.category) === key)
      .flatMap((g) => g.skills)
      .map((s) => ({ name: s.name, level: s.level, used: usage(s.name) }));
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
