// The work scene's mutable side: one instanced draw call for every project card
// (rounded "app window" drawn in the fragment shader) plus the per-frame layout.
import type { RootState } from "@react-three/fiber";
import {
  Color,
  DynamicDrawUsage,
  Euler,
  InstancedBufferAttribute,
  InstancedMesh,
  Object3D,
  PlaneGeometry,
  Quaternion,
  ShaderMaterial,
  Vector3,
  type Group,
} from "three";
import type { NeuralData, ScenePalette } from "../../types";
import { clamp01, damp, isLight, rng, smooth } from "../ai/shared";

export const CARD_W = 2.4;
export const CARD_H = 1.5;
const PAD = 0.45; // quad margin for the glow/shadow
const RADIUS = 7.5; // concave arc: cards face a point in front of the wall
const GAP = 0.32;
const ROW_GAP = 0.36;

const VERT = /* glsl */ `
attribute float aFocus;
attribute float aAi;
attribute float aTech;
attribute float aAlpha;
attribute float aSeed;
varying vec2 vP;
varying float vFocus;
varying float vAi;
varying float vTech;
varying float vAlpha;
varying float vSeed;
uniform vec2 uQuad;
void main() {
  vP = (uv - 0.5) * uQuad;
  vFocus = aFocus;
  vAi = aAi;
  vTech = aTech;
  vAlpha = aAlpha;
  vSeed = aSeed;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}
`;

const FRAG = /* glsl */ `
uniform vec2 uSize;
uniform vec2 uQuad;
uniform float uTime;
uniform float uOpacity;
uniform float uLight;
uniform vec3 uBg;
uniform vec3 uFg;
uniform vec3 uAi;
uniform vec3 uAccent;
uniform vec3 uOk;
uniform vec3 uMuted;
varying vec2 vP;
varying float vFocus;
varying float vAi;
varying float vTech;
varying float vAlpha;
varying float vSeed;

float sdBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
float sdSeg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
}
float fill(float d) { float w = fwidth(d); return 1.0 - smoothstep(-w, w, d); }

void main() {
  vec2 h = uSize * 0.5;
  float d = sdBox(vP, h, 0.12);
  float body = fill(d);
  vec3 tint = mix(uFg, uAi, vAi);
  float gy = vP.y / uSize.y + 0.5;

  // Panel: soft vertical gradient, a slow diagonal sheen, a little lift when focused.
  vec3 top = mix(uBg, uFg, mix(0.075, 0.0, uLight)) + mix(0.0, 0.03, uLight);
  vec3 bottom = mix(uBg, tint, mix(0.1, 0.05, uLight));
  vec3 col = mix(bottom, top, smoothstep(0.0, 1.0, gy));
  float band = fract((vP.x * 0.35 + vP.y * 0.65) * 0.22 - uTime * 0.035 + vSeed);
  col += smoothstep(0.08, 0.0, abs(band - 0.5)) * mix(0.035, 0.05, uLight) * (1.0 - uLight * 0.5);
  col = mix(col, mix(col, uAccent, 0.06), vFocus);

  // Window chrome: three dots and a hairline under the bar.
  float barY = h.y - 0.22;
  float line = fill(abs(vP.y - barY) - 0.004) * step(abs(vP.x), h.x);
  vec3 lineCol = mix(uBg, uFg, mix(0.16, 0.14, uLight));
  col = mix(col, lineCol, line);
  for (int i = 0; i < 3; i++) {
    vec2 c = vec2(-h.x + 0.17 + float(i) * 0.11, h.y - 0.11);
    vec3 dot3 = i == 0 ? uAccent : (i == 1 ? uMuted : uOk);
    col = mix(col, dot3, fill(length(vP - c) - 0.032) * 0.9);
  }
  // AI projects: a tiny neural network glyph (2-3-1) at the right end of the bar.
  if (vAi > 0.5) {
    vec2 o = vec2(h.x - 0.4, h.y - 0.11);
    vec2 n0 = o + vec2(0.0, 0.04), n1 = o + vec2(0.0, -0.04);
    vec2 m0 = o + vec2(0.12, 0.065), m1 = o + vec2(0.12, 0.0), m2 = o + vec2(0.12, -0.065);
    vec2 q = o + vec2(0.24, 0.0);
    float l = min(min(min(sdSeg(vP, n0, m0), sdSeg(vP, n0, m1)), min(sdSeg(vP, n0, m2), sdSeg(vP, n1, m0))),
                  min(min(sdSeg(vP, n1, m1), sdSeg(vP, n1, m2)), min(min(sdSeg(vP, m0, q), sdSeg(vP, m1, q)), sdSeg(vP, m2, q))));
    float nodes = min(min(min(length(vP - n0), length(vP - n1)), min(length(vP - m0), length(vP - m1))), min(length(vP - m2), length(vP - q)));
    float pulse = 0.6 + 0.4 * sin(uTime * 3.0 + vSeed * 6.0);
    col = mix(col, uAi, fill(l - 0.006) * 0.55);
    col = mix(col, uAi, fill(nodes - 0.022) * pulse);
  }
  // Content skeleton under the title (the title itself is DOM text on top).
  float w1 = 0.55 + 0.25 * fract(vSeed * 7.1);
  float w2 = 0.35 + 0.25 * fract(vSeed * 3.7);
  vec3 skel = mix(uBg, uFg, mix(0.13, 0.1, uLight));
  col = mix(col, skel, fill(sdBox(vP - vec2(-h.x + 0.16 + w1 * h.x, -0.1), vec2(w1 * h.x, 0.026), 0.026)));
  col = mix(col, skel, fill(sdBox(vP - vec2(-h.x + 0.16 + w2 * h.x, -0.23), vec2(w2 * h.x, 0.026), 0.026)));
  // One chip per technology the project uses (real count, capped to fit).
  float chips = min(vTech, 9.0);
  float slot = floor((vP.x + h.x - 0.16) / 0.225);
  vec2 cc = vec2(-h.x + 0.16 + slot * 0.225 + 0.09, -h.y + 0.2);
  float chip = fill(sdBox(vP - cc, vec2(0.09, 0.045), 0.045)) * step(0.0, slot) * step(slot, chips - 1.0);
  col = mix(col, mix(uMuted, uAi, vAi), chip * mix(0.55, 0.45, uLight));

  // Border: hairline, AI-tinted for AI projects, orange when focused.
  float edge = fill(abs(d) - 0.006);
  vec3 border = mix(mix(uBg, uFg, mix(0.22, 0.2, uLight)), uAi, vAi * 0.55);
  border = mix(border, uAccent, vFocus);
  col = mix(col, border, edge * (0.8 + 0.2 * vFocus));

  // Outside: a glow on dark, a soft shadow on paper (both stronger when focused).
  float od = max(d, 0.0);
  float glow = exp(-od * mix(10.0, 7.0, vFocus)) * (1.0 - body);
  vec3 glowCol = mix(mix(uAi, uFg, 0.4 - 0.4 * vAi), uAccent, vFocus);
  float shadowD = max(sdBox(vP + vec2(0.0, 0.08), h, 0.12), 0.0);
  float shadow = exp(-shadowD * 7.0) * (1.0 - body);
  vec3 outCol = mix(glowCol, mix(uFg, uAccent, vFocus * 0.5), uLight);
  float outA = mix(glow * (0.12 + 0.35 * vFocus), shadow * (0.1 + 0.12 * vFocus), uLight);

  // Fade the glow out before the quad's edge so no rectangle ever shows.
  outA *= clamp(-sdBox(vP, uQuad * 0.5, 0.0) / 0.22, 0.0, 1.0);
  float a = body * mix(0.94, 0.97, uLight) + outA;
  vec3 c = (col * body * mix(0.94, 0.97, uLight) + outCol * outA) / max(a, 1e-4);
  gl_FragColor = vec4(c, a * vAlpha * uOpacity);
  #include <colorspace_fragment>
}
`;

export type WorkFrameInput = {
  data: NeuralData["work"];
  progress: number;
  weight: number;
  pointer: { x: number; y: number };
  focus: string | null;
  scale: number;
};
export type WorkRegistry = { root: Group | null; mesh: InstancedMesh | null; labels: (Group | null)[]; titles: (HTMLElement | null)[] };
export const emptyWorkRegistry = (): WorkRegistry => ({ root: null, mesh: null, labels: [], titles: [] });

/** Columns of the card wall: 2 on portrait screens, else 1 row up to 4 cards and 2 rows above. */
export function columns(n: number, portrait: boolean) {
  if (portrait) return Math.min(2, n);
  return n >= 5 ? Math.ceil(n / 2) : n;
}

/** Where card i of n rests on the arc (before rotation), in arc angle + row height. */
export function slots(n: number, cols: number) {
  const rows = Math.ceil(n / cols);
  const step = (CARD_W + GAP) / RADIUS;
  return Array.from({ length: n }, (_, i) => {
    const r = Math.floor(i / cols);
    const inRow = r === rows - 1 ? n - cols * (rows - 1) : cols;
    const c = i - r * cols;
    return { angle: (c - (inRow - 1) / 2) * step, y: ((rows - 1) / 2 - r) * (CARD_H + ROW_GAP) };
  });
}

export class WorkRig {
  readonly n: number;
  readonly geometry = new PlaneGeometry(CARD_W + PAD * 2, CARD_H + PAD * 2);
  readonly material: ShaderMaterial;
  private slots: { angle: number; y: number }[];
  private readonly from: { p: Vector3; q: Quaternion }[];
  private readonly focus: Float32Array;
  private readonly aFocus: InstancedBufferAttribute;
  private readonly aAlpha: InstancedBufferAttribute;
  private readonly seeds: Float32Array;
  readonly attrs: Record<string, InstancedBufferAttribute>;
  private pp = -1;
  private turnScale = 1;
  private rx = 0;
  private ry = 0;
  private dummy = new Object3D();
  private q = new Quaternion();
  private v = new Vector3();
  private shown: number[] = [];
  private shownEl: (HTMLElement | null)[] = [];

  constructor(work: NeuralData["work"]) {
    const n = (this.n = Math.max(1, work.length));
    const rand = rng(23);
    this.slots = slots(n, columns(n, false));
    this.from = this.slots.map(() => ({
      p: new Vector3((rand() - 0.5) * 18, (rand() - 0.5) * 10, -5 - rand() * 9),
      q: new Quaternion().setFromEuler(new Euler((rand() - 0.5) * 2.4, (rand() - 0.5) * 2.8, (rand() - 0.5) * 1.6)),
    }));
    this.focus = new Float32Array(n);
    this.seeds = Float32Array.from({ length: n }, () => rand());
    const attr = (values: ArrayLike<number>, dynamic = false) => {
      const a = new InstancedBufferAttribute(Float32Array.from(values), 1);
      if (dynamic) a.setUsage(DynamicDrawUsage);
      return a;
    };
    this.aFocus = attr(new Float32Array(n), true);
    this.aAlpha = attr(new Float32Array(n), true);
    this.attrs = {
      aFocus: this.aFocus,
      aAlpha: this.aAlpha,
      aAi: attr(Array.from({ length: n }, (_, i) => (work[i]?.ai ? 1 : 0))),
      aTech: attr(Array.from({ length: n }, (_, i) => work[i]?.techCount ?? 4)),
      aSeed: attr(this.seeds),
    };
    for (const [k, a] of Object.entries(this.attrs)) this.geometry.setAttribute(k, a);
    this.material = new ShaderMaterial({
      uniforms: {
        uQuad: { value: [CARD_W + PAD * 2, CARD_H + PAD * 2] },
        uSize: { value: [CARD_W, CARD_H] },
        uTime: { value: 0 },
        uOpacity: { value: 0 },
        uLight: { value: 0 },
        uBg: { value: new Color() },
        uFg: { value: new Color() },
        uAi: { value: new Color() },
        uAccent: { value: new Color() },
        uOk: { value: new Color() },
        uMuted: { value: new Color() },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
    });
  }

  setColumns(cols: number) {
    this.slots = slots(this.n, cols);
    this.turnScale = Math.min(1, cols / 3);
  }

  setPalette(p: ScenePalette) {
    const u = this.material.uniforms;
    u.uLight.value = isLight(p.bg) ? 1 : 0;
    u.uBg.value.set(p.bg);
    u.uFg.value.set(p.fg);
    u.uAi.value.set(p.ai);
    u.uAccent.value.set(p.accent);
    u.uOk.value.set(p.ok);
    u.uMuted.value.set(p.muted);
  }

  private fade(el: HTMLElement | null, i: number, o: number) {
    if (!el) return;
    if (this.shownEl[i] !== el) {
      this.shownEl[i] = el;
      this.shown[i] = -1;
    }
    if (Math.abs(this.shown[i] - o) < 0.01) return;
    this.shown[i] = o;
    el.style.opacity = o.toFixed(2);
  }

  frame(state: RootState, delta: number, f: WorkFrameInput, r: WorkRegistry) {
    const root = r.root;
    const mesh = r.mesh;
    if (f.weight <= 0 || !root || !mesh) return;
    const dt = Math.min(delta, 0.1);
    const time = state.clock.elapsedTime;
    this.pp = this.pp < 0 ? f.progress : damp(this.pp, f.progress, 5, dt);
    const enter = clamp01(this.pp / 0.3);
    // After assembling, the wall turns slowly as the section scrolls past (plus a breath of sway).
    const turn = ((smooth(0.3, 1, this.pp) - 0.5) * -0.16 + Math.sin(time * 0.11) * 0.03) * this.turnScale;
    const n = this.n;
    const stagger = 0.4 / n;
    let any = 0;
    for (let i = 0; i < n; i++) {
      const target = f.focus !== null && f.data[i]?.slug === f.focus ? 1 : 0;
      this.focus[i] = damp(this.focus[i], target, 7, dt);
      any = Math.max(any, this.focus[i]);
    }
    for (let i = 0; i < n; i++) {
      const s = this.slots[i];
      const k = clamp01((enter - i * stagger) / (1 - (n - 1) * stagger));
      const e = 1 - (1 - k) ** 3; // ease-out cubic
      const fi = this.focus[i];
      const ang = s.angle + turn;
      const d = this.dummy;
      // Rest pose on the arc, lifted toward the viewer along its normal when focused.
      d.position.set(Math.sin(ang) * RADIUS, s.y + Math.sin(time * 0.7 + this.seeds[i] * 6.28) * 0.045, RADIUS - Math.cos(ang) * RADIUS);
      this.v.set(-Math.sin(ang), 0, Math.cos(ang)).multiplyScalar(0.75 * fi);
      d.position.add(this.v);
      this.q.setFromAxisAngle(Y_AXIS, -ang);
      // Fly in from a scattered pose.
      const from = this.from[i];
      d.position.lerpVectors(from.p, d.position, e);
      d.quaternion.slerpQuaternions(from.q, this.q, e);
      d.scale.setScalar((0.6 + 0.4 * e) * (1 + 0.07 * fi));
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
      const g = r.labels[i];
      if (g) g.matrix.copy(d.matrix);
      const alpha = smooth(0, 0.45, k) * (1 - 0.3 * any * (1 - fi));
      this.aFocus.array[i] = fi;
      this.aAlpha.array[i] = alpha;
      this.fade(r.titles[i], i, smooth(0.6, 1, k) * f.weight * (1 - 0.35 * any * (1 - fi)));
    }
    mesh.instanceMatrix.needsUpdate = true;
    this.aFocus.needsUpdate = this.aAlpha.needsUpdate = true;

    const u = this.material.uniforms;
    u.uTime.value = time;
    u.uOpacity.value = f.weight;
    this.ry = damp(this.ry, f.pointer.x * 0.14, 2.4, dt);
    this.rx = damp(this.rx, -f.pointer.y * 0.08 + 0.04, 2.4, dt);
    root.rotation.set(this.rx, this.ry, 0);
    root.scale.setScalar(f.scale * (0.9 + 0.1 * f.weight));
    state.invalidate();
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}
const Y_AXIS = new Vector3(0, 1, 0);
