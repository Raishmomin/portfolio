"use client";

// The lazy R3F scene (loaded only by cluster-island.tsx via next/dynamic, ssr:false).
// One orthographic <Canvas>, one instancedMesh of rounded pods with a runtime matcap
// (no network assets), demand frameloop: invalidate() only while something moves.
// Decorative only: no text, no interaction in the canvas (tasks/design-spec.md §4).
//
// The mutable simulation lives in a plain class (ClusterEngine) created in an idle
// callback after the canvas mounts; React only wires its lifecycle, so nothing
// re-renders per frame.
import { Canvas, useFrame, useThree, type GLProps } from "@react-three/fiber";
import { damp3 } from "maath/easing";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DynamicDrawUsage,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  MeshBasicMaterial,
  MeshMatcapMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Camera,
  type OrthographicCamera,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { POSTER_PRESETS, VIEW_MARGIN } from "./config";
import { buildFormations, CAM_DIR, hopCandidates, POD, SCREEN_R, SCREEN_U, STATUS, type Formations, type FormationView } from "./formations";
import { clusterStore, type ClusterState } from "./store";
import type { FormationData, FormationKey } from "./types";

const STAGGER = 0.006; // s per instance index
const SMOOTH = 0.18; // damp3 smoothTime for pods
const CAMERA_SMOOTH = 0.32;
const EPS = 0.004; // world units: positions snap once this close (well under a pixel)
const COLOR_TAU = 0.06; // s: colour ease time constant (in OKLab)
const COLOR_EPS = 0.01; // OKLab L1 distance below which a colour snaps (under a JND)
// Idle reschedule: a few top pods arc up (Pending), land (Ready flash), settle back.
// The arc is computed, not damped, so a hop costs HOP + a short colour tail of frames.
const HOP = 0.44; // s per pod
const HOP_ARC = 0.3; // s of HOP in the air
const HOP_LIFT = 0.9;
const HOP_PODS = 3;
const HOP_STAGGER = 0.07; // s between the pods of one hop
const HOP_EVERY = 6000; // ms between idle hops
const HOP_IDLE_AFTER = 30000; // ms without input before idle hops stop (until the next input)
const SCATTER = 0.7; // s
const CAM_DISTANCE = 80; // orthographic: distance only has to clear every formation
const MIN_FPS = 30; // sustained below this (back-to-back frames only) counts as a decline
const INPUTS = ["scroll", "wheel", "pointerdown", "pointermove", "keydown", "touchstart"] as const;

type SceneProps = {
  data: FormationData;
  count: number;
  variant: "sticky" | "band";
  active: boolean;
  onReady: (ready: boolean) => void;
  onFallback: () => void;
};

const now = () => performance.now() / 1000;

/** Run `fn` in an idle period (timeout fallback); returns a cancel function. */
function onIdle(fn: () => void, timeout = 500): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(fn, { timeout });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(fn, 16);
  return () => window.clearTimeout(id);
}

const nextIdle = () => new Promise<void>((resolve) => void onIdle(resolve));

/**
 * The renderer, created in its own idle period (R3F awaits an async factory), so the
 * WebGL context and three's capability probing are not part of React's commit task.
 */
const createRenderer: GLProps = async (defaults) => {
  await nextIdle();
  return new WebGLRenderer({ ...defaults, antialias: false, powerPreference: "low-power", alpha: true });
};

/** A theme colour as sRGB components (0–1), from an "h s% l%" CSS variable. */
function cssSRGB(style: CSSStyleDeclaration, name: string, scratch: Color): [number, number, number] {
  const [h, s, l] = style.getPropertyValue(name).trim().split(/\s+/).map((v) => parseFloat(v));
  if ([h, s, l].some((v) => Number.isNaN(v))) return [0.5, 0.5, 0.5];
  scratch.setHSL(h / 360, s / 100, l / 100, SRGBColorSpace);
  const out = { r: 0, g: 0, b: 0 };
  scratch.getRGB(out, SRGBColorSpace);
  return [out.r, out.g, out.b];
}

/** color-mix(in srgb, a p, b) into a (linear) three Color, like the poster's CSS; no b: a as is. */
function mixSRGB(out: Color, a: number[], b: number[] = a, p = 1): Color {
  return out.setRGB(a[0] * p + b[0] * (1 - p), a[1] * p + b[1] * (1 - p), a[2] * p + b[2] * (1 - p), SRGBColorSpace);
}

// OKLab (Björn Ottosson) <-> linear sRGB: status colours ease through a perceptual
// space, so orange -> green -> bone never passes through muddy khaki.
function toOklab(c: Color, out: Float32Array, o: number) {
  const l = Math.cbrt(0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b);
  const m = Math.cbrt(0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b);
  const s = Math.cbrt(0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b);
  out[o] = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  out[o + 1] = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  out[o + 2] = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
}
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
function oklabToLinear(lab: Float32Array, i: number, out: Float32Array, o: number) {
  const L = lab[i], A = lab[i + 1], B = lab[i + 2];
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  out[o] = clamp01(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s);
  out[o + 1] = clamp01(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s);
  out[o + 2] = clamp01(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);
}

/** 256px matcap drawn at runtime: bright top, mid left, darker right (the poster's three tones). */
function makeMatcap(): CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size * 0.4, size * 0.12, 0, size * 0.4, size * 0.12, size * 0.95);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.35, "#f2f2f2");
  g.addColorStop(0.62, "#bdbdbd");
  g.addColorStop(0.85, "#929292");
  g.addColorStop(1, "#7a7a7a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function lookAtView(v: FormationView, out: Vector3): Vector3 {
  return out.set(
    v.cx * SCREEN_R[0] + v.cy * SCREEN_U[0],
    v.cx * SCREEN_R[1] + v.cy * SCREEN_U[1],
    v.cx * SCREEN_R[2] + v.cy * SCREEN_U[2],
  );
}

function fitZoom(v: FormationView, width: number, height: number): number {
  return Math.min(width / (v.w * VIEW_MARGIN), height / (v.h * VIEW_MARGIN));
}

class ClusterEngine {
  readonly group = new Group();
  private readonly candidates: Partial<Record<FormationKey, Uint16Array>> = {};
  private readonly projectIndex: Map<string, number>;
  private readonly groupIndex: Map<string, number>;
  private readonly material: MeshMatcapMaterial;
  readonly mesh: InstancedMesh;
  private readonly colors: Float32Array;
  // Node plates as the poster draws them: a flat fill under the pods plus a 1px hairline.
  private readonly plateGeometry = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  private readonly plateMaterial = new MeshBasicMaterial({ depthWrite: false });
  private readonly plates: InstancedMesh;
  private readonly outlineGeometry = new BufferGeometry();
  private readonly outlineMaterial = new LineBasicMaterial({ depthWrite: false });
  private readonly outline: LineSegments;
  // Palette, indexed by STATUS: read from CSS variables, kept in OKLab for easing.
  private readonly palette = [new Color(), new Color(), new Color(), new Color()];
  private readonly paletteLab = new Float32Array(12);
  private readonly lab: Float32Array;
  // Simulation state, allocated once.
  private key: FormationKey;
  private start = -Infinity;
  private scatterUntil = -Infinity;
  private pulseAt = -Infinity;
  private settled = false;
  private readonly cur: Vector3[];
  private readonly scale: Float32Array;
  private readonly hops: Float64Array;
  private readonly angle: Float32Array;
  private readonly scatter: Float32Array;
  private plateScale: number;
  private outlineScale = -1;
  private readonly look = new Vector3();
  private zoom: number;
  private readonly pointer = new Vector2();
  private readonly parallax = new Vector3();
  private readonly target = new Vector3();
  private readonly matrix = new Matrix4();

  constructor(
    data: FormationData,
    private readonly count: number,
    private readonly formations: Formations,
    private readonly geometry: BufferGeometry,
    private readonly matcap: CanvasTexture,
    width: number,
    height: number,
  ) {
    this.material = new MeshMatcapMaterial({ matcap });
    this.projectIndex = new Map(data.projects.map((p, i) => [p.slug, i]));
    this.groupIndex = new Map(data.skills.map((s, i) => [s.group, i]));

    this.mesh = new InstancedMesh(this.geometry, this.material, count);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.colors = new Float32Array(count * 3);
    this.lab = new Float32Array(count * 3);
    this.mesh.instanceColor = new InstancedBufferAttribute(this.colors, 3).setUsage(DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    const plateCount = this.formations.hero.plates.length / 4;
    this.plates = new InstancedMesh(this.plateGeometry, this.plateMaterial, plateCount);
    this.plates.frustumCulled = false;
    this.outlineGeometry.setAttribute("position", new BufferAttribute(new Float32Array(plateCount * 8 * 3), 3).setUsage(DynamicDrawUsage));
    this.outline = new LineSegments(this.outlineGeometry, this.outlineMaterial);
    this.outline.frustumCulled = false;
    // Painter's order like the SVG: plate fills, hairlines, then pods over both.
    this.plates.renderOrder = -2;
    this.outline.renderOrder = -1;
    this.group.add(this.plates, this.outline, this.mesh);

    // Start settled in the current formation, so the first frame matches the poster.
    this.key = clusterStore.getState().section;
    const f = this.formations[this.key];
    if (this.key === "contact") this.pulseAt = now() + 0.4;
    this.cur = Array.from({ length: count }, (_, i) => new Vector3().fromArray(f.positions, i * 3));
    this.scale = Float32Array.from(f.status, (s) => (s === STATUS.hidden ? 0 : 1));
    this.hops = new Float64Array(count).fill(-Infinity);
    this.plateScale = this.key === "hero" || this.key === "about" ? 1 : 0;
    lookAtView(f.view, this.look);
    this.zoom = fitZoom(f.view, width, height);

    const contact = this.formations.contact.positions;
    this.angle = new Float32Array(count);
    this.scatter = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      this.angle[i] = (Math.atan2(contact[i * 3 + 2], contact[i * 3]) + Math.PI) / (2 * Math.PI);
      const a = Math.random() * Math.PI * 2;
      const r = 3 + Math.random() * 4;
      this.scatter[i * 3] = Math.cos(a) * r;
      this.scatter[i * 3 + 1] = Math.random() * 5;
      this.scatter[i * 3 + 2] = Math.sin(a) * r;
    }
    this.readTheme();
  }

  /** Re-read the theme's CSS variables; the mixes are the poster's sRGB color-mix() ratios. */
  readTheme() {
    const root = document.documentElement;
    const style = getComputedStyle(root);
    const dark = root.classList.contains("dark");
    const scratch = new Color();
    const fg = cssSRGB(style, "--foreground", scratch);
    const card = cssSRGB(style, "--card", scratch);
    const border = cssSRGB(style, "--border", scratch);
    // Neutral pods: bone over the dark panel; ink over the warm hairline tone in light.
    mixSRGB(this.palette[STATUS.running], fg, dark ? card : border, dark ? 0.88 : 0.3);
    this.palette[STATUS.hidden].copy(this.palette[STATUS.running]);
    mixSRGB(this.palette[STATUS.ready], cssSRGB(style, "--ok", scratch));
    mixSRGB(this.palette[STATUS.pending], cssSRGB(style, "--primary", scratch));
    this.palette.forEach((c, k) => toOklab(c, this.paletteLab, k * 3));
    // Plates: 5% ink over the panel, outlined with the hairline colour.
    mixSRGB(this.plateMaterial.color, fg, card, 0.05);
    mixSRGB(this.outlineMaterial.color, border);

    const f = this.formations[this.key];
    for (let i = 0; i < this.count; i++) {
      this.lab.set(this.paletteLab.subarray(f.status[i] * 3, f.status[i] * 3 + 3), i * 3);
      oklabToLinear(this.lab, i * 3, this.colors, i * 3);
    }
    this.mesh.instanceColor!.needsUpdate = true;
  }

  onStore(s: ClusterState, prev: ClusterState) {
    const t = now();
    if (s.section !== prev.section) {
      this.key = s.section;
      this.start = t;
      this.pulseAt = s.section === "contact" ? t + 1.5 : -Infinity;
    }
    if (s.reschedules !== prev.reschedules) {
      this.scatterUntil = t + SCATTER;
      this.start = t + SCATTER;
    }
  }

  /**
   * Idle reschedule: a few pods hop (Pending, then Ready). Only pods with nothing above
   * them, so a hop never passes through a neighbour. False while anything still moves.
   */
  hop(): boolean {
    if (!this.settled) return false;
    let pool = this.candidates[this.key];
    if (!pool) pool = this.candidates[this.key] = hopCandidates(this.formations[this.key]);
    if (!pool.length) return false;
    const t = now();
    for (let k = 0; k < Math.min(HOP_PODS, pool.length); k++) {
      this.hops[pool[Math.floor(Math.random() * pool.length)]] = t + k * HOP_STAGGER;
    }
    this.settled = false;
    return true;
  }

  setPointer(x: number, y: number) {
    this.pointer.set(x, y);
  }

  /** Advance one frame. Returns true while anything is still moving. */
  frame(camera: Camera, width: number, height: number, rawDelta: number): boolean {
    const dt = Math.min(rawDelta, 1 / 20);
    const t = now();
    const { focusProject, focusGroup } = clusterStore.getState();
    const f = this.formations[this.key];
    const lab = this.lab;
    const pal = this.paletteLab;
    const ease = 1 - Math.exp(-dt / 0.12);
    const colorEase = 1 - Math.exp(-dt / COLOR_TAU);
    const scattering = t < this.scatterUntil;
    const elapsed = t - this.start;
    let moving = false;

    // Hover/focus on a DOM card raises its column; on a skill group, lifts its cluster.
    let focusTag = -1;
    let lift = 0;
    if (this.key === "work" && focusProject) {
      focusTag = this.projectIndex.get(focusProject) ?? -1;
      lift = 0.3;
    } else if (this.key === "stack" && focusGroup) {
      focusTag = this.groupIndex.get(focusGroup) ?? -1;
      lift = 0.5;
    }
    const pulseClock = t - this.pulseAt;
    const pulsing = this.key === "contact" && pulseClock > -0.5 && pulseClock < 1.6;

    for (let i = 0; i < this.count; i++) {
      const status = f.status[i];
      let x = f.positions[i * 3];
      let y = f.positions[i * 3 + 1];
      let z = f.positions[i * 3 + 2];
      let tone: number = status;
      const turn = scattering || elapsed >= i * STAGGER;

      if (scattering) {
        x += this.scatter[i * 3];
        y += this.scatter[i * 3 + 1];
        z += this.scatter[i * 3 + 2];
        tone = STATUS.pending;
      } else if (!turn) {
        moving = true; // waiting for its turn in the wave
        if (t < this.start) tone = STATUS.pending;
      }
      if (focusTag >= 0 && f.tag[i] === focusTag) {
        y += lift;
        tone = STATUS.pending;
      }

      if (turn) {
        this.target.set(x, y, z);
        if (damp3(this.cur[i], this.target, SMOOTH, dt, Infinity, undefined, EPS)) moving = true;
        const targetScale = status === STATUS.hidden ? 0 : 1;
        const ds = targetScale - this.scale[i];
        if (Math.abs(ds) > EPS) {
          this.scale[i] += ds * ease;
          moving = true;
        } else this.scale[i] = targetScale;
      }

      // Hop: an exact arc on top of the settled position (no damped tail).
      let hopY = 0;
      const hopAge = t - this.hops[i];
      if (hopAge >= 0 && hopAge < HOP && status !== STATUS.hidden) {
        moving = true;
        if (hopAge < HOP_ARC) {
          const u = hopAge / HOP_ARC;
          hopY = 4 * HOP_LIFT * u * (1 - u);
          tone = STATUS.pending;
        } else tone = STATUS.ready;
      }

      // Colour: status tone, plus the one-shot green sweep around the "contact" ring.
      const o = i * 3;
      let tl = pal[tone * 3];
      let ta = pal[tone * 3 + 1];
      let tb = pal[tone * 3 + 2];
      if (pulsing) {
        const d = Math.abs(pulseClock - this.angle[i] * 0.9);
        if (d < 0.3) {
          const k = 1 - d / 0.3;
          tl += (pal[STATUS.ready * 3] - tl) * k;
          ta += (pal[STATUS.ready * 3 + 1] - ta) * k;
          tb += (pal[STATUS.ready * 3 + 2] - tb) * k;
        }
        moving = true;
      }
      const dl = tl - lab[o];
      const da = ta - lab[o + 1];
      const db = tb - lab[o + 2];
      // Between opposite hues (Pending orange <-> Ready green) a status flips, as in a
      // real monitor: any blend of the two reads as mud. Everything else eases.
      const opposite = lab[o + 1] * ta + lab[o + 2] * tb < -0.005;
      if (!opposite && Math.abs(dl) + Math.abs(da) + Math.abs(db) > COLOR_EPS) {
        lab[o] += dl * colorEase;
        lab[o + 1] += da * colorEase;
        lab[o + 2] += db * colorEase;
        moving = true;
      } else {
        lab[o] = tl;
        lab[o + 1] = ta;
        lab[o + 2] = tb;
      }
      oklabToLinear(lab, o, this.colors, o);

      const s = this.scale[i];
      const p = this.cur[i];
      this.matrix.makeScale(s, s, s).setPosition(p.x, p.y + hopY, p.z);
      this.mesh.setMatrixAt(i, this.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor!.needsUpdate = true;

    // Node plates belong to the hero/about formations only.
    const plateTarget = this.key === "hero" || this.key === "about" ? 1 : 0;
    if (Math.abs(plateTarget - this.plateScale) > EPS) {
      this.plateScale += (plateTarget - this.plateScale) * ease;
      moving = true;
    } else this.plateScale = plateTarget;
    this.updatePlates();

    // Camera: fit the formation's screen bounds, ease toward it, ±0.5 parallax on fine pointers.
    if (damp3(this.look, lookAtView(f.view, this.target), CAMERA_SMOOTH, dt, Infinity, undefined, EPS)) moving = true;
    const zoom = fitZoom(f.view, width, height);
    if (Math.abs(zoom - this.zoom) > zoom * 0.001) {
      this.zoom += (zoom - this.zoom) * (1 - Math.exp(-dt / CAMERA_SMOOTH));
      moving = true;
    } else this.zoom = zoom;
    if (damp3(this.parallax, this.target.set(this.pointer.x * 0.5, this.pointer.y * 0.5, 0), 0.25, dt, Infinity, undefined, EPS)) moving = true;
    const { x: px, y: py } = this.parallax;
    camera.position.set(
      this.look.x + CAM_DIR[0] * CAM_DISTANCE + SCREEN_R[0] * px + SCREEN_U[0] * py,
      this.look.y + CAM_DIR[1] * CAM_DISTANCE + SCREEN_R[1] * px + SCREEN_U[1] * py,
      this.look.z + CAM_DIR[2] * CAM_DISTANCE + SCREEN_R[2] * px + SCREEN_U[2] * py,
    );
    camera.lookAt(this.look);
    const ortho = camera as OrthographicCamera;
    ortho.zoom = this.zoom;
    ortho.updateProjectionMatrix();
    this.settled = !moving;
    return moving;
  }

  private updatePlates() {
    const s = this.plateScale;
    this.plates.visible = this.outline.visible = s > EPS;
    if (s === this.outlineScale) return;
    this.outlineScale = s;
    const hp = this.formations.hero.plates;
    const pos = this.outlineGeometry.getAttribute("position") as BufferAttribute;
    const v = pos.array as Float32Array;
    for (let k = 0; k < hp.length / 4; k++) {
      const [x, z, w, d] = [hp[k * 4], hp[k * 4 + 1], (hp[k * 4 + 2] * s) / 2, (hp[k * 4 + 3] * s) / 2];
      this.matrix.makeScale(w * 2, 1, d * 2).setPosition(x, 0, z);
      this.plates.setMatrixAt(k, this.matrix);
      // Four edges, two vertices each: (x0,z0)-(x1,z0), (x1,z0)-(x1,z1), (x1,z1)-(x0,z1), (x0,z1)-(x0,z0).
      const c = [x - w, z - d, x + w, z - d, x + w, z + d, x - w, z + d];
      for (let e = 0; e < 4; e++) {
        const a = e * 2;
        const b = ((e + 1) % 4) * 2;
        v.set([c[a], 0, c[a + 1], c[b], 0, c[b + 1]], (k * 8 + e * 2) * 3);
      }
    }
    this.plates.instanceMatrix.needsUpdate = true;
    pos.needsUpdate = true;
  }

  dispose() {
    this.group.removeFromParent();
    this.mesh.dispose();
    this.plates.dispose();
    this.geometry.dispose();
    this.material.dispose();
    this.matcap.dispose();
    this.plateGeometry.dispose();
    this.plateMaterial.dispose();
    this.outlineGeometry.dispose();
    this.outlineMaterial.dispose();
  }
}

/** Last scroll/pointer/key input (ms); idle hops stop HOP_IDLE_AFTER after it. */
let lastInput = 0;

function Pods({ data, count, variant, active, onReady, onDecline }: Omit<SceneProps, "onFallback"> & { onDecline: () => void }) {
  const get = useThree((s) => s.get);
  const invalidate = useThree((s) => s.invalidate);
  const engineRef = useRef<ClusterEngine | null>(null);
  const [engine, setEngine] = useState<ClusterEngine | null>(null);
  const perf = useRef({ last: 0, frames: 0, time: 0 });

  // Mount in steps, each in its own idle period, so no step is a long task on a slow
  // phone: formations; pod geometry + matcap; the engine's meshes; placement + matcap
  // upload; the pods' program (compileAsync: linked in parallel where
  // KHR_parallel_shader_compile exists); the plates' programs; a warm-up draw of the
  // pods (first-use uniform/attribute setup). Then the first real frame, and two
  // frames later the crossfade.
  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    const owned: { dispose(): void }[] = [];
    const step = async () => {
      await nextIdle();
      return !cancelled;
    };
    const run = async () => {
      const layout = POSTER_PRESETS[variant].layout;
      if (!(await step())) return;
      const formations = buildFormations(data, count, { layout });
      if (!(await step())) return;
      const geometry = new RoundedBoxGeometry(POD, POD, POD, 2, 0.12);
      const matcap = makeMatcap();
      owned.push(geometry, matcap);
      if (!(await step())) return;
      const { size } = get();
      const built = new ClusterEngine(data, count, formations, geometry, matcap, size.width, size.height);
      owned.splice(0, owned.length, built); // the engine disposes the geometry and matcap
      if (!(await step())) return;
      const { scene, gl, camera } = get();
      gl.sortObjects = false; // scene order is the painter's order: plates, hairlines, pods
      gl.debug.checkShaderErrors = false; // no blocking info-log queries on first use
      scene.add(built.group);
      built.frame(camera, size.width, size.height, 0);
      gl.initTexture(matcap);
      if (!(await step())) return;
      await gl.compileAsync(built.mesh, camera, scene);
      if (!(await step())) return;
      await gl.compileAsync(built.group, camera, scene);
      if (!(await step())) return;
      gl.render(built.mesh, camera);
      if (!(await step())) return;
      engineRef.current = built;
      setEngine(built);
      invalidate();
      raf = requestAnimationFrame(() => {
        raf = requestAnimationFrame(() => onReady(true));
      });
    };
    run().catch(() => onReady(false));
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      owned.forEach((o) => o.dispose());
      engineRef.current = null;
    };
  }, [get, invalidate, data, count, variant, onReady]);

  useEffect(() => {
    if (!engine) return;
    // Colours follow the theme: the theme toggle flips the html class.
    const mo = new MutationObserver(() => {
      engine.readTheme();
      invalidate();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    const unsubscribe = clusterStore.subscribe((s, prev) => {
      engine.onStore(s, prev);
      invalidate();
    });
    const fine = matchMedia("(pointer: fine)").matches;
    const onMove = (e: PointerEvent) => {
      engine.setPointer((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
      invalidate();
    };
    if (fine) window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      mo.disconnect();
      unsubscribe();
      window.removeEventListener("pointermove", onMove);
    };
  }, [engine, invalidate]);

  // Idle hops: only while in view and visible (active), at most one every HOP_EVERY,
  // and none once the reader has been idle for HOP_IDLE_AFTER, until the next input.
  useEffect(() => {
    if (!engine || !active) return;
    invalidate();
    lastInput = performance.now();
    let timer = 0;
    let paused = false;
    const tick = () => {
      if (performance.now() - lastInput > HOP_IDLE_AFTER) {
        paused = true;
        return;
      }
      if (engine.hop()) invalidate();
      timer = window.setTimeout(tick, HOP_EVERY);
    };
    const onInput = () => {
      lastInput = performance.now();
      if (!paused) return;
      paused = false;
      timer = window.setTimeout(tick, HOP_EVERY);
    };
    for (const type of INPUTS) window.addEventListener(type, onInput, { passive: true, capture: true });
    timer = window.setTimeout(tick, HOP_EVERY);
    return () => {
      window.clearTimeout(timer);
      for (const type of INPUTS) window.removeEventListener(type, onInput, { capture: true });
    };
  }, [engine, active, invalidate]);

  useFrame((state, delta) => {
    const current = engineRef.current;
    if (!current) return;
    if (current.frame(state.camera, state.size.width, state.size.height, delta)) state.invalidate();
    // Demand-aware performance check: only back-to-back frames of one burst count, so
    // the idle gaps of the demand frameloop never read as a slow device.
    const p = perf.current;
    const t = performance.now();
    const gap = t - p.last;
    p.last = t;
    if (gap > 100) return;
    p.frames += 1;
    p.time += gap;
    if (p.time < 1000) return;
    if ((p.frames * 1000) / p.time < MIN_FPS) onDecline();
    p.frames = 0;
    p.time = 0;
  });

  return null;
}

let scenes = 0;

export default function Scene({ data, count, variant, active, onReady, onFallback }: SceneProps) {
  const [dpr, setDpr] = useState<number | [number, number]>(variant === "band" ? [1, 1] : [1, 1.5]);
  const [token] = useState(() => `scene-${++scenes}`);
  const declines = useRef(0);

  // First decline drops to dpr 1; a third one falls back to the poster.
  const onDecline = useCallback(() => {
    declines.current += 1;
    if (declines.current === 1) setDpr(1);
    if (declines.current >= 3) onFallback();
  }, [onFallback]);

  // R3F force-loses the context when the canvas unmounts on purpose (3D toggled off):
  // only a loss while mounted means the GPU dropped us. A layout-effect cleanup runs in
  // the commit's mutation phase, before R3F's own teardown.
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
        if (clusterStore.getState().owner === token) clusterStore.setState({ owner: null });
      }, 1500);
    },
    [onReady, token],
  );

  return (
    <Canvas
      orthographic
      camera={{ position: [12, 10, 12], zoom: variant === "band" ? 44 : 56, near: 0.1, far: 400 }}
      dpr={dpr}
      frameloop={active ? "demand" : "never"}
      flat
      gl={createRenderer}
      style={{ pointerEvents: "none" }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
        clusterStore.setState({ owner: token });
        gl.domElement.addEventListener(
          "webglcontextlost",
          () => {
            if (clusterStore.getState().owner === token) clusterStore.setState({ owner: null });
            if (mountedRef.current) onFallback();
          },
          { once: true },
        );
      }}
    >
      <Pods data={data} count={count} variant={variant} active={active} onReady={onReady} onDecline={onDecline} />
    </Canvas>
  );
}
