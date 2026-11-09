// Composition (lazy 3D chunk): how each section's data-stage frames the scene, as one
// blendable vector. The director mixes the vectors of the sections around the viewport
// centre by their crossfade weights; the stage's rig eases the mix, shifts the camera's
// view onto the free part of the viewport and writes the live result into `framing`,
// which scenes read in useFrame to size themselves to the space they own.
import type { Camera, PerspectiveCamera } from "three";
import { occluders, scroll } from "./occluders";
import { SCENE_KEYS, type SceneKey, type StageLayout } from "./types";

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
/** Default band bottom (no content marker found). */
export const BAND_BOTTOM = 0.47;
/** The measured band (down to where the content starts) never reaches past this. */
export const BAND_MAX = 0.68;
/** Below this height (viewport fraction) a band is too thin to frame a scene in. */
export const BAND_MIN = 0.1;

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

/** The free rect of a composition, as viewport fractions (top-down). */
export function rectOf(c: Composition, out: Rect): Rect {
  out.l = 0.5 + c.cx - c.w / 2;
  out.r = 0.5 + c.cx + c.w / 2;
  out.t = 0.5 + c.cy - c.h / 2;
  out.b = 0.5 + c.cy + c.h / 2;
  return out;
}

export const isLayout = (v: string | undefined): v is StageLayout => v === "left" || v === "right" || v === "full" || v === "band";

/** A rect as viewport fractions (y top-down). */
export type Rect = { l: number; t: number; r: number; b: number };

/**
 * Per scene, unblended: the free rect of the section that drives it (its own composition;
 * for a band, the measured band above its content; on phones, its opening in view) and that
 * section. Written by the director on every measurement. A scene that frames itself from
 * this rect (instead of the blended camera framing) stays centred and full size while the
 * previous section's composition is still blending out.
 */
export type SceneFrame = { rect: Rect; layout: StageLayout; el: HTMLElement | null };
export const sceneFrames = Object.fromEntries(
  SCENE_KEYS.map((k): [SceneKey, SceneFrame] => [k, { rect: { l: 0, t: 0, r: 1, b: 1 }, layout: "left", el: null }]),
) as Record<SceneKey, SceneFrame>;

/**
 * Visibility guard for scenes that frame themselves in screen space: the part of a free
 * rect (CSS px) that no opaque content ([data-card], .panel, [data-occlude], text) covers,
 * shrunk from the bottom (content below a band), else taken from its lower part, or null
 * when less than `minH` px stays clear. Scenes reframe into it rather than draw under
 * content. Callers keep the occluder registry retained (a LabelLayer does).
 */
export function clearRect(r: Rect, minH: number, out: Rect): Rect | null {
  occluders.sync(scroll.x, scroll.y);
  Object.assign(out, r);
  if (out.b - out.t < minH) return null;
  if (!occluders.hits(out.l, out.t, out.r, out.b)) return out;
  // Largest clear bottom for a given top (hits are monotonic in the rect's height).
  const fit = (top: number) => {
    let lo = top + minH;
    if (occluders.hits(out.l, top, out.r, lo)) return -1;
    let hi = out.b;
    for (let i = 0; i < 9 && hi - lo > 2; i++) {
      const mid = (lo + hi) / 2;
      if (occluders.hits(out.l, top, out.r, mid)) hi = mid;
      else lo = mid;
    }
    return lo;
  };
  let b = fit(out.t);
  if (b < 0) {
    // Content at the top of the rect: try its lower part.
    const t2 = out.t + (out.b - out.t) * 0.4;
    if (out.b - t2 < minH) return null;
    b = fit(t2);
    if (b < 0) return null;
    out.t = t2;
  }
  out.b = b;
  return out;
}

/** The per-frame scroll snapshot (perf P5); it lives in occluders.ts, the leaf module both use. */
export { scroll };

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
