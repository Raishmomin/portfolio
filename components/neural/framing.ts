// Composition (lazy 3D chunk): how each section's data-stage frames the scene, as one
// blendable vector. The director mixes the vectors of the sections around the viewport
// centre by their crossfade weights; the stage's rig eases the mix, shifts the camera's
// view onto the free part of the viewport and writes the live result into `framing`,
// which scenes read in useFrame to size themselves to the space they own.
import type { Camera, PerspectiveCamera } from "three";
import type { SceneKey, StageLayout } from "./types";

/** One composition: free rect + dimmer mask. All values are viewport fractions (y top-down). */
export type Composition = {
  /** Centre of the free rect relative to the viewport centre (+x right, +y down). */
  cx: number;
  cy: number;
  /** Free rect size. */
  w: number;
  h: number;
  /** 0..1: the scene may grow past its usual size ("full": big and centred). */
  grow: number;
  /** Dimmer weights (sum ≈ 1): content on the left / right / everywhere / below the band. */
  mL: number;
  mR: number;
  mF: number;
  mB: number;
};

export const zeroComposition = (): Composition => ({ cx: 0, cy: 0, w: 0, h: 0, grow: 0, mL: 0, mR: 0, mF: 0, mB: 0 });

/** Band sections: the scene owns this top part of the viewport (below the header). */
export const BAND_TOP = 0.08;
export const BAND_BOTTOM = 0.47;

const DESKTOP: Record<StageLayout, Composition> = {
  // Side compositions: the free rect is x 0.55–0.99 (mirrored), leaving room for panels a
  // little wider than half the page.
  left: { cx: 0.27, cy: 0.03, w: 0.44, h: 0.84, grow: 0, mL: 1, mR: 0, mF: 0, mB: 0 },
  right: { cx: -0.27, cy: 0.03, w: 0.44, h: 0.84, grow: 0, mL: 0, mR: 1, mF: 0, mB: 0 },
  full: { cx: 0, cy: 0.03, w: 1, h: 0.92, grow: 1, mL: 0, mR: 0, mF: 1, mB: 0 },
  band: { cx: 0, cy: (BAND_TOP + BAND_BOTTOM) / 2 - 0.5, w: 1, h: BAND_BOTTOM - BAND_TOP, grow: 0.4, mL: 0, mR: 0, mF: 0, mB: 1 },
};

/** Phones: the scene sits centred and modest; the dimmer opens a window at section openings. */
const PHONE: Composition = { cx: 0, cy: -0.08, w: 1, h: 0.55, grow: 0, mL: 0, mR: 0, mF: 1, mB: 0 };

/** The hero network spans the full width behind the headline whatever the layout. */
export function compositionFor(layout: StageLayout, scene: SceneKey, phone: boolean, out: Composition): Composition {
  const c = phone ? PHONE : DESKTOP[layout];
  Object.assign(out, c);
  if (!phone && scene === "hero") {
    out.cx = 0;
    out.cy = 0;
    out.w = 1;
    out.h = 1;
    out.grow = 0;
  }
  return out;
}

export const isLayout = (v: string | undefined): v is StageLayout => v === "left" || v === "right" || v === "full" || v === "band";

/** Live, eased framing (written by the rig every frame, read by scenes). */
export const framing = {
  /** Free rect size as viewport fractions. */
  w: 1,
  h: 1,
  /** 0..1 how "full" the composition is (scenes may grow up to their own cap). */
  grow: 0,
  phone: false,
};

/**
 * Uniform scale that fits a scene of the given half extents (world units, at the origin)
 * into the free rect. `cap` is the largest scale in a normal composition; in "full" it may
 * reach `capFull`.
 */
export function fitFree(camera: Camera, size: { width: number; height: number }, halfWidth: number, halfHeight: number, cap = 1, capFull = cap): number {
  const c = camera as PerspectiveCamera;
  if (!c.isPerspectiveCamera) return 1;
  const halfH = (c.position.length() * Math.tan((c.fov * Math.PI) / 360)) / c.zoom;
  const halfW = halfH * (size.width / Math.max(1, size.height));
  const limit = cap + (capFull - cap) * framing.grow;
  return Math.min(limit, (halfW * framing.w) / halfWidth, (halfH * framing.h) / halfHeight);
}
