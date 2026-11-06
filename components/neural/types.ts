// CONTRACT for the "Neural" redesign (tasks/neural-spec.md). Every lane codes against these shapes.
// Server-safe: no three.js / React imports here.

/** Scene keys = home section keys (data-section="<key>"). Order = scroll order. */
export type SceneKey = "hero" | "stack" | "experience" | "ai" | "work" | "contact";
export const SCENE_KEYS: readonly SceneKey[] = ["hero", "stack", "experience", "ai", "work", "contact"];

export type SkillLayer = "frontend" | "backend" | "database" | "devops" | "ai";

export type NeuralData = {
  /** Skills as graph nodes. `uses` = number of projects listing it (shared counter). */
  skills: { id: string; name: string; layer: SkillLayer; uses: number }[];
  /** Undirected edges: two skills used together in at least one project. weight = number of shared projects. */
  links: { a: string; b: string; weight: number }[];
  /** Oldest first. months from the shared period helper. */
  experience: { company: string; role: string; period: string; months: number; current: boolean }[];
  /** AI projects (category "AI" or AI terms in title/description/technologies), display order. */
  ai: { slug: string; title: string; stages: string[] }[];
  /** Featured projects for the work scene (display order). */
  work: { slug: string; title: string; techCount: number; ai: boolean }[];
};

/**
 * Props every 3D scene component receives (components/neural/scenes/<key>.tsx, default export).
 * - progress: 0..1 scroll progress through ITS section (0 = section top enters centre, 1 = leaves)
 * - weight:   0..1 blend weight (1 when its section is the active one; scenes fade/scale with it, and
 *             must render nothing / skip work when weight === 0)
 * - pointer:  normalized pointer (-1..1), {0,0} on touch
 * - focus:    slug/skill id currently hovered/focused in the DOM (data-focus-id), or null
 * - palette:  theme colours read from CSS variables (hex strings)
 */
export type ScenePalette = { bg: string; fg: string; muted: string; accent: string; ok: string; ai: string; line: string };
export type SceneProps = {
  data: NeuralData;
  progress: number;
  weight: number;
  pointer: { x: number; y: number };
  focus: string | null;
  palette: ScenePalette;
  quality: "high" | "low";
};

/**
 * DOM hooks (no imports needed; the engine listens via event delegation / IntersectionObserver):
 * - home sections:        data-section="<SceneKey>"   (plus non-scene sections: services, writing, faq)
 * - hover/focus targets:  data-focus-id="<skill id | project slug>"
 * - motion targets:       data-reveal, data-reveal-delay="<ms>", data-parallax="<-1..1>", data-split (headings except h1)
 * - 3D toggle contract:   localStorage "cp:3d" = "on" | "off" | (absent = auto); html[data-motion]; window event "cp:3d"
 */
