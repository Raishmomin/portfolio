"use client";

// Ambient scene: the calm, full-bleed neural field behind every section without its own
// visual (services, CTA, writing, FAQ, blog, 404 …). Neurons drift slowly in depth over
// the whole viewport, faint synapses join near neighbours, a signal now and then runs
// along a synapse, and every few seconds a soft activation wave spreads across the field.
// The field scrolls with the page at a slower rate (parallax), wrapping endlessly.
// Two draw calls (points + line segments); every motion is in the shaders, so a frame
// costs a handful of uniform writes and no CPU loops.
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  LineSegments,
  Points,
  ShaderMaterial,
  Vector3,
  type IUniform,
  type PerspectiveCamera,
} from "three";
import { scroll } from "../framing";
import { isLight, setColor, setGlowBlending } from "../fx";
import type { SceneProps } from "../types";

/** Field extent (world units): wide enough for every composition's camera offset. */
const SPAN_X = 16;
const SPAN_Y = 10;
const Z_NEAR = 3;
const Z_FAR = -10;
const COUNT = { high: 1400, low: 620 } as const;
const LINK_R = 2.1; // max synapse length
const LINKS_PER = 2;
/** World units the field moves per viewport of page scroll (slower than the content). */
const SCROLL_RATE = 1.3;

const COMMON = /* glsl */ `
uniform float uTime;
uniform float uScroll;
uniform float uWeight;
uniform float uLight;
uniform vec3 uAi;
uniform vec3 uHot;
uniform vec3 uSpark;
float hash(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
float wrapY(float y) { return mod(y + uScroll + ${SPAN_Y.toFixed(1)}, ${(2 * SPAN_Y).toFixed(1)}) - ${SPAN_Y.toFixed(1)}; }
vec3 drift(vec3 p, float s) {
  p.x += sin(uTime * 0.05 + s * 31.0) * 0.32;
  p.y += cos(uTime * 0.043 + s * 17.0) * 0.28;
  p.z += sin(uTime * 0.037 + s * 11.0) * 0.25;
  return p;
}
// Activation wave: every 4.6 s a ring spreads from a fresh point of the field.
float wave(vec3 p) {
  float k = floor(uTime / 4.6);
  float t = fract(uTime / 4.6);
  vec2 c = (vec2(hash(k * 1.7 + 0.3), hash(k * 3.1 + 0.7)) * 2.0 - 1.0) * vec2(8.0, 3.5);
  float d = length(p.xy - c) - t * 15.0;
  return exp(-d * d * 0.45) * (1.0 - t) * (1.0 - t);
}
`;

const POINT_VERT = /* glsl */ `
${COMMON}
uniform float uScale;
attribute float aSeed;
attribute float aSize;
varying float vA;
varying vec3 vC;
void main() {
  vec3 p = position;
  p.y = wrapY(p.y);
  p = drift(p, aSeed);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float w = wave(p);
  float twinkle = 0.62 + 0.38 * sin(uTime * (0.5 + aSeed * 1.1) + aSeed * 60.0);
  float depth = smoothstep(${Z_FAR.toFixed(1)}, ${Z_NEAR.toFixed(1)}, p.z);
  gl_PointSize = aSize * (1.0 + 0.9 * w) * uScale / max(0.5, -mv.z);
  gl_Position = projectionMatrix * mv;
  float spark = step(0.965, aSeed);
  vA = (0.26 + 0.6 * depth) * twinkle + 0.9 * w;
  vC = mix(mix(uAi, uSpark, spark), uHot, clamp(w * 0.8, 0.0, 1.0));
}`;

const POINT_FRAG = /* glsl */ `
uniform float uWeight;
uniform float uLight;
varying float vA;
varying vec3 vC;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float d = length(q) * 2.0;
  if (d > 1.0) discard;
  float core = smoothstep(0.42, 0.0, d);
  float halo = exp(-d * d * 4.5) * 0.45;
  float a = (core + halo) * vA * uWeight;
  if (uLight < 0.5) gl_FragColor = vec4(vC * a, 0.0);
  else gl_FragColor = vec4(vC, min(a * 0.9, 1.0));
}`;

const LINE_VERT = /* glsl */ `
${COMMON}
attribute float aT;
attribute float aSeed;
attribute float aNode;
attribute float aRef;
varying float vT;
varying float vS;
varying float vW;
varying float vDepth;
void main() {
  vec3 p = position;
  // Both ends wrap with their link's first node, so a synapse never stretches across the field.
  p.y += wrapY(aRef) - aRef;
  p = drift(p, aNode);
  vT = aT;
  vS = aSeed;
  vW = wave(p);
  vDepth = smoothstep(${Z_FAR.toFixed(1)}, ${Z_NEAR.toFixed(1)}, p.z);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

const LINE_FRAG = /* glsl */ `
${COMMON}
varying float vT;
varying float vS;
varying float vW;
varying float vDepth;
void main() {
  float clock = uTime * 0.22 + vS * 7.0;
  float fire = step(0.88, hash(vS * 13.0 + floor(clock)));
  float head = fract(clock) * 1.5 - 0.25;
  float sig = exp(-pow((vT - head) * 6.0, 2.0)) * fire;
  float a = 0.026 + 0.07 * vDepth + 0.34 * vW + 0.8 * sig;
  vec3 c = mix(uAi, uHot, clamp(vW + sig * 0.7, 0.0, 1.0));
  if (uLight < 0.5) gl_FragColor = vec4(c * a * uWeight, 0.0);
  else gl_FragColor = vec4(c, min(a * 1.15, 1.0) * uWeight);
}`;

/** mulberry32: deterministic, so every visit draws the same field. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildField(count: number, uniforms: Record<string, IUniform>) {
  const rand = rng(23);
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  const size = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (rand() * 2 - 1) * SPAN_X;
    pos[i * 3 + 1] = (rand() * 2 - 1) * SPAN_Y;
    pos[i * 3 + 2] = Z_FAR + (Z_NEAR - Z_FAR) * Math.pow(rand(), 0.8);
    seed[i] = rand();
    size[i] = 0.075 + Math.pow(rand(), 3) * 0.22;
  }
  const pointGeo = new BufferGeometry();
  pointGeo.setAttribute("position", new Float32BufferAttribute(pos, 3));
  pointGeo.setAttribute("aSeed", new Float32BufferAttribute(seed, 1));
  pointGeo.setAttribute("aSize", new Float32BufferAttribute(size, 1));

  // Synapses: each node links to its nearest neighbours (grid buckets: no O(n²) scan).
  const cell = LINK_R;
  const buckets = new Map<string, number[]>();
  const keyOf = (x: number, y: number, z: number) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
  for (let i = 0; i < count; i++) {
    const k = keyOf(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
    let b = buckets.get(k);
    if (!b) buckets.set(k, (b = []));
    b.push(i);
  }
  const seen = new Set<number>();
  const lines: number[] = [];
  const near: [number, number][] = [];
  for (let i = 0; i < count; i++) {
    const x = pos[i * 3];
    const y = pos[i * 3 + 1];
    const z = pos[i * 3 + 2];
    near.length = 0;
    const cx = Math.floor(x / cell);
    const cy = Math.floor(y / cell);
    const cz = Math.floor(z / cell);
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dz = -1; dz <= 1; dz++)
          for (const j of buckets.get(`${cx + dx},${cy + dy},${cz + dz}`) ?? []) {
            if (j === i) continue;
            const d = (pos[j * 3] - x) ** 2 + (pos[j * 3 + 1] - y) ** 2 + (pos[j * 3 + 2] - z) ** 2;
            if (d < LINK_R * LINK_R) near.push([d, j]);
          }
    near.sort((a, b) => a[0] - b[0]);
    for (let n = 0; n < Math.min(LINKS_PER, near.length); n++) {
      const j = near[n][1];
      const id = i < j ? i * count + j : j * count + i;
      if (seen.has(id)) continue;
      seen.add(id);
      lines.push(i, j);
    }
  }
  const segs = lines.length / 2;
  const lpos = new Float32Array(segs * 6);
  const lt = new Float32Array(segs * 2);
  const lseed = new Float32Array(segs * 2);
  const lnode = new Float32Array(segs * 2);
  const lref = new Float32Array(segs * 2);
  for (let s = 0; s < segs; s++) {
    const a = lines[s * 2];
    const b = lines[s * 2 + 1];
    lpos.set(pos.subarray(a * 3, a * 3 + 3), s * 6);
    lpos.set(pos.subarray(b * 3, b * 3 + 3), s * 6 + 3);
    lt[s * 2 + 1] = 1;
    lseed[s * 2] = lseed[s * 2 + 1] = (s * 0.618034) % 1;
    lnode[s * 2] = seed[a];
    lnode[s * 2 + 1] = seed[b];
    lref[s * 2] = lref[s * 2 + 1] = pos[a * 3 + 1];
  }
  const lineGeo = new BufferGeometry();
  lineGeo.setAttribute("position", new Float32BufferAttribute(lpos, 3));
  lineGeo.setAttribute("aT", new Float32BufferAttribute(lt, 1));
  lineGeo.setAttribute("aSeed", new Float32BufferAttribute(lseed, 1));
  lineGeo.setAttribute("aNode", new Float32BufferAttribute(lnode, 1));
  lineGeo.setAttribute("aRef", new Float32BufferAttribute(lref, 1));

  const pointMat = new ShaderMaterial({
    uniforms: { ...uniforms, uScale: { value: 400 } },
    vertexShader: POINT_VERT,
    fragmentShader: POINT_FRAG,
  });
  const lineMat = new ShaderMaterial({ uniforms, vertexShader: LINE_VERT, fragmentShader: LINE_FRAG });
  const points = new Points(pointGeo, pointMat);
  const synapses = new LineSegments(lineGeo, lineMat);
  points.frustumCulled = synapses.frustumCulled = false;
  synapses.renderOrder = -2;
  points.renderOrder = -1;
  return {
    objects: [synapses, points],
    materials: [pointMat, lineMat],
    dispose() {
      pointGeo.dispose();
      lineGeo.dispose();
      pointMat.dispose();
      lineMat.dispose();
    },
  };
}

class AmbientField {
  readonly group = new Group();
  private readonly uniforms: Record<string, IUniform> = {
    uTime: { value: 0 },
    uScroll: { value: 0 },
    uWeight: { value: 0 },
    uLight: { value: 0 },
    uAi: { value: new Vector3() },
    uHot: { value: new Vector3() },
    uSpark: { value: new Vector3() },
  };
  private readonly field: ReturnType<typeof buildField>;
  private scroll = -1;

  constructor(quality: SceneProps["quality"]) {
    this.field = buildField(COUNT[quality], this.uniforms);
    this.group.add(...this.field.objects);
  }

  setPalette(p: SceneProps["palette"]) {
    const u = this.uniforms;
    const light = isLight(p.bg);
    u.uLight.value = light ? 1 : 0;
    setColor(u.uAi.value, p.ai, light ? undefined : p.fg, light ? 0 : 0.15);
    if (light) setColor(u.uHot.value, p.ai, p.fg, 0.4);
    else setColor(u.uHot.value, p.ai, "#ffffff", 0.55);
    setColor(u.uSpark.value, p.accent);
    for (const m of this.field.materials) setGlowBlending(m, light);
  }

  frame(camera: PerspectiveCamera, height: number, dpr: number, dt: number, weight: number) {
    const u = this.uniforms;
    u.uTime.value += Math.min(dt, 0.1);
    u.uWeight.value = weight;
    // The page scroll drives a slow parallax drift (eased, so wheel steps glide). The stage
    // is fixed to the viewport, so the canvas height is the viewport height.
    const target = (scroll.y / Math.max(1, height)) * SCROLL_RATE;
    this.scroll = this.scroll < 0 ? target : this.scroll + (target - this.scroll) * (1 - Math.exp(-Math.min(dt, 0.1) / 0.25));
    u.uScroll.value = this.scroll;
    (this.field.materials[0].uniforms.uScale as IUniform).value =
      (height * dpr) / (2 * Math.tan(((camera.fov ?? 40) * Math.PI) / 360));
  }

  /** GPU resources only: React (StrictMode included) owns attaching/detaching the group. */
  dispose() {
    this.field.dispose();
  }
}

export default function Ambient({ weight, palette, quality }: SceneProps) {
  const field = useMemo(() => new AmbientField(quality), [quality]);
  useEffect(() => () => field.dispose(), [field]);
  useEffect(() => field.setPalette(palette), [field, palette]);

  useFrame((s, delta) => {
    if (weight === 0) return;
    field.frame(s.camera as PerspectiveCamera, s.size.height, s.viewport.dpr, delta, weight);
  });

  // Stays mounted while hidden: re-attaching a primitive after an unmount is not reliable.
  return <primitive object={field.group} visible={weight > 0} />;
}
