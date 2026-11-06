// The AI scene's mutable side: GPU resources plus the per-frame update, in a plain class
// so React only wires its lifecycle (nothing re-renders per frame, nothing allocates).
import type { RootState } from "@react-three/fiber";
import {
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
  DynamicDrawUsage,
  IcosahedronGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector3,
  type Group,
} from "three";
import type { ScenePalette } from "../../types";
import { buildCluster } from "./cluster";
import { disposeAll, makeAiMaterials, makeUniforms } from "./materials";
import { MAX_STAGES, pathAt, PipeCurve, tangentAt, type PipelineModel } from "./pipeline";
import { clamp01, damp, pointScale, rng, smooth } from "./shared";

export const PARTICLES = { high: 1200, low: 450 } as const;
const TAU = Math.PI * 2;
const X_AXIS = new Vector3(1, 0, 0);
export const MAX_TITLES = 64;

function buildGeometry() {
  const rand = rng(11);
  const n = PARTICLES.high;
  const aT = new Float32Array(n);
  const aSpeed = new Float32Array(n);
  const aOff = new Float32Array(n * 3);
  const aSize = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const stray = rand() < 0.14;
    aT[i] = rand();
    aSpeed[i] = 0.09 + rand() * 0.07;
    aOff[i * 3] = stray ? 0.07 + rand() * 0.13 : rand() * 0.04; // radius round the pipe
    aOff[i * 3 + 1] = rand() * TAU; // start angle
    aOff[i * 3 + 2] = (rand() - 0.5) * 2.4; // swirl, rad/s
    aSize[i] = stray ? 0.035 + rand() * 0.03 : 0.05 + rand() * 0.05;
  }
  const particles = new BufferGeometry();
  particles.setAttribute("position", new BufferAttribute(new Float32Array(n * 3), 3));
  particles.setAttribute("aT", new BufferAttribute(aT, 1));
  particles.setAttribute("aSpeed", new BufferAttribute(aSpeed, 1));
  particles.setAttribute("aOff", new BufferAttribute(aOff, 3));
  particles.setAttribute("aSize", new BufferAttribute(aSize, 1));

  const halos = new BufferGeometry();
  const dyn = (size: number) => new BufferAttribute(new Float32Array(MAX_STAGES * size), size).setUsage(DynamicDrawUsage);
  halos.setAttribute("position", dyn(3));
  halos.setAttribute("aSize", dyn(1));
  halos.setAttribute("aColor", dyn(3));
  halos.setAttribute("aAlpha", dyn(1));

  const curve = new PipeCurve();
  return {
    tube: new TubeGeometry(curve, 260, 0.028, 10, false),
    glow: new TubeGeometry(curve, 160, 0.14, 12, false),
    particles,
    halos,
    core: new IcosahedronGeometry(0.13, 3),
    ring: new TorusGeometry(0.36, 0.013, 8, 120),
    disc: new CylinderGeometry(0.24, 0.24, 0.065, 48),
    sat: new IcosahedronGeometry(0.05, 1),
    wave: new TorusGeometry(0.3, 0.008, 6, 72),
  };
}

export type AiFrameInput = {
  model: PipelineModel;
  progress: number;
  weight: number;
  pointer: { x: number; y: number };
  focus: string | null;
  /** The project on top of the AI card deck ([data-deck] "cp:deck"), when the deck is live. */
  deck: string | null;
  scale: number;
  /** Resting yaw of the whole pipeline (radians). */
  yaw: number;
};

/** Scene objects (registered by the component's callback refs) and the labels' opacities. */
export type AiRegistry = {
  root: Group | null;
  stages: (Group | null)[];
  /** Per stage label / per project title, written by frame() (0 = hidden). */
  labelO: Float32Array;
  titleO: Float32Array;
};
export const emptyRegistry = (): AiRegistry => ({
  root: null,
  stages: [],
  labelO: new Float32Array(MAX_STAGES),
  titleO: new Float32Array(MAX_TITLES),
});

export class AiRig {
  readonly U = makeUniforms();
  readonly geo = buildGeometry();
  readonly cluster = buildCluster();
  readonly mats;
  private cur = -1;
  private rx = 0.24;
  private ry = -0.3;
  private p = new Vector3();
  private t = new Vector3();

  constructor(light: boolean) {
    this.mats = makeAiMaterials(this.U, light);
    this.U.uLight.value = light ? 1 : 0;
  }

  /** Opacity of speech wave ring k (0..1, times the scene weight). */
  setWave(k: number, o: number) {
    this.mats.waves[k].uniforms.uOpacity.value = o * this.U.uOpacity.value;
  }

  setQuality(q: "high" | "low") {
    this.geo.particles.setDrawRange(0, PARTICLES[q]);
  }

  setPalette(p: ScenePalette, model: PipelineModel) {
    const { U, mats, geo } = this;
    const light = U.uLight.value > 0.5;
    U.uAi.value.set(p.ai);
    U.uAccent.value.set(p.accent);
    U.uFg.value.set(p.fg);
    mats.core.uniforms.uColor.value.set(p.ai).lerp(U.uFg.value, light ? 0 : 0.55);
    mats.core.uniforms.uRim.value.set(p.ai).multiplyScalar(light ? 0.55 : 1);
    mats.coreOut.uniforms.uColor.value.set(p.accent).lerp(U.uFg.value, light ? 0 : 0.45);
    mats.coreOut.uniforms.uRim.value.set(p.accent).multiplyScalar(light ? 0.6 : 1);
    const llm = model.vocab.findIndex((v) => v.kind === "llm");
    const col = geo.halos.getAttribute("aColor") as BufferAttribute;
    const size = geo.halos.getAttribute("aSize") as BufferAttribute;
    model.vocab.forEach((v, i) => {
      const c = llm >= 0 && i > llm ? U.uAccent.value : U.uAi.value;
      col.setXYZ(i, c.r, c.g, c.b);
      size.setX(i, v.kind === "llm" ? 1.7 : 0.9);
    });
    col.needsUpdate = size.needsUpdate = true;
    this.cluster.paint(U.uAi.value, U.uFg.value);
  }

  frame(state: RootState, delta: number, f: AiFrameInput, r: AiRegistry) {
    const g = r.root;
    if (f.weight <= 0 || !g) return;
    const U = this.U;
    const geo = this.geo;
    const model = f.model;
    const dt = Math.min(delta, 0.1);
    const n = model.projects.length;
    // Hover/focus wins, then the card on top of the live deck, else equal progress slices
    // (phones, motion off: no deck).
    const picked = (f.focus ? model.index.get(f.focus) : undefined) ?? (f.deck ? model.index.get(f.deck) : undefined);
    const target = picked ?? Math.min(n - 1, Math.floor(clamp01(f.progress) * n));
    this.cur = this.cur < 0 || this.cur > n - 1 || Math.abs(this.cur - target) < 1e-3 ? target : damp(this.cur, target, 3.2, dt);
    const a = Math.floor(this.cur);
    const b = Math.min(n - 1, a + 1);
    const k = smooth(0, 1, this.cur - a);

    const time = state.clock.elapsedTime;
    U.uTime.value = time;
    U.uOpacity.value = f.weight;
    const halo = geo.halos.getAttribute("position") as BufferAttribute;
    const haloA = geo.halos.getAttribute("aAlpha") as BufferAttribute;
    let start = 1;
    let end = 0;
    let llmSeen = false;
    for (let v = 0; v < model.vocab.length; v++) {
      const tt = model.t[a][v] + (model.t[b][v] - model.t[a][v]) * k;
      const pres = model.present[a][v] + (model.present[b][v] - model.present[a][v]) * k;
      U.uStT.value[v] = tt;
      U.uStP.value[v] = pres;
      if (pres > 0.02) {
        start = Math.min(start, tt);
        end = Math.max(end, tt);
      }
      if (model.vocab[v].kind === "llm" && !llmSeen) {
        llmSeen = true;
        U.uLlmT.value = tt;
        U.uLlmP.value = pres;
      }
      pathAt(tt, this.p);
      halo.setXYZ(v, this.p.x, this.p.y, this.p.z);
      haloA.setX(v, pres * (0.55 + 0.12 * Math.sin(time * 2.2 + v)));
      const sg = r.stages[v];
      if (sg) {
        sg.position.copy(this.p);
        sg.quaternion.setFromUnitVectors(X_AXIS, tangentAt(tt, this.t));
        sg.scale.setScalar(Math.max(1e-4, smooth(0, 1, pres)));
        sg.visible = pres > 0.01;
      }
      r.labelO[v] = pres * pres * f.weight;
    }
    halo.needsUpdate = haloA.needsUpdate = true;
    if (!llmSeen) U.uLlmT.value = 2; // no model stage: the whole stream stays blue
    U.uStart.value = start;
    U.uEnd.value = end;
    for (let j = 0; j < n && j < MAX_TITLES; j++) r.titleO[j] = Math.max(0, 1 - Math.abs(this.cur - j) * 2.2) * f.weight;

    // Turned a little so the stream flows toward the viewer: input far left, the answer near right.
    this.ry = damp(this.ry, f.yaw + f.pointer.x * 0.2 + Math.sin(time * 0.17) * 0.05, 2.4, dt);
    this.rx = damp(this.rx, 0.24 - f.pointer.y * 0.12, 2.4, dt);
    g.rotation.set(this.rx, this.ry, 0);
    const sc = f.scale * (0.86 + 0.14 * f.weight);
    g.scale.setScalar(sc);
    pointScale(state.camera, state.size.height, state.viewport.dpr, sc, U);
    state.invalidate();
  }

  dispose() {
    disposeAll(this.mats);
    disposeAll(this.geo);
    this.cluster.points.dispose();
    this.cluster.lines.dispose();
  }
}
