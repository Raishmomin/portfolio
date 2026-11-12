// Scroll director (lazy 3D chunk): maps the [data-section] elements' positions to a
// per-scene blend weight and progress, plus the composition the stage frames them in.
// - Scene of a section: data-scene="<key>", else its data-section name when that is a
//   scene key, else "ambient" (never the previous section's scene).
// - Composition: data-stage="left|right|full|band" (default left), blended like the
//   scenes across section boundaries (weights sharpened, so the incoming section owns the
//   framing early). A band is measured: from the section top (or the header) down to
//   where its content starts ([data-stage-content], else the first h1/h2), and the scene
//   is framed into it.
// - Phones (<1024px): a scene shows only in its section's OPENING (the room between the
//   section top and its content), never under text. The opening with the most of itself in
//   view owns the stage alone, fading in over its first OPEN_T0..OPEN_T1 of visible height,
//   and frames the scene (composition = that visible opening); with no opening in view,
//   every weight is 0 and nothing draws.
// - Per scene, the unblended free rect of its driving section goes to framing.sceneFrames.
// - Pinned sections (ScrollTrigger wraps them in a .pin-spacer) are measured through
//   their spacer, so progress keeps moving while the section itself stands still; a live
//   [data-hscroll] section (sticky frame) progresses with its horizontal journey.
// Values live in a tiny external store with one snapshot per scene, so a scene
// re-renders only when its own (quantized) values change.
import {
  BAND_BOTTOM,
  BAND_MAX,
  BAND_MIN,
  BAND_TOP,
  compositionFor,
  isLayout,
  rectOf,
  sceneFrames,
  zeroComposition,
  type Composition,
} from "./framing";
import { SCENE_KEYS, STAGE_LAYOUTS, type SceneKey, type StageLayout } from "./types";

export type SceneSnap = { weight: number; progress: number };
/** A vertical window of the viewport (fractions, top-down) where the scene owns the space. */
export type Window = { top: number; bottom: number };
export type Frame = {
  weight: Record<SceneKey, number>;
  progress: Record<SceneKey, number>;
  /** Weight per data-stage layout (sums to 1). */
  layout: Record<StageLayout, number>;
  /** Target composition (blend of the sections' compositions). */
  comp: Composition;
  /** Desktop band sections: the clear band above their content. */
  band: Window;
  /** Phones: the section opening (above its heading) currently in view, if any. */
  open: Window;
  phone: boolean;
};

const isScene = (k: string | undefined): k is SceneKey => !!k && (SCENE_KEYS as readonly string[]).includes(k);
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const smooth = (v: number) => v * v * (3 - 2 * v);

export const PHONE_MAX = 1023;

export function sceneOf(el: HTMLElement): SceneKey {
  const explicit = el.dataset.scene;
  if (isScene(explicit)) return explicit;
  const name = el.dataset.section;
  return isScene(name) ? name : "ambient";
}

export function emptyFrame(): Frame {
  const weight = {} as Record<SceneKey, number>;
  const progress = {} as Record<SceneKey, number>;
  for (const k of SCENE_KEYS) weight[k] = progress[k] = 0;
  const layout = {} as Record<StageLayout, number>;
  for (const l of STAGE_LAYOUTS) layout[l] = 0;
  return { weight, progress, layout, comp: zeroComposition(), band: { top: 0, bottom: 0 }, open: { top: 0, bottom: 0 }, phone: false };
}

/** Where a section's content starts (its heading), so its opening / band can be kept clear. */
const headCache = new WeakMap<HTMLElement, HTMLElement | null>();
function headOf(el: HTMLElement): HTMLElement | null {
  let h = headCache.get(el);
  if (h === undefined || (h && !h.isConnected)) {
    h = el.querySelector<HTMLElement>("[data-stage-content], h1, h2");
    headCache.set(el, h);
  }
  return h;
}

const KEY_W = 28; // px kept clear above a heading (its kicker line)
const CONTENT_W = 14; // px kept clear above a [data-stage-content] block
/** Phones: the sticky header's bottom (px); an opening shows below it. */
const PHONE_TOP = 65;
/** Phones: a section opens with a room for its scene when this much (px) sits above its content. */
const OPEN_MIN = 120;
/** Phones: the visible opening height (viewport fractions) where its scene starts to fade in / is at full strength. */
const OPEN_T0 = 0.07;
const OPEN_T1 = 0.17;
/** Top of a section's content minus the clearance kept above it (px), or null. */
function contentTop(el: HTMLElement): number | null {
  const head = headOf(el);
  if (!head) return null;
  return head.getBoundingClientRect().top - (head.hasAttribute("data-stage-content") ? CONTENT_W : KEY_W);
}
const tmpComp = zeroComposition();
type Part = { key: SceneKey; layout: StageLayout; f: number; el: HTMLElement; top: number };
const parts: Part[] = [];
const bestF = {} as Record<SceneKey, number>;

/** Reads the sections' rects once and fills `out`. */
export function measure(out: Frame = emptyFrame()): Frame {
  const sections = document.querySelectorAll<HTMLElement>("[data-section]");
  const vh = window.innerHeight || 1;
  const phone = window.innerWidth <= PHONE_MAX;
  const c = vh / 2; // the reference line: the viewport's centre
  const band = Math.min(vh * 0.22, 220); // crossfade half-width around each boundary
  for (const k of SCENE_KEYS) {
    out.weight[k] = 0;
    bestF[k] = -1;
  }
  for (const l of STAGE_LAYOUTS) out.layout[l] = 0;
  out.phone = phone;
  out.open.top = out.open.bottom = 0;
  parts.length = 0;
  let total = 0;
  let nearest: { key: SceneKey; layout: StageLayout; el: HTMLElement; d: number } | null = null;
  // Phones: the opening with the most of itself in view (px, visible top/bottom).
  let open: { key: SceneKey; layout: StageLayout; el: HTMLElement; vis: number; t: number; b: number } | null = null;

  sections.forEach((el) => {
    // A pinned section stands still inside its spacer: the spacer carries the scroll.
    const spacer = el.parentElement?.classList.contains("pin-spacer") ? el.parentElement : null;
    const r = (spacer ?? el).getBoundingClientRect();
    if (r.height <= 0) return;
    const key = sceneOf(el);
    const stage = el.dataset.stage;
    const layout: StageLayout = isLayout(stage) ? stage : "left";
    // Pinned (spacer) and sticky horizontal-journey sections ([data-hscroll-live]: one
    // viewport plus the track's overflow tall) progress exactly with their scrub: 0 when
    // they reach the top of the viewport, 1 when their bottom meets its bottom.
    const held = spacer || el.hasAttribute("data-hscroll-live");
    const progress = held ? clamp01(-r.top / Math.max(1, r.height - vh)) : clamp01((c - r.top) / r.height);
    const f = smooth(Math.min(clamp01((c - r.top + band) / (2 * band)), clamp01((r.bottom + band - c) / (2 * band))));
    // Several sections may share a scene (subpages): the most central one drives it.
    if (f > bestF[key]) {
      bestF[key] = f;
      out.progress[key] = progress;
    }
    const d = c < r.top ? r.top - c : c > r.bottom ? c - r.bottom : 0;
    if (!nearest || d < nearest.d) nearest = { key, layout, el, d };
    if (f > 0) {
      parts.push({ key, layout, f, el, top: spacer ? el.getBoundingClientRect().top : r.top });
      total += f;
    }
    // Phones: the opening of a section (above its content) is where its scene shows.
    if (phone && r.bottom > 0 && r.top < vh) {
      const ct = contentTop(el);
      if (ct !== null && ct - r.top >= OPEN_MIN) {
        const t = Math.max(PHONE_TOP, r.top);
        const b = Math.min(vh, ct);
        if (b - t > (open?.vis ?? 0)) open = { key, layout, el, vis: b - t, t, b };
      }
    }
  });

  if (phone) return measurePhone(out, open, vh);

  if (total === 0 && nearest) {
    const n = nearest as { key: SceneKey; layout: StageLayout; el: HTMLElement };
    parts.push({ key: n.key, layout: n.layout, f: 1, el: n.el, top: n.el.getBoundingClientRect().top });
    total = 1;
  }

  const comp = out.comp;
  for (const k of Object.keys(comp) as (keyof Composition)[]) comp[k] = 0;
  let bandW = 0;
  let bandTop = 0;
  let bandBottom = 0;
  if (total > 0) {
    // Gaps between sections (or a short page) renormalise, so weights never sag. The
    // composition uses sharpened weights (f³): the section taking over frames the camera
    // early, so its scene is not left off-centre and small while the previous one fades.
    const norm = 1 / total;
    let sharp = 0;
    for (const p of parts) sharp += (p.f * norm) ** 3;
    for (const p of parts) {
      const w = p.f * norm;
      const wc = (w * w * w) / sharp;
      out.weight[p.key] += w;
      out.layout[p.layout] += w;
      compositionFor(p.layout, p.key, phone, tmpComp);
      let bandT = 0;
      let bandB = 0;
      if (p.layout === "band") {
        // The measured band: section top (or the header line) down to its content.
        const top = clamp(p.top / vh, BAND_TOP, 1);
        const ct = contentTop(p.el);
        const bottom = clamp(ct === null ? BAND_BOTTOM : ct / vh, top, BAND_MAX);
        bandTop += top * w;
        bandBottom += bottom * w;
        bandW += w;
        const h = Math.max(BAND_MIN, bottom - top);
        tmpComp.h = h;
        tmpComp.cy = top + h / 2 - 0.5;
        bandT = top;
        bandB = bottom;
      }
      for (const k of Object.keys(comp) as (keyof Composition)[]) comp[k] += tmpComp[k] * wc;
      // The scene's own frame: its most central section's free rect, unblended.
      if (p.f >= bestF[p.key] - 1e-6) {
        const sf = sceneFrames[p.key];
        sf.el = p.el;
        sf.layout = p.layout;
        if (p.layout === "band") {
          sf.rect.l = 0;
          sf.rect.r = 1;
          sf.rect.t = bandT;
          sf.rect.b = bandB;
        } else rectOf(tmpComp, sf.rect);
      }
    }
  } else {
    // No sections at all: a calm field.
    out.weight.ambient = 1;
    out.layout.full = 1;
    compositionFor("full", "ambient", phone, comp);
  }
  out.band.top = bandW > 0 ? bandTop / bandW : BAND_TOP;
  out.band.bottom = bandW > 0 ? bandBottom / bandW : BAND_BOTTOM;
  for (const k of SCENE_KEYS) out.weight[k] = clamp01(out.weight[k]);
  return out;
}

/**
 * Phones: the opening most in view owns the stage alone (never two scenes at once): its
 * scene's weight follows how much of the opening shows, the composition and the scene's
 * own frame are that visible opening, and the dimmer erases everything outside it.
 */
function measurePhone(
  out: Frame,
  open: { key: SceneKey; layout: StageLayout; el: HTMLElement; vis: number; t: number; b: number } | null,
  vh: number,
): Frame {
  const comp = out.comp;
  out.band.top = BAND_TOP;
  out.band.bottom = BAND_BOTTOM;
  if (!open) {
    // Nothing to show: every weight stays 0 (the last composition stays as it was).
    out.layout.full = 1;
    out.open.top = out.open.bottom = 0;
    return out;
  }
  const t = open.t / vh;
  const b = open.b / vh;
  out.weight[open.key] = smooth(clamp01((b - t - OPEN_T0) / (OPEN_T1 - OPEN_T0)));
  out.layout[open.layout] = 1;
  out.open.top = t;
  out.open.bottom = b;
  compositionFor(open.layout, open.key, true, comp);
  comp.cy = (t + b) / 2 - 0.5;
  comp.h = b - t;
  const sf = sceneFrames[open.key];
  sf.el = open.el;
  sf.layout = open.layout;
  sf.rect.l = 0.04;
  sf.rect.r = 0.96;
  sf.rect.t = t;
  sf.rect.b = b;
  return out;
}

function argmax<K extends string>(rec: Record<K, number>, keys: readonly K[]): K {
  let best = keys[0];
  for (const k of keys) if (rec[k] > rec[best]) best = k;
  return best;
}

const q = (v: number, steps: number) => Math.round(v * steps) / steps;

export class SceneStore {
  readonly frame = emptyFrame();
  private snaps = {} as Record<SceneKey, SceneSnap>;
  private readonly listeners = new Map<SceneKey, Set<() => void>>();
  active: SceneKey = "hero";
  layout: StageLayout = "left";
  private marked = false;

  constructor() {
    for (const k of SCENE_KEYS) this.snaps[k] = { weight: 0, progress: 0 };
  }

  /** Re-measure; notifies only the scenes whose quantized weight/progress changed. */
  update() {
    measure(this.frame);
    // Phones between openings: no scene has weight; the stage keeps naming the last one.
    const best = argmax(this.frame.weight, SCENE_KEYS);
    const active = this.frame.weight[best] > 0 || !this.marked ? best : this.active;
    const layout = argmax(this.frame.layout, STAGE_LAYOUTS);
    if (active !== this.active || layout !== this.layout || !this.marked) {
      this.active = active;
      this.layout = layout;
      this.marked = true;
      // Exposed for QA and CSS hooks: the scene and composition the stage is showing.
      const stage = document.querySelector("[data-neural-stage]");
      stage?.setAttribute("data-scene", active);
      stage?.setAttribute("data-stage-layout", layout);
    }
    for (const k of SCENE_KEYS) {
      const weight = q(this.frame.weight[k], 100);
      const progress = q(this.frame.progress[k], 1000);
      const snap = this.snaps[k];
      if (snap.weight === weight && (weight === 0 || snap.progress === progress)) continue;
      this.snaps[k] = { weight, progress };
      this.listeners.get(k)?.forEach((l) => l());
    }
  }

  get = (k: SceneKey) => this.snaps[k];

  subscribe(k: SceneKey, l: () => void) {
    let set = this.listeners.get(k);
    if (!set) this.listeners.set(k, (set = new Set()));
    set.add(l);
    return () => void set.delete(l);
  }
}
