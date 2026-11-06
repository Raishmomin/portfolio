// Scroll director (lazy 3D chunk): maps the [data-section] elements' positions to a
// per-scene blend weight and progress. Scenes crossfade across section boundaries;
// sections without a scene (services, writing, faq, cta, …) keep the previous scene
// at half weight. Values live in a tiny external store with one snapshot per scene,
// so a scene re-renders only when its own (quantized) values change.
import { SCENE_KEYS, type SceneKey } from "./types";

export type SceneSnap = { weight: number; progress: number };
type Frame = { weight: Record<SceneKey, number>; progress: Record<SceneKey, number> };

/** Weight given to the previous scene while a section without a scene is centred. */
const INHERIT = 0.5;

const isScene = (k: string | undefined): k is SceneKey => !!k && (SCENE_KEYS as readonly string[]).includes(k);
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (v: number) => v * v * (3 - 2 * v);

function emptyFrame(): Frame {
  const weight = {} as Record<SceneKey, number>;
  const progress = {} as Record<SceneKey, number>;
  for (const k of SCENE_KEYS) weight[k] = progress[k] = 0;
  return { weight, progress };
}

/** Reads the sections' rects once and fills `out` (no allocation besides the rect objects). */
export function measure(out: Frame = emptyFrame()): Frame {
  const sections = document.querySelectorAll<HTMLElement>("[data-section]");
  const vh = window.innerHeight || 1;
  const c = vh / 2; // the reference line: the viewport's centre
  const band = Math.min(vh * 0.22, 220); // crossfade half-width around each boundary
  for (const k of SCENE_KEYS) out.weight[k] = 0;
  let prev: SceneKey = "hero";
  let total = 0;
  let nearest: { key: SceneKey; dim: number; d: number } | null = null;
  const parts: { key: SceneKey; dim: number; f: number }[] = [];
  sections.forEach((el) => {
    const raw = el.dataset.section;
    const scene = isScene(raw);
    const key: SceneKey = scene ? raw : prev;
    if (scene) prev = raw;
    const r = el.getBoundingClientRect();
    if (r.height <= 0) return;
    if (scene) out.progress[key] = clamp01((c - r.top) / r.height);
    const f = smooth(Math.min(clamp01((c - r.top + band) / (2 * band)), clamp01((r.bottom + band - c) / (2 * band))));
    const dim = scene ? 1 : INHERIT;
    const d = c < r.top ? r.top - c : c > r.bottom ? c - r.bottom : 0;
    if (!nearest || d < nearest.d) nearest = { key, dim, d };
    if (f > 0) {
      parts.push({ key, dim, f });
      total += f;
    }
  });
  if (total > 0) {
    // Gaps between sections (or a short page) renormalise, so weights never sag.
    const norm = total < 1 ? 1 / total : 1;
    for (const p of parts) out.weight[p.key] += p.f * norm * p.dim;
  } else if (nearest) {
    const n = nearest as { key: SceneKey; dim: number };
    out.weight[n.key] = n.dim;
  } else {
    out.weight.hero = 1; // no sections at all: show the hero
  }
  for (const k of SCENE_KEYS) out.weight[k] = clamp01(out.weight[k]);
  return out;
}

/** The scene with the highest weight (ties go to the earlier one). */
export function activeScene(f: Frame): SceneKey {
  let best: SceneKey = "hero";
  for (const k of SCENE_KEYS) if (f.weight[k] > f.weight[best]) best = k;
  return best;
}

const q = (v: number, steps: number) => Math.round(v * steps) / steps;

export class SceneStore {
  readonly frame = emptyFrame();
  private snaps = {} as Record<SceneKey, SceneSnap>;
  private readonly listeners = new Map<SceneKey, Set<() => void>>();
  active: SceneKey = "hero";
  private marked = false;

  constructor() {
    for (const k of SCENE_KEYS) this.snaps[k] = { weight: 0, progress: 0 };
  }

  /** Re-measure; notifies only the scenes whose quantized weight/progress changed. */
  update() {
    measure(this.frame);
    const active = activeScene(this.frame);
    if (active !== this.active || !this.marked) {
      this.active = active;
      this.marked = true;
      // Exposed for QA and CSS hooks: the scene the stage is showing.
      document.querySelector("[data-neural-stage]")?.setAttribute("data-scene", active);
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
