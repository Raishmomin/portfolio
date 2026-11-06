// Project category labels and chips, derived from the DB `category` arrays (never hand-counted).
import type { Project } from "@/lib/data";

const LABELS: Record<string, string> = {
  fullstack: "Full stack",
  frontend: "Frontend",
  backend: "Backend",
  devops: "DevOps",
  ai: "AI",
  web3: "Web3",
};
const ORDER = ["fullstack", "frontend", "backend", "ai", "devops", "web3"];

export const categoryLabel = (id: string) => LABELS[id] ?? id.charAt(0).toUpperCase() + id.slice(1);

/** "Full stack · AI" — the domain part of a project kicker. */
export function domainLabel(categories: string[]): string {
  const set = new Set(categories);
  const parts = set.has("fullstack")
    ? ["fullstack", ...ORDER.filter((c) => c !== "fullstack" && c !== "frontend" && c !== "backend" && set.has(c))]
    : ORDER.filter((c) => set.has(c)).concat(categories.filter((c) => !ORDER.includes(c)));
  return parts.map(categoryLabel).join(" · ");
}

export type Chip = { id: string; label: string; count: number };

/** Filter chips: "All" plus every category that narrows the list, in a fixed order, with real counts. */
export function categoryChips(projects: Project[]): Chip[] {
  const counts = new Map<string, number>();
  for (const p of projects) for (const c of new Set(p.category)) counts.set(c, (counts.get(c) ?? 0) + 1);
  const ids = [...counts.keys()].sort((a, b) => {
    const ra = ORDER.indexOf(a) === -1 ? ORDER.length : ORDER.indexOf(a);
    const rb = ORDER.indexOf(b) === -1 ? ORDER.length : ORDER.indexOf(b);
    return ra - rb || a.localeCompare(b);
  });
  return [
    { id: "all", label: "All", count: projects.length },
    ...ids
      .map((id) => ({ id, label: categoryLabel(id), count: counts.get(id) ?? 0 }))
      .filter((chip) => chip.count < projects.length),
  ];
}
