// AI scene GPU side: the whole system in four instanced draw calls (halos, then the three below).
// 1. panels:  flat shapes oriented in 3D (glass chat window / answer card / store platters /
//             agent plate / tool-cube faces, text bars, waveform bars, model rings), drawn as
//             signed-distance shapes in the fragment shader
// 2. links:   camera-facing ribbons (the conduits between stages, synapses inside the model
//             core, the agent's spokes to its tools, retrieval query lines)
// 3. sprites: camera-facing glows (neurons, embedding points, tokens, halos, orbs)
// Every static instance belongs to a slot (one stage object) and is stored in that slot's
// local space; the vertex shaders place it with the slot's live transform from small
// uniform arrays (position, scale, yaw, presence, activity, phase), so a morph between
// projects or a stage's animation costs a few uniforms per frame, not buffer uploads.
// Only the conduits and the travelling tokens are written by the CPU each frame.
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  NormalBlending,
  ShaderMaterial,
  Vector3,
  type IUniform,
} from "three";
import { MAX_RINGS, MAX_SLOTS } from "./layout";

export const MAX_COND = 8;
export const SEG = 22;
export const MAX_TOK = 20;

/** Panel shapes (aK.x). */
export const SHAPE = { card: 0, bubble: 1, pill: 2, ring: 3, disc: 4, hex: 5, face: 6 } as const;
/** Panel roles (aK.y): what animates it. */
export const ROLE = { none: 0, text: 1, tool: 2, ring: 3, wave: 4, body: 5 } as const;
/** Link kinds (aK.x). */
export const LINK = { conduit: 0, synapse: 1, spoke: 2, query: 3, line: 4 } as const;
/** Sprite kinds (aK.x). */
export const SPRITE = { neuron: 0, embed: 1, token: 2, halo: 3, orb: 4, ringNode: 5 } as const;

const COMMON = /* glsl */ `
#define SLOTS ${MAX_SLOTS}
uniform vec4 uSlot[SLOTS];   // live centre (layout units) + scale
uniform vec4 uSlotB[SLOTS];  // yaw, presence, activity, phase (0..1 through its stage)
uniform vec4 uVar[SLOTS];    // input weights (chat, code, voice), model rings
uniform float uTime;
uniform float uOpacity;
uniform float uLight;
uniform float uScale;        // world units per layout unit (camera-facing widths)
uniform float uClear;        // 0..1 the finished request fades before the next one
vec3 rotY(float a, vec3 p) {
  float c = cos(a);
  float s = sin(a);
  return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
}
int slotOf(float g) { return int(g + 0.5); }
vec3 toRoot(float g, vec3 p) {
  if (g < -0.5) return p;
  int i = slotOf(g);
  return uSlot[i].xyz + rotY(uSlotB[i].x, p * uSlot[i].w);
}
vec4 slotB(float g) { return g < -0.5 ? vec4(0.0, 1.0, 0.0, 0.0) : uSlotB[slotOf(g)]; }
float slotScale(float g) { return g < -0.5 ? 1.0 : uSlot[slotOf(g)].w; }
float hash(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
`;

// ---------- panels ----------

const PANEL_VERT = /* glsl */ `
${COMMON}
attribute vec3 aPos;
attribute vec3 aU;
attribute vec3 aV;
attribute vec3 aColor;
attribute float aAlpha;
attribute float aGroup;
attribute vec3 aK;
attribute vec2 aP;
uniform float uPad;
uniform vec3 uAccent;
varying vec2 vP;
varying vec2 vH;
varying vec3 vColor;
varying float vA;
varying float vShape;
varying float vGlow;
void main() {
  vec4 B = slotB(aGroup);
  vec3 color = aColor;
  vec4 Va = aGroup < -0.5 ? vec4(1.0) : uVar[slotOf(aGroup)];
  float role = aK.y;
  float variant = aK.z;
  float a = aAlpha * B.y;
  if (variant > 0.5) a *= variant < 1.5 ? Va.x : (variant < 2.5 ? Va.y : Va.z);
  vec3 U = aU;
  vec3 W = aV;
  vec3 P = aPos;
  float glow = 0.0;
  if (role > 0.5 && role < 1.5) {
    // Text bar, typed / assembled left to right with its stage's phase.
    float r = clamp((B.w - aP.x) / aP.y, 0.0, 1.0);
    float e = r * r * (3.0 - 2.0 * r);
    P -= U * (1.0 - e);
    U *= max(e, 0.001);
    a *= step(0.001, r) * (1.0 - uClear);
    glow = (1.0 - e) * step(0.001, r);
  } else if (role > 1.5 && role < 2.5) {
    // Tool module aP.x: lights while the planner calls it.
    float k = B.w * 5.0 - 0.6 - aP.x;
    glow = B.z * exp(-k * k * 6.0);
    color = mix(aColor, uAccent, glow);
  } else if (role > 2.5 && role < 3.5) {
    // Model ring aP.x: one per model provider.
    a *= clamp(Va.w - aP.x, 0.0, 1.0);
    glow = B.z * 0.7;
  } else if (role > 3.5 && role < 4.5) {
    // Waveform bar: its height follows the voice.
    float amp = abs(sin(uTime * 6.0 + aP.x * 1.9) * sin(uTime * 2.3 + aP.x * 0.7));
    W *= 0.2 + 0.8 * (0.3 + 0.7 * B.z) * amp;
  } else if (role > 4.5) {
    glow = B.z;
  }
  vec2 h = vec2(length(U), length(W));
  vec2 k = (h + uPad) / max(h, vec2(1e-4));
  vec3 local = P + U * position.x * k.x + W * position.y * k.y;
  vP = position.xy * (h + uPad);
  vH = h;
  vColor = color;
  vA = a * uOpacity;
  vShape = aK.x;
  vGlow = glow;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(toRoot(aGroup, local), 1.0);
}
`;

const PANEL_FRAG = /* glsl */ `
uniform float uLight;
uniform float uPad;
uniform vec3 uBg;
uniform vec3 uFg;
varying vec2 vP;
varying vec2 vH;
varying vec3 vColor;
varying float vA;
varying float vShape;
varying float vGlow;
float sdBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
float sdTri(vec2 p, vec2 p0, vec2 p1, vec2 p2) {
  vec2 e0 = p1 - p0;
  vec2 e1 = p2 - p1;
  vec2 e2 = p0 - p2;
  vec2 v0 = p - p0;
  vec2 v1 = p - p1;
  vec2 v2 = p - p2;
  vec2 pq0 = v0 - e0 * clamp(dot(v0, e0) / dot(e0, e0), 0.0, 1.0);
  vec2 pq1 = v1 - e1 * clamp(dot(v1, e1) / dot(e1, e1), 0.0, 1.0);
  vec2 pq2 = v2 - e2 * clamp(dot(v2, e2) / dot(e2, e2), 0.0, 1.0);
  float s = sign(e0.x * e2.y - e0.y * e2.x);
  vec2 d = min(min(vec2(dot(pq0, pq0), s * (v0.x * e0.y - v0.y * e0.x)), vec2(dot(pq1, pq1), s * (v1.x * e1.y - v1.y * e1.x))), vec2(dot(pq2, pq2), s * (v2.x * e2.y - v2.y * e2.x)));
  return -sqrt(d.x) * sign(d.y);
}
float sdHex(vec2 p, float r) {
  const vec3 k = vec3(-0.866025404, 0.5, 0.577350269);
  p = abs(p);
  p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
  p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
  return length(p) * sign(p.y);
}
void main() {
  if (vA < 0.004) discard;
  float s = vShape;
  vec2 h = vH;
  float m = min(h.x, h.y);
  float d;
  float glass = 1.0;
  float inner = 0.0;
  if (s < 0.5) {
    d = sdBox(vP, h, min(0.16, m));
    // A header line across the top of a card.
    inner = 1.0 - smoothstep(0.0, fwidth(vP.y) * 1.5, abs(vP.y - (h.y - 0.3)) - 0.004);
    inner *= step(abs(vP.x), h.x - 0.02);
  } else if (s < 1.5) {
    // Chat bubble: rounded box with a tail at the lower left.
    d = sdBox(vP, h, 0.2);
    float tail = sdTri(vP, vec2(-0.62 * h.x, -h.y + 0.04), vec2(-0.3 * h.x, -h.y + 0.04), vec2(-0.74 * h.x, -h.y - 0.24));
    d = min(d, tail);
  } else if (s < 2.5) {
    d = sdBox(vP, h, m);
    glass = 0.0;
  } else if (s < 3.5) {
    d = abs(length(vP / h) - 1.0) * m - 0.012;
    glass = 0.0;
  } else if (s < 4.5) {
    float r = length(vP / h);
    d = (r - 1.0) * m;
    // Platter detail: an inner track.
    inner = 1.0 - smoothstep(0.0, fwidth(r) * 1.5, abs(r - 0.6) - 0.01);
  } else if (s < 5.5) {
    d = sdHex(vP, m * 0.9);
  } else {
    d = sdBox(vP, h, 0.035);
  }
  float w = fwidth(d);
  float body = 1.0 - smoothstep(-w, w, d);
  float rim = 1.0 - smoothstep(0.0, w * 1.5, abs(d) - 0.011);
  // Outer glow, gone before the quad's edge (no boxy halo).
  float od = clamp(max(d, 0.0) / uPad, 0.0, 1.0);
  float halo = (1.0 - od) * (1.0 - od) * exp(-od * 2.5) * (1.0 - body);
  float g = vGlow;
  vec3 col;
  float a;
  if (glass < 0.5) {
    // Solid strokes and bars.
    col = mix(vColor * (1.1 + 0.6 * g), mix(vColor, uFg, 0.15), uLight);
    a = body * mix(0.92, 0.9, uLight) + halo * mix(0.35 + 0.5 * g, 0.06, uLight);
  } else {
    // Glass: tinted fill, bright rim, soft outer glow (a contact shade on paper).
    vec3 fillD = mix(uBg, vColor, 0.05 + 0.06 * g);
    vec3 fillL = mix(vec3(1.0), vColor, 0.04 + 0.1 * g);
    float fa = body * mix(0.66 + 0.16 * g, 0.86, uLight);
    vec3 rimC = mix(vColor * (1.15 + 0.5 * g), mix(vColor, uFg, 0.3), uLight);
    col = mix(fillD, fillL, uLight);
    col = mix(col, rimC, max(rim, inner * 0.55));
    fa = max(fa, max(rim * 0.95, inner * body * 0.5));
    float oa = halo * mix(0.12 + 0.4 * g, 0.07, uLight);
    vec3 oc = mix(vColor, uFg, uLight);
    a = fa + oa * (1.0 - fa);
    col = (col * fa + oc * oa * (1.0 - fa)) / max(a, 1e-4);
  }
  gl_FragColor = vec4(col, clamp(a, 0.0, 1.0) * vA);
  #include <colorspace_fragment>
}
`;

// ---------- links ----------

const LINK_VERT = /* glsl */ `
${COMMON}
attribute vec3 aA;
attribute vec3 aB;
attribute float aGroup;
attribute vec3 aColor;
attribute float aAlpha;
attribute float aW;
attribute vec3 aK;
attribute vec2 aT;
uniform vec4 uCond[${MAX_COND}]; // head (0..1, < 0 none), stream (0/1), tone (0 query .. 1 answer), length
varying float vT;
varying float vU;
varying float vS;
varying float vA;
varying float vKind;
varying float vSeed;
varying float vAct;
varying float vPh;
varying vec3 vColor;
varying vec4 vC;
void main() {
  vec4 B = slotB(aGroup);
  vec3 A = toRoot(aGroup, aA);
  vec3 Bp = toRoot(aGroup, aB);
  vec4 a = modelViewMatrix * vec4(A, 1.0);
  vec4 b = modelViewMatrix * vec4(Bp, 1.0);
  vec2 dir = b.xy - a.xy;
  float l2 = length(dir);
  dir = l2 > 1e-5 ? dir / l2 : vec2(1.0, 0.0);
  vec2 side = vec2(-dir.y, dir.x);
  vec4 p = mix(a, b, position.x);
  p.xy += side * position.y * aW * uScale * slotScale(aGroup);
  vT = position.x;
  vU = position.y;
  vS = mix(aT.x, aT.y, position.x);
  vA = aAlpha * B.y * uOpacity;
  vKind = aK.x;
  vSeed = aK.y;
  vAct = B.z;
  vPh = B.w;
  vColor = aColor;
  vC = aK.x < 0.5 ? uCond[int(aK.y + 0.5)] : vec4(0.0);
  gl_Position = projectionMatrix * p;
}
`;

const LINK_FRAG = /* glsl */ `
uniform float uLight;
uniform float uTime;
uniform vec3 uAi;
uniform vec3 uAccent;
uniform vec3 uHot;
varying float vT;
varying float vU;
varying float vS;
varying float vA;
varying float vKind;
varying float vSeed;
varying float vAct;
varying float vPh;
varying vec3 vColor;
varying vec4 vC;
void main() {
  if (vA < 0.004) discard;
  float u = abs(vU);
  float w = fwidth(vU);
  float core = 1.0 - smoothstep(0.22, 0.22 + w * 2.0, u);
  float soft = exp(-u * u * 4.0);
  float a = core * mix(0.42, 0.6, uLight) + soft * mix(0.16, 0.04, uLight);
  vec3 col = vColor;
  float k = vKind;
  if (k < 0.5) {
    // Conduit: dashes drift toward the next stage; the request's head glows as it passes,
    // and while the model answers, a stream of tokens runs to the answer card.
    float len = vC.w;
    float s = vS * len;
    float dash = smoothstep(0.25, 0.5, fract(s * 2.6 - uTime * 0.9)) * (1.0 - smoothstep(0.5, 0.75, fract(s * 2.6 - uTime * 0.9)));
    a = a * 0.55 + core * dash * mix(0.22, 0.18, uLight);
    vec3 hotC = mix(mix(uAi, uHot, 0.35), uAccent, vC.z);
    float head = 0.0;
    if (vC.x > -0.5) {
      float dh = (vS - vC.x) * len;
      head = dh > 0.0 ? exp(-dh * dh * 30.0) : exp(dh * 2.4);
      head *= step(vS, vC.x + 0.25);
    }
    float stream = vC.y * smoothstep(0.55, 0.95, fract(s * 1.6 - uTime * 2.4));
    float hot = clamp(head + stream, 0.0, 1.0);
    a = max(a, (core * 0.9 + soft * 0.5) * hot);
    col = mix(col, hotC, hot);
  } else if (k < 1.5) {
    // Synapse: a signal fires along it while the model thinks.
    float p = fract(uTime * (0.45 + 0.4 * fract(vSeed * 7.13)) + vSeed);
    float sig = exp(-pow((vT - p) * 7.0, 2.0)) * vAct;
    float ends = smoothstep(0.0, 0.12, vT) * smoothstep(1.0, 0.88, vT);
    a = a * (0.32 + 0.4 * vAct) * ends + sig * core * 1.2;
    col = mix(col, uHot, sig);
  } else if (k < 2.5) {
    // Spoke to tool vSeed: the call runs out to the tool and back.
    float c = vPh * 5.0 - 0.6 - vSeed;
    float t = clamp(c + 0.5, 0.0, 1.0);
    float pos = t < 0.5 ? t * 2.0 : 2.0 - t * 2.0;
    float on = step(-0.5, c) * step(c, 0.5) * vAct;
    float sig = exp(-pow((vT - pos) * 6.0, 2.0)) * on;
    a = a * (0.45 + 0.9 * on) + sig * 1.1;
    col = mix(col, uAccent, max(sig, on * 0.35));
  } else if (k < 3.5) {
    // Retrieval: the query reaches out to its nearest matches, drawn from the query.
    float reach = smoothstep(0.28 + 0.07 * vSeed, 0.44 + 0.07 * vSeed, vPh) * (1.0 - smoothstep(0.84, 0.97, vPh));
    float drawn = step(vT, reach * 1.02);
    a = (core * 0.9 + soft * 0.35) * drawn * reach * step(0.001, vAct);
    col = uAccent;
  }
  if (uLight < 0.5) gl_FragColor = vec4(col, clamp(a, 0.0, 1.0) * vA);
  else gl_FragColor = vec4(col, clamp(a * 1.1, 0.0, 1.0) * vA);
  #include <colorspace_fragment>
}
`;

// ---------- sprites ----------

const SPRITE_VERT = /* glsl */ `
${COMMON}
attribute vec3 aPos;
attribute float aGroup;
attribute float aSize;
attribute vec3 aColor;
attribute float aAlpha;
attribute vec3 aK;
uniform vec3 uRingU[${MAX_RINGS}];
uniform vec3 uRingV[${MAX_RINGS}];
uniform vec3 uAccent;
uniform vec3 uOk;
uniform vec3 uHot;
varying vec2 vUv;
varying vec3 vColor;
varying float vA;
varying float vCore;
void main() {
  vec4 B = slotB(aGroup);
  vec4 Va = aGroup < -0.5 ? vec4(0.0) : uVar[slotOf(aGroup)];
  float kind = aK.x;
  vec3 local = aPos;
  float a = aAlpha * B.y;
  float size = aSize;
  vec3 col = aColor;
  float core = 0.55;
  if (kind < 0.5) {
    // Neuron: while the model thinks, waves run out from its centre and neurons spark.
    float act = B.z;
    float r = length(local);
    float f = fract(uTime * 0.8);
    float f2 = fract(uTime * 0.8 + 0.5);
    float wave = exp(-pow((r - f * 1.2) * 6.0, 2.0)) * (1.0 - f) + exp(-pow((r - f2 * 1.2) * 6.0, 2.0)) * (1.0 - f2);
    float slot = uTime * 2.4 + aK.y * 13.7;
    float spark = step(0.86, hash(floor(slot) + aK.y * 7.7)) * exp(-fract(slot) * 4.0);
    float e = clamp(act * (wave * 1.3 + spark) + 0.18 * spark, 0.0, 1.0);
    local *= 1.0 + 0.025 * sin(uTime * 1.3 + r * 2.0);
    col = mix(aColor, uHot, e);
    a *= 0.5 + 0.35 * act + e * 0.9;
    size *= 1.0 + e * 0.8;
  } else if (kind < 1.5) {
    float rank = aK.y;
    float ph = B.w;
    float on = step(0.001, B.z);
    if (rank > -0.5) {
      // One of the nearest matches: it lights when the query reaches it, then leaves as context.
      float lit = smoothstep(0.34 + 0.07 * rank, 0.46 + 0.07 * rank, ph) * (1.0 - smoothstep(0.86, 0.98, ph)) * on;
      col = mix(aColor, uAccent, lit);
      a *= 0.55 + lit * 1.2;
      size *= 1.0 + lit * 1.4;
      core = 0.55 + 0.4 * lit;
    } else if (rank < -1.5) {
      // The query: drops into the store, holds while it is compared, then leaves.
      float show = smoothstep(0.04, 0.16, ph) * (1.0 - smoothstep(0.82, 0.95, ph)) * on;
      local.y += (1.0 - smoothstep(0.04, 0.3, ph)) * 0.55;
      a *= show;
      col = uAccent;
      core = 0.95;
    } else {
      a *= 0.5 + 0.3 * B.z * (0.5 + 0.5 * sin(uTime * 3.0 + aPos.x * 9.0 + aPos.z * 7.0));
    }
  } else if (kind < 2.5) {
    core = 0.95;
  } else if (kind < 3.5) {
    a *= 0.22 + 0.78 * B.z;
    size *= 0.9 + 0.22 * B.z;
    core = 0.0;
  } else if (kind < 4.5) {
    if (aK.y > 0.5) {
      // The answer's "done" mark.
      a *= smoothstep(0.96, 1.0, B.w) * (1.0 - uClear);
      col = uOk;
      size *= 1.0 + 0.15 * sin(uTime * 5.0);
    } else {
      a *= 0.65 + 0.5 * B.z;
      size *= 1.0 + 0.18 * B.z * sin(uTime * 6.0);
    }
    core = 0.85;
  } else {
    // A model provider riding its ring.
    int r = int(aK.y + 0.5);
    float ang = uTime * (0.5 + 0.17 * aK.y) + aK.y * 2.1;
    local = uRingU[r] * cos(ang) + uRingV[r] * sin(ang);
    a *= clamp(Va.w - aK.y, 0.0, 1.0) * (0.8 + 0.4 * B.z);
    core = 0.9;
  }
  vec4 mv = modelViewMatrix * vec4(toRoot(aGroup, local), 1.0);
  mv.xy += position.xy * size * uScale * slotScale(aGroup);
  vUv = position.xy * 2.0;
  vColor = col;
  vA = a * uOpacity;
  vCore = core;
  gl_Position = projectionMatrix * mv;
}
`;

const SPRITE_FRAG = /* glsl */ `
uniform float uLight;
varying vec2 vUv;
varying vec3 vColor;
varying float vA;
varying float vCore;
void main() {
  float r2 = dot(vUv, vUv);
  if (r2 > 1.0 || vA < 0.004) discard;
  float core = exp(-r2 * 16.0) * vCore;
  float halo = exp(-r2 * 3.5) * (1.0 - r2);
  if (uLight < 0.5) {
    vec3 col = mix(vColor, vec3(1.0), core * 0.6);
    gl_FragColor = vec4(col, clamp((core * 1.3 + halo * 0.55) * vA, 0.0, 1.0));
  } else {
    float body = 1.0 - smoothstep(0.16, 0.24, r2);
    float a = max(body * vCore * 1.1, halo * mix(0.07, 0.18, step(0.01, vCore)) + core * 0.8);
    gl_FragColor = vec4(vColor, clamp(a * vA, 0.0, 1.0));
  }
  #include <colorspace_fragment>
}
`;

// ---------- buffers ----------

type Spec = Record<string, number>;
/** A growable list of instances over one quad: attributes are pushed once, then uploaded. */
export class Instances<S extends Spec> {
  readonly geometry: InstancedBufferGeometry;
  readonly attr: { [K in keyof S]: InstancedBufferAttribute };
  readonly arr: { [K in keyof S]: Float32Array };
  count = 0;
  constructor(
    readonly capacity: number,
    spec: S,
    quad: [number, number, number, number],
  ) {
    const g = new InstancedBufferGeometry();
    const [x0, x1, y0, y1] = quad;
    g.setAttribute("position", new Float32BufferAttribute([x0, y0, 0, x1, y0, 0, x1, y1, 0, x0, y1, 0], 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    const attr = {} as { [K in keyof S]: InstancedBufferAttribute };
    const arr = {} as { [K in keyof S]: Float32Array };
    for (const k of Object.keys(spec) as (keyof S & string)[]) {
      const a = new InstancedBufferAttribute(new Float32Array(capacity * spec[k]), spec[k]);
      a.setUsage(DynamicDrawUsage);
      g.setAttribute(k, a);
      attr[k] = a;
      arr[k] = a.array as Float32Array;
    }
    g.instanceCount = 0;
    this.geometry = g;
    this.attr = attr;
    this.arr = arr;
  }
  /** Append one instance (missing attributes stay 0); returns its index. */
  push(values: { [K in keyof S]?: number | readonly number[] }): number {
    const i = this.count++;
    for (const k of Object.keys(values) as (keyof S & string)[]) {
      const v = values[k];
      const a = this.arr[k];
      const n = this.attr[k].itemSize;
      if (typeof v === "number") a[i * n] = v;
      else if (v) for (let j = 0; j < n; j++) a[i * n + j] = v[j] ?? 0;
    }
    return i;
  }
  /** Reserve n instances (written later, e.g. per frame). */
  reserve(n: number): number {
    const i = this.count;
    this.count += n;
    return i;
  }
  uploadAll() {
    for (const a of Object.values(this.attr)) a.needsUpdate = true;
  }
  /** Mark instances [from, from + n) of one attribute for upload. */
  touch(name: keyof S, from: number, n: number) {
    const a = this.attr[name];
    a.clearUpdateRanges();
    a.addUpdateRange(from * a.itemSize, n * a.itemSize);
    a.needsUpdate = true;
  }
}

export const PANEL_SPEC = { aPos: 3, aU: 3, aV: 3, aColor: 3, aAlpha: 1, aGroup: 1, aK: 3, aP: 2 };
export const LINK_SPEC = { aA: 3, aB: 3, aGroup: 1, aColor: 3, aAlpha: 1, aW: 1, aK: 3, aT: 2 };
export const SPRITE_SPEC = { aPos: 3, aGroup: 1, aSize: 1, aColor: 3, aAlpha: 1, aK: 3 };

export type AiUniforms = ReturnType<typeof makeUniforms>;
export function makeUniforms() {
  return {
    uSlot: { value: new Float32Array(MAX_SLOTS * 4) },
    uSlotB: { value: new Float32Array(MAX_SLOTS * 4) },
    uVar: { value: new Float32Array(MAX_SLOTS * 4) },
    uCond: { value: new Float32Array(MAX_COND * 4) },
    uRingU: { value: Array.from({ length: MAX_RINGS }, () => new Vector3()) },
    uRingV: { value: Array.from({ length: MAX_RINGS }, () => new Vector3()) },
    uTime: { value: 0 },
    uOpacity: { value: 0 },
    uLight: { value: 0 },
    uScale: { value: 1 },
    uClear: { value: 0 },
    uPad: { value: 0.2 },
    uBg: { value: new Color() },
    uFg: { value: new Color() },
    uAi: { value: new Color() },
    uAccent: { value: new Color() },
    uOk: { value: new Color() },
    uHot: { value: new Color() },
  } satisfies Record<string, IUniform>;
}

export function createGl(cap: { panels: number; links: number; sprites: number; glows: number }) {
  const U = makeUniforms();
  const panels = new Instances(cap.panels, PANEL_SPEC, [-1, 1, -1, 1]);
  const links = new Instances(cap.links, LINK_SPEC, [0, 1, -1, 1]);
  const sprites = new Instances(cap.sprites, SPRITE_SPEC, [-0.5, 0.5, -0.5, 0.5]);
  // The stages' soft halos: drawn first, under the glass (the sprite shader, its own few instances).
  const glows = new Instances(cap.glows, SPRITE_SPEC, [-0.5, 0.5, -0.5, 0.5]);
  const mat = (vertexShader: string, fragmentShader: string, side = DoubleSide) =>
    new ShaderMaterial({ uniforms: U, vertexShader, fragmentShader, transparent: true, depthWrite: false, depthTest: false, side });
  const panelMat = mat(PANEL_VERT, PANEL_FRAG);
  const linkMat = mat(LINK_VERT, LINK_FRAG);
  const spriteMat = mat(SPRITE_VERT, SPRITE_FRAG);
  return {
    U,
    panels,
    links,
    sprites,
    glows,
    panelMat,
    linkMat,
    spriteMat,
    setLight(light: boolean) {
      U.uLight.value = light ? 1 : 0;
      // Glows add up on dark; on paper everything is ink with normal blending.
      const blending = light ? NormalBlending : AdditiveBlending;
      for (const m of [linkMat, spriteMat]) {
        if (m.blending !== blending) {
          m.blending = blending;
          m.needsUpdate = true;
        }
      }
    },
    dispose() {
      for (const g of [panels.geometry, links.geometry, sprites.geometry, glows.geometry] as BufferGeometry[]) g.dispose();
      for (const m of [panelMat, linkMat, spriteMat]) m.dispose();
    },
  };
}
export type Gl = ReturnType<typeof createGl>;
