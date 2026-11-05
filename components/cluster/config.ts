// Tiny shared constants. The client island imports this, so it must stay free of
// formations.ts and three.
import type { ClusterVariant } from "./types";

/** "portrait" suits the tall sticky panel and motifs; "landscape" the 16:10 band. */
export type Layout = "portrait" | "landscape";

/** Instance budget and layout the poster draws per variant (the scene matches the layout). */
export const POSTER_PRESETS: Record<ClusterVariant, { count: number; layout: Layout }> = {
  sticky: { count: 200, layout: "portrait" },
  band: { count: 120, layout: "landscape" },
  motif: { count: 40, layout: "portrait" },
};

/** Breathing room around a formation, shared by the poster viewBox and the scene's camera fit. */
export const VIEW_MARGIN = 1.14;

/** Cells per node side for an instance budget: 3 nodes, the third half full. */
export function nodeSide(count: number): number {
  return count >= 160 ? 8 : count >= 90 ? 6 : 4;
}

/** Pods the hero formation schedules (the rest stay unscheduled, scaled to 0). */
export function heroPods(count: number): number {
  const n = nodeSide(count);
  return (n * n * 5) / 2;
}
