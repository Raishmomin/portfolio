// Public API of the Neural 3D module. Pages import ONLY from here (relative path: components/neural).
// STUB until the engine lane lands — exports and props are the contract (tasks/neural-spec.md).
import type { NeuralData } from "./types";

export type { NeuralData, SceneKey, SceneProps, ScenePalette, SkillLayer } from "./types";
export { SCENE_KEYS } from "./types";
export { toNeuralData, isAiProject } from "./neural-data";

/** Fixed full-viewport 3D stage for the home page (mount once, first child of <main>). */
export function NeuralStage({ data }: { data: NeuralData }) {
  void data;
  return <div aria-hidden="true" data-neural-stage className="pointer-events-none fixed inset-0 -z-10" />;
}

/** Small static, server-rendered neural-network SVG for subpage headers (no JS). */
export function NeuralMotif({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 200 120" className={className} fill="none">
      {[20, 60, 100].map((y) => <circle key={`a${y}`} cx="30" cy={y} r="4" className="fill-muted-foreground" />)}
      {[40, 80].map((y) => <circle key={`b${y}`} cx="170" cy={y} r="4" className="fill-primary" />)}
      {[20, 60, 100].flatMap((y1) => [40, 80].map((y2) => <line key={`${y1}-${y2}`} x1="30" y1={y1} x2="170" y2={y2} className="stroke-border" />))}
    </svg>
  );
}
