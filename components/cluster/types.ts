// CONTRACT between the UI lanes and the 3D lane (tasks/design-spec.md §4). Do not change shapes without updating both.

export type FormationKey = "hero" | "about" | "stack" | "experience" | "work" | "contact";
export const FORMATION_KEYS: readonly FormationKey[] = ["hero", "about", "stack", "experience", "work", "contact"];

export type SkillGroupKey = "frontend" | "backend" | "database" | "devops";

/** Derived from real data on the server, passed as a serializable prop. */
export type FormationData = {
  skills: { group: SkillGroupKey; count: number }[];
  experience: { company: string; months: number }[];
  projects: { slug: string; techCount: number }[]; // featured projects, in display order
};

/**
 * DOM hooks the 3D island listens to (event delegation — no imports needed in UI code):
 * - Sections:        data-section="hero|about|stack|experience|work|contact"
 * - Project cards:   data-project-slug="<slugify(title)>"  (hover/focus raises its column)
 * - Skill groups:    data-skill-group="frontend|backend|database|devops"
 * - Nav links:       data-nav-section="<FormationKey>"  (scroll-spy sets aria-current="true")
 */
export type ClusterVariant = "sticky" | "band" | "motif";
