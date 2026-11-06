// Public API of the Neural 3D module. Pages import ONLY from here (relative path: components/neural).
// NeuralStage and NeuralMotif are Server Components: their posters are server HTML; the
// stage's client island adds the gated, lazy WebGL canvas (tasks/neural-spec.md).
import type { NeuralData } from "./types";
import { NeuralPoster } from "./poster";
import { NeuralIsland } from "./stage-island";

export type { NeuralData, SceneKey, SceneProps, ScenePalette, SkillLayer } from "./types";
export { SCENE_KEYS } from "./types";
export { toNeuralData, isAiProject } from "./neural-data";
export { NeuralMotif } from "./motif";

/**
 * Fixed full-viewport 3D stage for the home page (mount once, first child of <main>).
 * Server HTML: an animated SVG poster of the hero network. On capable devices, after
 * `load` + idle, one WebGL canvas fades in over it and follows the [data-section]s.
 */
export function NeuralStage({ data }: { data: NeuralData }) {
  return (
    <div
      aria-hidden="true"
      role="presentation"
      tabIndex={-1}
      data-neural-stage=""
      className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-lvh overflow-hidden [contain:strict]"
    >
      <NeuralPoster />
      <NeuralIsland data={data} />
    </div>
  );
}
