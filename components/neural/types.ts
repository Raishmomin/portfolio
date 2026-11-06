// CONTRACT for the "Neural" redesign (tasks/neural-spec.md). Every lane codes against these shapes.
// Server-safe: no three.js / React imports here.

/**
 * Scene keys = home section keys (data-section="<key>"), or picked explicitly with
 * data-scene="<key>" on any [data-section]. Order = scroll order. "ambient" is the calm
 * full-bleed neural field every section without its own scene gets (never the previous one).
 */
export type SceneKey = "hero" | "stack" | "experience" | "ai" | "work" | "contact" | "ambient";
export const SCENE_KEYS: readonly SceneKey[] = ["hero", "stack", "experience", "ai", "work", "contact", "ambient"];

/**
 * Composition of a section (data-stage="<layout>", default "left"): where its content sits,
 * so the stage frames the scene around it. left = content left, scene right; right = the
 * mirror; full = content floats over a centred, large scene (dimmed under text); band = the
 * scene owns a full-width band at the top, content below. Phones (<1024px) ignore it.
 */
export type StageLayout = "left" | "right" | "full" | "band";
export const STAGE_LAYOUTS: readonly StageLayout[] = ["left", "right", "full", "band"];

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
 * - sections:             data-section="<name>" (a SceneKey name uses that scene; others get "ambient"),
 *                         data-scene="<SceneKey>" (explicit scene), data-stage="left|right|full|band"
 * - band sections:        [data-stage-content] (optional) marks where the content starts below the band
 * - label occluders:      .panel, [data-card], [data-occlude] and text never show a 3D label over them
 * - exposed state:        [data-neural-stage][data-scene][data-stage-layout]
 * - hover/focus targets:  data-focus-id="<skill id | project slug>"
 * - motion targets:       data-reveal, data-reveal-delay="<ms>", data-parallax="<-1..1>", data-split (headings except h1)
 * - 3D toggle contract:   localStorage "cp:3d" = "on" | "off" | (absent = auto); html[data-motion]; window event "cp:3d"
 */
