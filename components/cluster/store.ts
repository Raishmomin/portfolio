// Scene state shared by the DOM islands and the R3F scene. Vanilla (no React
// bindings): the scene reads it with getState() inside useFrame, so changes never
// re-render React.
import { createStore } from "zustand/vanilla";
import type { FormationKey, SkillGroupKey } from "./types";

export type ClusterState = {
  section: FormationKey;
  /** slugify(title) of the hovered/focused featured project card. */
  focusProject: string | null;
  focusGroup: SkillGroupKey | null;
  /** True while a live canvas is showing (false: poster). */
  enabled: boolean;
  /** Bumped by the Reschedule button; the scene scatters and regroups on change. */
  reschedules: number;
  /**
   * Token of the scene holding the page's single WebGL context: set when its context is
   * created, cleared only once that context is lost. An island mounts a scene only while
   * this is null, so two contexts never overlap (e.g. when a resize swaps the sticky
   * panel for the mobile band, or the 3D is toggled off and on during the crossfade).
   */
  owner: string | null;
};

export const clusterStore = createStore<ClusterState>()(() => ({
  section: "hero",
  focusProject: null,
  focusGroup: null,
  enabled: false,
  reschedules: 0,
  owner: null,
}));

export function reschedule() {
  clusterStore.setState((s) => ({ reschedules: s.reschedules + 1 }));
}
