// Pure, server-safe derivations for the home page. Every figure shown on "/" is
// computed here or in components/neural/neural-data.ts from DB data — never typed by hand.
import type { Project } from "@/lib/data";
import type { NeuralData, SkillLayer } from "../neural";

const LAYER_LABEL: Record<SkillLayer, string> = {
  frontend: "Frontend",
  backend: "Backend",
  database: "Data",
  devops: "DevOps",
  ai: "AI",
};

export type SkillLayerGroup = { layer: SkillLayer; label: string; skills: NeuralData["skills"] };

/** The stack constellation's nodes grouped by layer, in DB order (same ids as the 3D nodes). */
export function skillLayers(skills: NeuralData["skills"]): SkillLayerGroup[] {
  const groups = new Map<SkillLayer, NeuralData["skills"]>();
  for (const s of skills) groups.set(s.layer, [...(groups.get(s.layer) ?? []), s]);
  return [...groups].map(([layer, list]) => ({ layer, label: LAYER_LABEL[layer], skills: list }));
}

/** Months as "1 yr 5 mos" / "8 mos". */
export function durationLabel(months: number): string {
  const y = Math.floor(months / 12);
  const m = months % 12;
  const parts = [y ? `${y} yr${y > 1 ? "s" : ""}` : "", m ? `${m} mo${m > 1 ? "s" : ""}` : ""].filter(Boolean);
  return parts.join(" ") || "1 mo";
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
