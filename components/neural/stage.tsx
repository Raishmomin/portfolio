"use client";

// The lazy WebGL stage (loaded only by stage-island.tsx via next/dynamic, ssr:false):
// one perspective <Canvas> behind the home page, the scroll director that blends the
// section scenes, the shared camera rig, theme palette, DOM focus delegation and the
// frame monitor. Decorative only: no text, no interaction in the canvas.
//
// Conventions for scene authors (scenes/<key>.tsx, default export, SceneProps):
// - Build around the world origin. Without a rig of its own a scene is framed by a
//   camera at (0, 0, DEFAULT_DISTANCE = 14) looking at the origin, vertical FOV 40°.
// - The rig sets camera.position/lookAt every frame BEFORE scenes run (useFrame
//   priority -1). A scene may add an absolute offset afterwards in its own useFrame.
// - `pointer` is a live, smoothed object: read pointer.x / pointer.y inside useFrame.
// - Return null and skip useFrame work while weight === 0.
// - Composition: the rig shifts the camera's view so the origin lands in the centre of the
//   free part of the viewport that the section's data-stage leaves (framing.ts); size the
//   scene with fitFree()/fitScale() so it fills that space and never sits under content.
//   A full-screen dimmer drawn last keeps the scene quiet wherever content sits.
// - Band sections are measured: the band runs down to where the content starts
//   ([data-stage-content], else the first h1/h2), and the camera frames the scene into it.
//   A scene that wants its OWN section's frame, unaffected by the blend with the previous
//   section, reads framing.sceneFrames[key] (free rect + section element) and may pass it
//   through framing.clearRect(), the visibility guard that shrinks a rect until no opaque
//   content covers it (the experience scene lays itself out this way).
import { Canvas, useFrame, useThree, type GLProps } from "@react-three/fiber";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ComponentType } from "react";
import {
  AddEquation,
  BufferGeometry,
  CustomBlending,
  Float32BufferAttribute,
  Mesh,
  OneMinusSrcAlphaFactor,
  ShaderMaterial,
  Vector3,
  WebGLRenderer,
  ZeroFactor,
  type PerspectiveCamera,
} from "three";
import { measure, sceneOf, SceneStore, type Frame } from "./director";
import { framing, scroll, zeroComposition, type Composition } from "./framing";
import { DEFAULT_DISTANCE, FOV, heroCamera, type CameraTarget } from "./hero-layout";
import { readPalette, samePalette } from "./palette";
import { contextOwner, nextIdle, onIdle } from "./runtime";
import { SCENE_KEYS, type NeuralData, type SceneKey, type ScenePalette, type SceneProps } from "./types";

// Every scene is its own lazy chunk: the stage loads the scenes in view first (the hero
// on the home page), then prefetches the page's other scenes in scroll order in idle time,
// so the entry 3D payload stays small and a scene is ready before its section arrives.
type SceneComponent = ComponentType<SceneProps>;
const LOADERS: Record<SceneKey, () => Promise<{ default: SceneComponent }>> = {
  hero: () => import("./scenes/hero"),
  stack: () => import("./scenes/stack"),
  experience: () => import("./scenes/experience"),
  ai: () => import("./scenes/ai"),
  work: () => import("./scenes/work"),
  services: () => import("./scenes/services"),
  writing: () => import("./scenes/writing"),
  faq: () => import("./scenes/faq"),
  contact: () => import("./scenes/contact"),
  ambient: () => import("./scenes/ambient"),
};

/** Loaded scene modules (kept across stage remounts and client navigations); `mods` is replaced on each load. */
const scenes = {
  mods: {} as Readonly<Partial<Record<SceneKey, SceneComponent>>>,
  pending: {} as Partial<Record<SceneKey, Promise<void>>>,
  listeners: new Set<() => void>(),
  load(key: SceneKey): Promise<void> {
    if (this.mods[key]) return Promise.resolve();
    return (this.pending[key] ??= LOADERS[key]().then(
      (m) => {
        this.mods = { ...this.mods, [key]: m.default };
        this.listeners.forEach((l) => l());
      },
      (err: unknown) => {
        // A failed chunk (offline, a deploy in between) may be retried on the next need.
        delete this.pending[key];
        throw err;
      },
    ));
  },
  subscribe(l: () => void) {
    scenes.listeners.add(l);
    return () => void scenes.listeners.delete(l);
  },
};

/** The scenes in view right now (non-zero weight), loaded before the first frame is shown. */
function scenesInView(): SceneKey[] {
  const f = measure();
  return SCENE_KEYS.filter((k) => f.weight[k] > 0);
}

/**
 * The page's other scenes in scroll order (sections below the viewport centre first, then
 * those above it), each loaded in its own idle period. Scenes the page never uses are not
 * fetched; they still load on demand if a section asks for one later.
 */
function prefetchScenes(): () => void {
  const below: SceneKey[] = [];
  const above: SceneKey[] = [];
  const mid = window.innerHeight / 2;
  document.querySelectorAll<HTMLElement>("[data-section]").forEach((el) => {
    const key = sceneOf(el);
    (el.getBoundingClientRect().bottom < mid ? above : below).push(key);
  });
  const queue = [...new Set([...below, ...above.reverse()])].filter((k) => !scenes.mods[k]);
  let cancel = () => {};
  let stopped = false;
  const next = () => {
    const key = queue.shift();
    if (!key || stopped) return;
    cancel = onIdle(() => {
      scenes.load(key).then(next, next);
    }, 1500);
  };
  next();
  return () => {
    stopped = true;
    cancel();
  };
}

// Frame monitor: 1 s windows that judge the 3D's OWN cost per frame (its loop on the main
// thread: every useFrame plus gl.render; its draws on the GPU where timer queries exist),
// not the page's frame rate. A busy page (scroll work, another tab, an editor, a GC pause)
// slows the frame rate without the 3D being the cause, and must never cost the visitor
// the 3D: a window is slow only when the frame rate is low AND the 3D itself is heavy.
const MIN_FPS = 30;
const CPU_BUDGET = 8; // ms/frame of 3D loop time above which the 3D is heavy
const GPU_BUDGET = 12; // ms/frame of GPU time (timer queries) above which the 3D is heavy
const DROP_AFTER = 2; // slow windows in a row → one step down the quality ladder
const SUSTAINED = 8; // slow windows in a row on the last step (scroll windows not counted), averaging
const FALLBACK_FPS = 24; //   below FALLBACK_FPS → the poster (the island may retry later)
const UP_FPS = 55; // windows at this rate with a light 3D (below UP_CPU / UP_GPU) step back up
const UP_CPU = 4;
const UP_GPU = 6;
const UP_AFTER = 10; // fast windows in a row to step up; doubles after every step up, so it never flaps
const QUIET_MS = 2000; // not measured after a scene or quality switch (scenes build and upload buffers)
const PAUSE_MS = 1000; // a longer gap is a pause (hidden tab, idle stop), not a slow frame
const SCROLL_MS = 300; // a window with scrolling this recent never counts toward the fallback
const WARMUP_FRAMES = 90; // first frames compile shaders and build scenes: not measured
/**
 * The quality ladder: full counts at dpr up to 1.5 → dpr 1 (cheap: only the canvas
 * resizes) → half counts (the scenes rebuild once) → the poster. Phones start on the last
 * step and stay there.
 */
const LADDER: { quality: SceneProps["quality"]; dpr: number | [number, number] }[] = [
  { quality: "high", dpr: [1, 1.5] },
  { quality: "high", dpr: 1 },
  { quality: "low", dpr: 1 },
];
const LAST = LADDER.length - 1;
const IDLE_MS = 45_000; // no input for this long pauses the render loop until the next input
const INPUTS = ["scroll", "wheel", "pointerdown", "pointermove", "keydown", "touchstart"] as const;
const CAMERA_TAU = 0.45; // s
const POINTER_TAU = 0.18; // s

export type FallbackReason = "slow" | "lost";
type StageProps = {
  data: NeuralData;
  active: boolean;
  /** A remount after a slow fallback: starts at low quality. */
  retry?: boolean;
  onReady: (ready: boolean) => void;
  /** "slow": the device could not keep up (the island may retry); "lost": the GPU dropped the context (final). */
  onFallback: (reason: FallbackReason) => void;
};

type Quality = SceneProps["quality"];

/** The renderer is created in its own idle period, outside React's commit task. */
const createRenderer: GLProps = async (defaults) => {
  await nextIdle(500);
  return new WebGLRenderer({ ...defaults, antialias: true, powerPreference: "high-performance", alpha: true });
};

/** Per-scene camera targets; scenes without an entry use the default framing. */
function cameraFor(key: SceneKey, aspect: number, progress: number, out: CameraTarget): CameraTarget {
  if (key === "hero") return heroCamera(aspect, progress, out);
  out.px = out.py = out.lx = out.ly = out.lz = 0;
  out.pz = DEFAULT_DISTANCE;
  return out;
}

// The dimmer: a screen-space pass drawn after every scene that scales down what the scenes
// drew (colour and alpha alike) wherever the composition puts content, so text always sits
// over a quiet scene: left / right halves, a uniform veil for "full", everything below the
// band, and on phones everything outside the section opening in view. It is drawn only
// where it dims (perf D1: a full-screen blend cost about 1 ms of GPU per frame on an
// HD 520): two unit quads, each mapped onto a screen rect by the vertex shader (the main
// region, and the strip above a band or an opening), and no draw at all when every weight
// is 0. Outside those rects the fragment would be exactly 0, so the picture is the same.
const DIM_VERT = /* glsl */ `
uniform vec4 uRectA; // screen uv (y up): x0, y0, x1, y1 of quad 0
uniform vec4 uRectB; // ... of quad 1
attribute float aQuad;
varying vec2 vUv;
void main() {
  vec4 r = aQuad > 0.5 ? uRectB : uRectA;
  vUv = mix(r.xy, r.zw, position.xy);
  gl_Position = vec4(vUv * 2.0 - 1.0, 0.0, 1.0);
}`;
const DIM_FRAG = /* glsl */ `
uniform vec4 uMask; // left, right, full, band weights
uniform float uPhone;
uniform vec2 uBand;
uniform vec2 uOpen;
varying vec2 vUv;
float inside(float y, vec2 w) {
  return smoothstep(w.x - 0.04, w.x + 0.02, y) * (1.0 - smoothstep(w.y - 0.03, w.y + 0.05, y));
}
void main() {
  float x = vUv.x;
  float y = 1.0 - vUv.y;
  float a = uMask.x * 0.8 * (1.0 - smoothstep(0.34, 0.62, x))
    + uMask.y * 0.8 * smoothstep(0.38, 0.66, x)
    + uMask.z * 0.42
    + uMask.w * 0.82 * (1.0 - inside(y, uBand));
  a = mix(a, 0.68 * (1.0 - inside(y, uOpen)), uPhone);
  gl_FragColor = vec4(0.0, 0.0, 0.0, clamp(a, 0.0, 0.92));
}`;

/** Below this weight a mask contributes nothing visible: the pass is skipped. */
const DIM_EPS = 0.01;
/** Where the fragment shader's side masks reach (its smoothstep edges), as viewport fractions. */
const DIM_LEFT_TO = 0.62;
const DIM_RIGHT_FROM = 0.38;
/** The fragment shader's band/opening edges: dimmed down to top + 0.02 and from bottom - 0.03. */
const DIM_ABOVE = 0.02;
const DIM_BELOW = 0.03;

/** Two unit quads (xy in 0..1, aQuad 0/1), each mapped onto its own screen rect in the vertex shader. */
function dimGeometry(): BufferGeometry {
  const g = new BufferGeometry();
  const pos: number[] = [];
  const quad: number[] = [];
  for (let q = 0; q < 2; q++) {
    pos.push(0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0);
    quad.push(q, q, q, q);
  }
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("aQuad", new Float32BufferAttribute(quad, 1));
  g.setIndex([0, 1, 2, 2, 1, 3, 4, 5, 6, 6, 5, 7]);
  return g;
}

/** Writes a rect given in top-down viewport fractions as the shader's y-up uv rect. */
function setRect(v: number[], x0: number, top: number, x1: number, bottom: number) {
  v[0] = x0;
  v[1] = 1 - bottom;
  v[2] = x1;
  v[3] = 1 - top;
}

class Dimmer {
  readonly geometry = dimGeometry();
  readonly material = new ShaderMaterial({
    vertexShader: DIM_VERT,
    fragmentShader: DIM_FRAG,
    uniforms: {
      uMask: { value: [0, 0, 0, 0] },
      uPhone: { value: 0 },
      uBand: { value: [0, 0] },
      uOpen: { value: [0, 0] },
      uRectA: { value: [0, 0, 1, 1] },
      uRectB: { value: [0, 0, 0, 0] },
    },
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: CustomBlending,
    blendEquation: AddEquation,
    blendSrc: ZeroFactor,
    blendDst: OneMinusSrcAlphaFactor,
    blendEquationAlpha: AddEquation,
    blendSrcAlpha: ZeroFactor,
    blendDstAlpha: OneMinusSrcAlphaFactor,
  });
  readonly mesh = new Mesh(this.geometry, this.material);

  constructor() {
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1e6;
  }

  update(c: Composition, f: Frame) {
    const u = this.material.uniforms;
    const m = u.uMask.value as number[];
    m[0] = c.mL;
    m[1] = c.mR;
    m[2] = c.mF;
    m[3] = c.mB;
    u.uPhone.value = f.phone ? 1 : 0;
    const b = u.uBand.value as number[];
    b[0] = f.band.top;
    b[1] = f.band.bottom;
    const o = u.uOpen.value as number[];
    o[0] = f.open.top;
    o[1] = f.open.bottom;

    // The region the pass changes (top-down fractions): quad 0 is x0..x1 from `top` to the
    // bottom; quad 1 (band / opening) the strip from the top down to `strip`. A blend of a
    // side and a band, or of both sides, covers the whole screen (the union is no rect).
    let x0 = 1;
    let x1 = 0;
    let top = 0;
    let strip = 0;
    if (f.phone) {
      x0 = 0;
      x1 = 1;
      top = f.open.bottom - DIM_BELOW;
      strip = f.open.top + DIM_ABOVE;
    } else {
      const left = c.mL >= DIM_EPS;
      const right = c.mR >= DIM_EPS;
      const band = c.mB >= DIM_EPS;
      if (c.mF >= DIM_EPS || (left && right) || (band && (left || right))) {
        x0 = 0;
        x1 = 1;
      } else if (left) {
        x0 = 0;
        x1 = DIM_LEFT_TO;
      } else if (right) {
        x0 = DIM_RIGHT_FROM;
        x1 = 1;
      } else if (band) {
        x0 = 0;
        x1 = 1;
        top = f.band.bottom - DIM_BELOW;
        strip = f.band.top + DIM_ABOVE;
      }
    }
    const visible = x1 > x0;
    this.mesh.visible = visible;
    if (!visible) return;
    top = Math.min(1, Math.max(0, top));
    strip = Math.min(1, Math.max(0, strip));
    if (strip >= top) {
      // The clear part is too thin to leave out (or there is none): one quad, top to bottom.
      top = 0;
      strip = 0;
    }
    setRect(u.uRectA.value as number[], x0, top, x1, 1);
    if (strip > 0) setRect(u.uRectB.value as number[], x0, 0, x1, strip);
    this.geometry.setDrawRange(0, strip > 0 ? 12 : 6);
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}

/** Mutable per-frame state (smoothed pointer, camera rig, frame monitor) outside React. */
class Rig {
  /** The live, smoothed pointer every scene receives. */
  readonly pointer = { x: 0, y: 0 };
  private readonly raw = { x: 0, y: 0 };
  private readonly pos = new Vector3();
  private readonly look = new Vector3();
  private readonly target: CameraTarget = { px: 0, py: 0, pz: 0, lx: 0, ly: 0, lz: 0 };
  private readonly sum: CameraTarget = { px: 0, py: 0, pz: 0, lx: 0, ly: 0, lz: 0 };
  private first = true;

  setPointer(x: number, y: number) {
    this.raw.x = x;
    this.raw.y = y;
  }

  /** Eased composition (free rect + dimmer weights). */
  readonly comp: Composition = zeroComposition();
  private appliedX = NaN;
  private appliedY = NaN;
  private appliedW = 0;
  private appliedH = 0;

  /** Advances one frame: pointer, camera rig, composition. */
  frame(
    camera: PerspectiveCamera,
    rawDelta: number,
    aspect: number,
    store: SceneStore,
    size: { width: number; height: number },
    dim: Dimmer,
  ) {
    const dt = Math.min(rawDelta, 0.1);
    const { pointer, raw, sum, pos, look } = this;
    const kp = 1 - Math.exp(-dt / POINTER_TAU);
    pointer.x += (raw.x - pointer.x) * kp;
    pointer.y += (raw.y - pointer.y) * kp;

    // Camera: weight-blended scene targets, eased, plus pointer parallax (none on phones).
    const { frame } = store;
    sum.px = sum.py = sum.pz = sum.lx = sum.ly = sum.lz = 0;
    let total = 0;
    for (const key of SCENE_KEYS) {
      const w = frame.weight[key];
      if (w <= 0) continue;
      const t = cameraFor(key, aspect, frame.progress[key], this.target);
      sum.px += t.px * w;
      sum.py += t.py * w;
      sum.pz += t.pz * w;
      sum.lx += t.lx * w;
      sum.ly += t.ly * w;
      sum.lz += t.lz * w;
      total += w;
    }
    if (total === 0) {
      cameraFor("ambient", aspect, 0, sum);
      total = 1;
    }
    const k = this.first ? 1 : 1 - Math.exp(-dt / CAMERA_TAU);
    pos.x += (sum.px / total - pos.x) * k;
    pos.y += (sum.py / total - pos.y) * k;
    pos.z += (sum.pz / total - pos.z) * k;
    look.x += (sum.lx / total - look.x) * k;
    look.y += (sum.ly / total - look.y) * k;
    look.z += (sum.lz / total - look.z) * k;
    const par = frame.phone ? 0 : 1;
    camera.position.set(pos.x + pointer.x * 0.6 * par, pos.y + pointer.y * 0.35 * par, pos.z);
    camera.lookAt(look);

    // Composition: ease toward the sections' blend, then frame the view onto the free rect.
    const c = this.comp;
    const t = frame.comp;
    if (this.first) Object.assign(c, t);
    else for (const key of Object.keys(c) as (keyof Composition)[]) c[key] += (t[key] - c[key]) * k;
    this.first = false;
    framing.w = Math.max(0.2, c.w);
    framing.h = Math.max(0.2, c.h);
    framing.grow = c.grow;
    framing.phone = frame.phone;
    const ox = Math.round(-c.cx * size.width * 2) / 2;
    const oy = Math.round(-c.cy * size.height * 2) / 2;
    if (ox !== this.appliedX || oy !== this.appliedY || size.width !== this.appliedW || size.height !== this.appliedH) {
      if (ox !== 0 || oy !== 0) camera.setViewOffset(size.width, size.height, ox, oy, size.width, size.height);
      else camera.clearViewOffset();
      camera.zoom = 1;
      camera.updateProjectionMatrix();
      this.appliedX = ox;
      this.appliedY = oy;
      this.appliedW = size.width;
      this.appliedH = size.height;
    }
    dim.update(c, frame);
  }
}

type GL2 = WebGL2RenderingContext;
type TimerExt = { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number };

/** One 1 s window of the frame monitor. */
export type FrameWindow = { fps: number; cpu: number; gpu: number; scrolled: boolean };

/**
 * Frame monitor: the frame rate of rendered frames, the 3D's main-thread time per frame
 * (begin() at the start of the R3F loop to end() after gl.render) and, where the
 * EXT_disjoint_timer_query_webgl2 extension exists, its GPU time per frame (gpu -1 if not).
 */
class Meter {
  private last = 0;
  private start = 0;
  private seen = 0;
  private frames = 0;
  private time = 0;
  private cpu = 0;
  private gpu = 0;
  private gpuN = 0;
  private key = "";
  private quietUntil = 0;
  private scrollAt = -1e9;
  private scrolled = false;
  private ext: TimerExt | null | undefined;
  private active: WebGLQuery | null = null;
  private pending: WebGLQuery[] = [];
  private free: WebGLQuery[] = [];
  private gl: GL2 | null = null;

  /** Scroll input marks the windows it touches (they never count toward the fallback). */
  attach() {
    const onScroll = () => (this.scrollAt = performance.now());
    for (const type of ["scroll", "wheel", "touchmove"]) window.addEventListener(type, onScroll, { passive: true, capture: true });
    return () => {
      for (const type of ["scroll", "wheel", "touchmove"]) window.removeEventListener(type, onScroll, { capture: true });
      const gl = this.gl;
      if (gl && !gl.isContextLost()) for (const q of [...this.pending, ...this.free]) gl.deleteQuery(q);
      this.pending = [];
      this.free = [];
    };
  }

  /** Start of the R3F loop. `key` changes (scene, quality) start a quiet period. */
  begin(gl: GL2, key: string) {
    const now = performance.now();
    this.start = now;
    const gap = now - this.last;
    this.last = now;
    if (this.ext === undefined) {
      this.gl = gl;
      this.ext = gl.getExtension("EXT_disjoint_timer_query_webgl2") as TimerExt | null;
    }
    this.collect(gl);
    if (key !== this.key) {
      this.key = key;
      this.quietUntil = now + QUIET_MS;
    }
    if (++this.seen < WARMUP_FRAMES || gap > PAUSE_MS || now < this.quietUntil) {
      this.frames = this.time = this.cpu = this.gpu = this.gpuN = 0;
      this.scrolled = false;
      return;
    }
    this.frames += 1;
    this.time += gap;
  }

  /** Brackets gl.render with a GPU timer query (every 4th frame, at most 3 in flight). */
  renderTimed(gl: GL2, render: () => void) {
    const ext = this.ext;
    if (!ext || this.active || this.pending.length > 2 || this.seen & 3) {
      render();
      return;
    }
    const q = this.free.pop() ?? gl.createQuery();
    if (!q) {
      render();
      return;
    }
    gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
    this.active = q;
    render();
    gl.endQuery(ext.TIME_ELAPSED_EXT);
    this.pending.push(q);
    this.active = null;
  }

  /** End of the R3F loop (after gl.render): returns a window when one just completed. */
  end(): FrameWindow | null {
    const now = performance.now();
    if (now - this.scrollAt < SCROLL_MS) this.scrolled = true;
    if (this.frames === 0) return null;
    this.cpu += now - this.start;
    if (this.time < 1000) return null;
    const w: FrameWindow = {
      fps: (this.frames * 1000) / this.time,
      cpu: this.cpu / this.frames,
      gpu: this.gpuN ? this.gpu / this.gpuN : -1,
      scrolled: this.scrolled,
    };
    this.frames = this.time = this.cpu = this.gpu = this.gpuN = 0;
    this.scrolled = false;
    return w;
  }

  /** At most one finished query per frame (results arrive a few frames late, never blocking). */
  private collect(gl: GL2) {
    const ext = this.ext;
    const q = this.pending[0];
    if (!ext || !q || !gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) return;
    const ns = gl.getQueryParameter(q, gl.QUERY_RESULT) as number;
    this.pending.shift();
    this.free.push(q);
    if (!gl.getParameter(ext.GPU_DISJOINT_EXT) && this.frames > 0) {
      this.gpu += ns / 1e6;
      this.gpuN += 1;
    }
  }
}

const SceneSlot = memo(function SceneSlot({
  sceneKey,
  Scene,
  store,
  ...rest
}: Omit<SceneProps, "progress" | "weight"> & { sceneKey: SceneKey; Scene: SceneComponent | undefined; store: SceneStore }) {
  const snap = useSyncExternalStore(
    useCallback((l: () => void) => store.subscribe(sceneKey, l), [store, sceneKey]),
    () => store.get(sceneKey),
  );
  // Mount a scene the first time it is needed; afterwards it stays mounted (resources
  // and compiled programs survive) and simply receives weight 0.
  const [seen, setSeen] = useState(snap.weight > 0);
  if (!seen && snap.weight > 0) setSeen(true);
  // Needed before its chunk arrived (an anchor jump past the prefetch): load it now.
  useEffect(() => {
    if (seen && !Scene) scenes.load(sceneKey).catch(() => undefined);
  }, [seen, Scene, sceneKey]);
  if (!seen || !Scene) return null;
  return <Scene {...rest} weight={snap.weight} progress={snap.progress} />;
});

function Director({
  data,
  quality,
  dpr,
  onReady,
  onWindow,
}: {
  data: NeuralData;
  quality: Quality;
  /** Ladder step (exposed for QA, and a quiet period for the monitor when it changes). */
  dpr: number;
  onReady: (ready: boolean) => void;
  onWindow: (w: FrameWindow) => void;
}) {
  const get = useThree((s) => s.get);
  const [store] = useState(() => {
    const s = new SceneStore();
    s.update();
    return s;
  });
  const [palette, setPalette] = useState<ScenePalette>(readPalette);
  const [focus, setFocus] = useState<string | null>(null);
  const [rig] = useState(() => new Rig());
  const [meter] = useState(() => new Meter());
  useEffect(() => meter.attach(), [meter]);
  const mods = useSyncExternalStore(scenes.subscribe, () => scenes.mods);
  const dim = useMemo(() => new Dimmer(), []);
  useEffect(() => () => dim.dispose(), [dim]);

  // Scroll/resize → director (one rAF-throttled measurement per frame at most).
  useEffect(() => {
    let raf = 0;
    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        store.update();
      });
    };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    // Sections that grow or appear later (fonts, images, client islands) shift the rects.
    const ro = new ResizeObserver(schedule);
    ro.observe(document.body);
    schedule();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      ro.disconnect();
    };
  }, [store]);

  // Theme: the theme toggle flips the html class.
  useEffect(() => {
    const mo = new MutationObserver(() => {
      const next = readPalette();
      setPalette((prev) => (samePalette(prev, next) ? prev : next));
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style", "data-theme"] });
    return () => mo.disconnect();
  }, []);

  // Focus delegation: hovering or focusing a [data-focus-id] element highlights it in 3D.
  useEffect(() => {
    const idOf = (t: EventTarget | null) =>
      t instanceof Element ? (t.closest<HTMLElement>("[data-focus-id]")?.dataset.focusId ?? null) : null;
    const enter = (e: Event) => {
      const id = idOf(e.target);
      if (id) setFocus(id);
    };
    const leave = (e: Event) => {
      const from = idOf(e.target);
      const to = idOf((e as FocusEvent | PointerEvent).relatedTarget);
      if (from && from !== to) setFocus((cur) => (cur === from ? to : cur));
    };
    document.addEventListener("pointerover", enter, { passive: true });
    document.addEventListener("pointerout", leave, { passive: true });
    document.addEventListener("focusin", enter);
    document.addEventListener("focusout", leave);
    return () => {
      document.removeEventListener("pointerover", enter);
      document.removeEventListener("pointerout", leave);
      document.removeEventListener("focusin", enter);
      document.removeEventListener("focusout", leave);
    };
  }, []);

  // Exposed for QA: the scene modules loaded so far.
  useEffect(() => {
    document.querySelector("[data-neural-stage]")?.setAttribute("data-scenes", Object.keys(mods).join(" "));
  }, [mods]);

  // Exposed for QA: the focused DOM id and the render quality.
  useEffect(() => {
    const stage = document.querySelector("[data-neural-stage]");
    if (focus) stage?.setAttribute("data-focus", focus);
    else stage?.removeAttribute("data-focus");
    stage?.setAttribute("data-quality", quality);
  }, [focus, quality]);

  // Pointer: mouse/pen only; touch leaves it centred.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") rig.setPointer(0, 0);
      else rig.setPointer((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
    };
    const onLeave = () => rig.setPointer(0, 0);
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, [rig]);

  // Warm-up: wait for the scenes in view (their chunks were requested when the stage
  // mounted), compile the visible programs in an idle period, then report ready after two
  // drawn frames, which starts the poster → canvas crossfade. Then prefetch the rest.
  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    let stopPrefetch = () => {};
    (async () => {
      const keys = SCENE_KEYS.filter((k) => store.frame.weight[k] > 0);
      await Promise.all(keys.map((k) => scenes.load(k))).catch(() => undefined);
      await nextIdle(500);
      if (cancelled) return;
      const { gl, scene, camera } = get();
      gl.debug.checkShaderErrors = process.env.NODE_ENV !== "production";
      await gl.compileAsync(scene, camera).catch(() => undefined);
      if (cancelled) return;
      raf = requestAnimationFrame(() => {
        raf = requestAnimationFrame(() => {
          onReady(true);
          stopPrefetch = prefetchScenes();
        });
      });
    })();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stopPrefetch();
    };
  }, [get, onReady, store]);

  // The R3F loop, bracketed for the frame monitor: begin (first), the rig (camera,
  // composition), the scenes (priority 0), then the render, which this stage issues itself
  // (a positive priority turns R3F's own render off) so it can be timed.
  useFrame((state) => meter.begin(state.gl.getContext() as GL2, `${store.active}|${quality}|${dpr}`), -1000);
  useFrame((state, delta) => {
    // One scroll read per frame, before any scene writes DOM (perf P5): the scenes read
    // the snapshot, so no later read forces a layout pass.
    scroll.x = window.scrollX;
    scroll.y = window.scrollY;
    const aspect = state.size.width / Math.max(1, state.size.height);
    rig.frame(state.camera as PerspectiveCamera, delta, aspect, store, state.size, dim);
  }, -1);
  useFrame(({ gl, scene, camera }) => {
    meter.renderTimed(gl.getContext() as GL2, () => gl.render(scene, camera));
    const w = meter.end();
    if (w) {
      onWindow(w);
      // Exposed for QA: the last window (fps, 3D ms/frame on the CPU and GPU).
      document
        .querySelector("[data-neural-stage]")
        ?.setAttribute("data-fps", `${Math.round(w.fps)} cpu ${w.cpu.toFixed(1)} gpu ${w.gpu < 0 ? "-" : w.gpu.toFixed(1)}`);
    }
  }, 1);

  return (
    <>
      <primitive object={dim.mesh} />
      {SCENE_KEYS.map((key) => (
        <SceneSlot
          key={key}
          sceneKey={key}
          Scene={mods[key]}
          store={store}
          data={data}
          pointer={rig.pointer}
          focus={focus}
          palette={palette}
          quality={quality}
        />
      ))}
    </>
  );
}

let stages = 0;

export default function Stage({ data, active, retry = false, onReady, onFallback }: StageProps) {
  // Phones (coarse pointers) start on the last step and stay there; a retry after a slow
  // fallback starts there too and may climb back up.
  const [floor] = useState(() => (matchMedia("(pointer: coarse)").matches ? LAST : 0));
  const [level, setLevel] = useState(() => (retry ? LAST : floor));
  const { quality, dpr } = LADDER[level];
  const [token] = useState(() => `neural-${++stages}`);
  const [idle, setIdle] = useState(false);
  // Request the scenes in view at once: their chunks download while the renderer is created.
  useState(() => scenesInView().forEach((k) => scenes.load(k).catch(() => undefined)));

  // The quality ladder follows the frame monitor: DROP_AFTER slow windows in a row (low
  // frame rate AND a heavy 3D) step down; on the last step, SUSTAINED slow windows
  // averaging under FALLBACK_FPS fall back to the poster (the island may bring the stage
  // back later); UP_AFTER fast, light windows in a row step back up (never above the
  // phones' last step).
  const mon = useRef({ slow: 0, run: 0, sum: 0, fast: 0, ups: 0 });
  const onWindow = useCallback(
    (w: FrameWindow) => {
      const m = mon.current;
      const heavy = w.cpu > CPU_BUDGET || w.gpu > GPU_BUDGET;
      const slow = w.fps < MIN_FPS && heavy;
      const fast = w.fps >= UP_FPS && w.cpu < UP_CPU && w.gpu < UP_GPU;
      const step = (to: number) => {
        m.slow = m.run = m.sum = m.fast = 0;
        setLevel(to);
      };
      m.fast = fast ? m.fast + 1 : 0;
      if (level > floor && m.fast >= UP_AFTER << m.ups) {
        m.ups += 1;
        step(level - 1);
        return;
      }
      if (level < LAST) {
        m.slow = slow ? m.slow + 1 : 0;
        if (m.slow >= DROP_AFTER) step(level + 1);
        return;
      }
      if (w.scrolled) return;
      if (slow) {
        m.run += 1;
        m.sum += w.fps;
      } else m.run = m.sum = 0;
      if (m.run >= SUSTAINED && m.sum / m.run < FALLBACK_FPS) onFallback("slow");
    },
    [level, floor, onFallback],
  );

  // Idle pause: no input for IDLE_MS stops the render loop; any input resumes it.
  useEffect(() => {
    let last = performance.now();
    let paused = false;
    const onInput = () => {
      last = performance.now();
      if (paused) {
        paused = false;
        setIdle(false);
      }
    };
    const timer = window.setInterval(() => {
      if (!paused && performance.now() - last > IDLE_MS) {
        paused = true;
        setIdle(true);
      }
    }, 2000);
    for (const type of INPUTS) window.addEventListener(type, onInput, { passive: true, capture: true });
    return () => {
      window.clearInterval(timer);
      for (const type of INPUTS) window.removeEventListener(type, onInput, { capture: true });
    };
  }, []);

  // R3F force-loses the context when the canvas unmounts on purpose: only a loss while
  // mounted means the GPU dropped us (layout cleanup runs before R3F's teardown).
  const mountedRef = useRef(true);
  useLayoutEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  useEffect(
    () => () => {
      onReady(false);
      // The context-lost event frees the page's WebGL slot; this covers a teardown without one.
      window.setTimeout(() => {
        if (contextOwner.get() === token) contextOwner.set(null);
      }, 1500);
    },
    [onReady, token],
  );

  const running = active && !idle;
  // Scenes may assume complete data: a hot reload (or a partial payload) never crashes them.
  const safe = useMemo<NeuralData>(
    () => ({
      skills: data?.skills ?? [],
      links: data?.links ?? [],
      experience: data?.experience ?? [],
      ai: data?.ai ?? [],
      work: data?.work ?? [],
      services: data?.services ?? [],
      facts: data?.facts ?? { years: 0, location: "", city: "", utcOffsetMin: 330, availability: "", channels: [] },
    }),
    [data],
  );

  return (
    <Canvas
      camera={{ fov: FOV, position: [0, 0, 15], near: 0.1, far: 200 }}
      dpr={dpr}
      // The stage is position:fixed: scrolling never moves it, so R3F need not re-measure
      // its container on every scroll (perf R1); resizes still re-measure (debounced).
      resize={{ scroll: false, debounce: { scroll: 0, resize: 100 } }}
      frameloop={running ? "always" : "never"}
      flat
      gl={createRenderer}
      style={{ pointerEvents: "none" }}
      data-neural-canvas=""
      data-running={running ? "" : undefined}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
        contextOwner.set(token);
        gl.domElement.addEventListener(
          "webglcontextlost",
          () => {
            if (contextOwner.get() === token) contextOwner.set(null);
            if (mountedRef.current) onFallback("lost");
          },
          { once: true },
        );
      }}
    >
      <Director data={safe} quality={quality} dpr={level} onReady={onReady} onWindow={onWindow} />
    </Canvas>
  );
}
