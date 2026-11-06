// The contact scene's mutable side. Everything the visitor has seen — every skill,
// company and project as a bright node, plus a galaxy of dust — swirls inward
// (positions computed in the vertex shader from one `uConv` uniform) into a single
// pulsing node, which then throws a beam of light out toward the viewer.
import type { RootState } from "@react-three/fiber";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  IcosahedronGeometry,
  NormalBlending,
  PlaneGeometry,
  ShaderMaterial,
  Vector3,
  type Group,
  type IUniform,
} from "three";
import type { NeuralData, ScenePalette } from "../../types";
import { damp, FRESNEL_FRAG, FRESNEL_VERT, isLight, pointScale, POINT_FRAG, rng, smooth } from "../ai/shared";

export const DUST = { high: 1500, low: 550 } as const;
const R_MAX = 7;
const TAU = Math.PI * 2;

/** Shared GLSL: where a node is at convergence uConv (0 = spread galaxy, 1 = all in the centre). */
const CONVERGE = /* glsl */ `
uniform float uTime;
uniform float uConv;
uniform float uKeep;
attribute float aR;
attribute float aA;
attribute float aY;
attribute float aDelay;
vec3 converge(out float e) {
  float k = clamp(uConv * 1.4 - aDelay, 0.0, 1.0);
  e = k * k * (3.0 - 2.0 * k);
  // Orbit (inner rings faster), and swirl harder as the node is pulled in.
  float ang = aA + uTime * (0.03 + 0.22 / (aR + 0.6)) + e * 2.6;
  // Dust settles into a small accretion disc round the node (uKeep); nodes melt into it.
  float rEnd = uKeep * (0.3 + 0.1 * aR);
  float r = rEnd + (aR - rEnd) * pow(1.0 - e, 1.4);
  return vec3(cos(ang) * r, aY * (1.0 - e), sin(ang) * r);
}
`;

const NODES_VERT = /* glsl */ `
${CONVERGE}
attribute float aSize;
attribute vec3 aColor;
uniform float uPx;
uniform float uPersp;
varying vec3 vColor;
varying float vAlpha;
void main() {
  float e;
  vec3 p = converge(e);
  vColor = aColor * (1.0 + 0.8 * e);
  // Nodes melt into the centre as they arrive.
  vAlpha = mix(1.0 - smoothstep(0.8, 1.0, e), 1.0 - 0.35 * e, uKeep) * (0.7 + 0.3 * sin(uTime * 1.7 + aA * 5.0));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = aSize * (1.0 - 0.4 * e) * uPx / mix(1.0, -mv.z, uPersp);
  gl_Position = projectionMatrix * mv;
}
`;

const LINES_VERT = /* glsl */ `
${CONVERGE}
attribute float aSpoke;
varying float vA;
uniform float uLight;
void main() {
  float e;
  vec3 p = converge(e);
  // Mesh links fade as the network collapses; spokes (node → you) brighten first.
  float mesh = (1.0 - aSpoke) * (1.0 - smoothstep(0.2, 0.7, uConv)) * 0.35;
  float spoke = aSpoke * smoothstep(0.02, 0.3, uConv) * (1.0 - smoothstep(0.75, 1.0, uConv)) * 0.5;
  vA = (mesh + spoke) * (1.0 - smoothstep(0.85, 1.0, e)) * mix(1.0, 0.8, uLight);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;
const LINES_FRAG = /* glsl */ `
uniform float uOpacity;
uniform vec3 uColor;
varying float vA;
void main() {
  gl_FragColor = vec4(uColor, vA * uOpacity);
  #include <colorspace_fragment>
}
`;

// Screen-facing quad (billboarded in view space) for the halo and the shock rings.
const HALO_VERT = /* glsl */ `
uniform float uSize;
varying vec2 vP;
void main() {
  vP = position.xy;
  vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  mv.xy += position.xy * uSize;
  gl_Position = projectionMatrix * mv;
}
`;
const HALO_FRAG = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
uniform float uGlow;
uniform float uRings;
uniform float uLight;
uniform vec3 uColor;
uniform vec3 uCore;
varying vec2 vP;
void main() {
  float r = length(vP) * 2.0; // 0 centre .. 1 quad edge
  float halo = exp(-r * r * 9.0) * uGlow + exp(-r * 4.5) * 0.25 * uGlow;
  float rings = 0.0;
  for (int i = 0; i < 3; i++) {
    float f = fract(uTime * 0.42 + float(i) / 3.0);
    float d = (r - f * 0.95) * 34.0;
    rings += exp(-d * d) * (1.0 - f) * (1.0 - f);
  }
  rings *= uRings;
  vec3 col = mix(uColor, uCore, exp(-r * r * 40.0) * (1.0 - uLight));
  float a = (halo * mix(1.0, 0.55, uLight) + rings * mix(0.6, 0.5, uLight)) * (1.0 - smoothstep(0.9, 1.0, r));
  gl_FragColor = vec4(col, clamp(a, 0.0, 1.0) * uOpacity);
  #include <colorspace_fragment>
}
`;

// The beam: a camera-facing ribbon from the centre node to a point just in front of
// the viewer (lower right), widening as it comes closer; light pulses run outward.
const BEAM_VERT = /* glsl */ `
uniform vec3 uEnd;
uniform float uGrow;
attribute float aS;
attribute float aSide;
varying float vS;
varying float vSide;
void main() {
  vS = aS;
  vSide = aSide;
  vec3 a = (modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vec3 b = (modelViewMatrix * vec4(uEnd, 1.0)).xyz;
  vec3 p = mix(a, b, aS * uGrow);
  vec3 dir = normalize(b - a);
  vec3 side = normalize(cross(dir, normalize(-p)));
  float width = mix(0.03, 0.16, aS * uGrow);
  gl_Position = projectionMatrix * vec4(p + side * aSide * width, 1.0);
}
`;
const BEAM_FRAG = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
uniform float uLight;
uniform vec3 uColor;
uniform vec3 uCore;
varying float vS;
varying float vSide;
void main() {
  float across = exp(-vSide * vSide * 3.5);
  float core = exp(-vSide * vSide * 40.0);
  float pulse = pow(0.5 + 0.5 * sin((vS * 5.0 - uTime * 0.9) * 6.2831853), 6.0);
  float head = smoothstep(0.0, 0.04, vS);
  vec3 col = mix(uColor, uCore, core * (1.0 - uLight) * 0.8);
  float a = (across * 0.45 + core * 0.7 + pulse * across * 0.5) * head;
  gl_FragColor = vec4(col, clamp(a, 0.0, 1.0) * uOpacity);
  #include <colorspace_fragment>
}
`;

type Entity = { size: number; color: "skill" | "work" | "ai" | "exp" };

function buildGraph(data: NeuralData) {
  const ents: Entity[] = [
    ...data.skills.map(() => ({ size: 0.16, color: "skill" as const })),
    ...data.experience.map(() => ({ size: 0.3, color: "exp" as const })),
  ];
  const seen = new Set<string>();
  for (const p of [...data.ai.map((a) => ({ slug: a.slug, ai: true })), ...data.work]) {
    if (seen.has(p.slug)) continue;
    seen.add(p.slug);
    ents.push({ size: 0.24, color: p.ai ? "ai" : "work" });
  }
  if (ents.length === 0) for (let i = 0; i < 24; i++) ents.push({ size: 0.18, color: "skill" });
  return ents;
}

export type ContactFrameInput = { progress: number; weight: number; pointer: { x: number; y: number }; scale: number };
export type ContactRegistry = { root: Group | null; core: Group | null };

export class ContactRig {
  readonly U: Record<string, IUniform>;
  readonly dust = new BufferGeometry();
  readonly nodes = new BufferGeometry();
  readonly lines = new BufferGeometry();
  readonly quad = new PlaneGeometry(1, 1);
  readonly beamGeo = new BufferGeometry();
  readonly sphere = new IcosahedronGeometry(0.2, 4);
  readonly mats;
  private readonly kinds: Entity["color"][];
  private readonly dustTint: Float32Array;
  private pp = -1;
  private rx = 0;
  private ry = 0;
  private v = new Vector3();

  constructor(data: NeuralData, light: boolean) {
    const rand = rng(41);
    const ents = buildGraph(data);
    this.kinds = ents.map((e) => e.color);
    this.U = {
      uTime: { value: 0 },
      uConv: { value: 0 },
      uOpacity: { value: 0 },
      uLight: { value: light ? 1 : 0 },
      uPx: { value: 400 },
      uPersp: { value: 1 },
    };

    // A spiral galaxy (3 arms); the delay makes inner nodes arrive first.
    const place = (r: number, spread: number) => {
      const arm = Math.floor(rand() * 3);
      const a = (arm * TAU) / 3 + r * 0.75 + (rand() - 0.5) * spread;
      return { r, a, y: (rand() - 0.5) * (0.25 + r * 0.12), delay: (r / R_MAX) * 0.4 };
    };
    const fillConverge = (g: BufferGeometry, pts: { r: number; a: number; y: number; delay: number }[]) => {
      g.setAttribute("position", new BufferAttribute(new Float32Array(pts.length * 3), 3));
      g.setAttribute("aR", new BufferAttribute(Float32Array.from(pts, (p) => p.r), 1));
      g.setAttribute("aA", new BufferAttribute(Float32Array.from(pts, (p) => p.a), 1));
      g.setAttribute("aY", new BufferAttribute(Float32Array.from(pts, (p) => p.y), 1));
      g.setAttribute("aDelay", new BufferAttribute(Float32Array.from(pts, (p) => p.delay), 1));
    };

    const dustPts = Array.from({ length: DUST.high }, () => place(0.4 + Math.pow(rand(), 0.8) * (R_MAX - 0.4), 0.9));
    fillConverge(this.dust, dustPts);
    this.dust.setAttribute("aSize", new BufferAttribute(Float32Array.from(dustPts, () => 0.035 + rand() * 0.05), 1));
    this.dust.setAttribute("aColor", new BufferAttribute(new Float32Array(dustPts.length * 3), 3));
    this.dustTint = Float32Array.from(dustPts, () => rand());

    const nodePts = ents.map(() => place(1.6 + rand() * (R_MAX - 2.2), 0.5));
    fillConverge(this.nodes, nodePts);
    this.nodes.setAttribute("aSize", new BufferAttribute(Float32Array.from(ents, (e) => e.size), 1));
    this.nodes.setAttribute("aColor", new BufferAttribute(new Float32Array(ents.length * 3), 3));

    // Links: each node to its 2 nearest neighbours, plus a spoke from every node to the centre.
    const xyz = nodePts.map((p) => [Math.cos(p.a) * p.r, p.y, Math.sin(p.a) * p.r]);
    const linkPts: typeof nodePts = [];
    const spoke: number[] = [];
    const pushSeg = (a: (typeof nodePts)[number], b: (typeof nodePts)[number], s: number) => {
      linkPts.push(a, b);
      spoke.push(s, s);
    };
    const done = new Set<string>();
    xyz.forEach((p, i) => {
      const near = xyz
        .map((q, j) => ({ j, d: (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2 }))
        .filter((x) => x.j !== i)
        .sort((x, y) => x.d - y.d)
        .slice(0, 2);
      for (const { j } of near) {
        const key = i < j ? `${i}-${j}` : `${j}-${i}`;
        if (done.has(key)) continue;
        done.add(key);
        pushSeg(nodePts[i], nodePts[j], 0);
      }
      pushSeg(nodePts[i], { r: 0, a: 0, y: 0, delay: 0 }, 1);
    });
    fillConverge(this.lines, linkPts);
    this.lines.setAttribute("aSpoke", new BufferAttribute(Float32Array.from(spoke), 1));

    // Beam ribbon: 48 segments along, two sides.
    const segs = 48;
    const aS: number[] = [];
    const aSide: number[] = [];
    const index: number[] = [];
    for (let i = 0; i <= segs; i++) {
      aS.push(i / segs, i / segs);
      aSide.push(-1, 1);
      if (i < segs) index.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    this.beamGeo.setAttribute("position", new BufferAttribute(new Float32Array(aS.length * 3), 3));
    this.beamGeo.setAttribute("aS", new BufferAttribute(Float32Array.from(aS), 1));
    this.beamGeo.setAttribute("aSide", new BufferAttribute(Float32Array.from(aSide), 1));
    this.beamGeo.setIndex(index);

    const blending = light ? NormalBlending : AdditiveBlending;
    const glow = { transparent: true, depthWrite: false, blending };
    const U = this.U;
    this.mats = {
      dust: new ShaderMaterial({ uniforms: { ...U, uKeep: { value: 1 } }, vertexShader: NODES_VERT, fragmentShader: POINT_FRAG, ...glow }),
      nodes: new ShaderMaterial({ uniforms: { ...U, uKeep: { value: 0 } }, vertexShader: NODES_VERT, fragmentShader: POINT_FRAG, ...glow }),
      lines: new ShaderMaterial({
        uniforms: { ...U, uKeep: { value: 0 }, uColor: { value: new Color() } },
        vertexShader: LINES_VERT,
        fragmentShader: LINES_FRAG,
        ...glow,
      }),
      halo: new ShaderMaterial({
        uniforms: {
          uTime: U.uTime,
          uOpacity: U.uOpacity,
          uLight: U.uLight,
          uSize: { value: 4.2 },
          uGlow: { value: 0 },
          uRings: { value: 0 },
          uColor: { value: new Color() },
          uCore: { value: new Color() },
        },
        vertexShader: HALO_VERT,
        fragmentShader: HALO_FRAG,
        ...glow,
      }),
      beam: new ShaderMaterial({
        uniforms: {
          uTime: U.uTime,
          uOpacity: { value: 0 },
          uLight: U.uLight,
          uEnd: { value: new Vector3(3, -2, 6) },
          uGrow: { value: 0 },
          uColor: { value: new Color() },
          uCore: { value: new Color() },
        },
        vertexShader: BEAM_VERT,
        fragmentShader: BEAM_FRAG,
        ...glow,
      }),
      core: new ShaderMaterial({
        uniforms: { uColor: { value: new Color() }, uRim: { value: new Color() }, uOpacity: U.uOpacity },
        vertexShader: FRESNEL_VERT,
        fragmentShader: FRESNEL_FRAG,
        transparent: true,
      }),
    };
  }

  setQuality(q: "high" | "low") {
    this.dust.setDrawRange(0, DUST[q]);
  }

  setPalette(p: ScenePalette) {
    const light = isLight(p.bg);
    const c = (hex: string) => new Color(hex);
    const fg = c(p.fg);
    const ai = c(p.ai);
    const accent = c(p.accent);
    const tones: Record<Entity["color"], Color> = {
      skill: ai.clone().lerp(fg, light ? 0.15 : 0.35),
      exp: c(p.ok),
      ai,
      work: accent,
    };
    const nc = this.nodes.getAttribute("aColor") as BufferAttribute;
    this.kinds.forEach((k, i) => nc.setXYZ(i, tones[k].r, tones[k].g, tones[k].b));
    nc.needsUpdate = true;
    const dc = this.dust.getAttribute("aColor") as BufferAttribute;
    const tmp = new Color();
    const dim = c(p.muted);
    for (let i = 0; i < dc.count; i++) {
      const t = this.dustTint[i];
      tmp.copy(dim).lerp(ai, light ? 0.6 + 0.4 * t : 0.35 + 0.5 * t);
      if (t > 0.92) tmp.copy(accent);
      dc.setXYZ(i, tmp.r, tmp.g, tmp.b);
    }
    dc.needsUpdate = true;
    this.mats.lines.uniforms.uColor.value.copy(ai).lerp(fg, light ? 0 : 0.3);
    this.mats.halo.uniforms.uColor.value.copy(accent);
    this.mats.halo.uniforms.uCore.value.copy(fg).lerp(new Color(1, 1, 1), 0.5);
    this.mats.beam.uniforms.uColor.value.copy(accent);
    this.mats.beam.uniforms.uCore.value.copy(fg).lerp(new Color(1, 1, 1), 0.5);
    this.mats.core.uniforms.uColor.value.copy(light ? accent : fg.clone().lerp(new Color(1, 1, 1), 0.6));
    this.mats.core.uniforms.uRim.value.copy(accent).multiplyScalar(light ? 0.7 : 1);
  }

  frame(state: RootState, delta: number, f: ContactFrameInput, r: ContactRegistry) {
    const root = r.root;
    if (f.weight <= 0 || !root) return;
    const dt = Math.min(delta, 0.1);
    const time = state.clock.elapsedTime;
    this.pp = this.pp < 0 ? f.progress : damp(this.pp, f.progress, 4, dt);
    // Front-loaded: contact is the last section, so the page may stop scrolling early.
    const conv = smooth(0, 0.42, this.pp);
    const beam = smooth(0.32, 0.58, this.pp);
    const U = this.U;
    U.uTime.value = time;
    U.uConv.value = conv;
    U.uOpacity.value = f.weight;
    const halo = this.mats.halo.uniforms;
    halo.uGlow.value = 0.35 + 0.65 * conv;
    halo.uRings.value = smooth(0.7, 1, conv);
    halo.uSize.value = 2.6 + 2.2 * conv;
    if (r.core) {
      const pulse = 1 + 0.09 * Math.sin(time * 3.2) * conv;
      r.core.scale.setScalar((0.45 + 0.75 * conv) * pulse);
    }
    const b = this.mats.beam.uniforms;
    b.uGrow.value = beam;
    b.uOpacity.value = f.weight * smooth(0, 0.15, beam);
    // Beam target: just in front of the camera, toward the lower right of the screen.
    const cam = state.camera as RootState["camera"] & { fov?: number; aspect?: number };
    if ("fov" in cam && cam.fov) {
      const depth = 3;
      const hh = depth * Math.tan((cam.fov * Math.PI) / 360);
      this.v.set(1.15 * hh * (cam.aspect ?? 1), -1.15 * hh, -depth).applyMatrix4(cam.matrixWorld);
    } else this.v.set(4, -2.5, 6);
    root.updateWorldMatrix(true, false);
    root.worldToLocal(this.v);
    b.uEnd.value.copy(this.v);

    this.ry = damp(this.ry, f.pointer.x * 0.25, 2.2, dt);
    this.rx = damp(this.rx, -f.pointer.y * 0.12, 2.2, dt);
    root.rotation.set(this.rx, this.ry, 0);
    const sc = f.scale * (0.88 + 0.12 * f.weight);
    root.scale.setScalar(sc);
    pointScale(state.camera, state.size.height, state.viewport.dpr, sc, U as { uPx: { value: number }; uPersp: { value: number } });
    state.invalidate();
  }

  dispose() {
    for (const g of [this.dust, this.nodes, this.lines, this.quad, this.beamGeo, this.sphere]) g.dispose();
    for (const m of Object.values(this.mats)) m.dispose();
  }
}
