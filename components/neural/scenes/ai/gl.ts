// AI scene GPU side: the whole system in four instanced draw calls (halos, then the three below).
// 1. panels:  flat shapes oriented in 3D (glass chat window / answer card / agent plate /
//             tool-cube faces, text bars, waveform bars, model rings), drawn as
//             signed-distance shapes in the fragment shader, in the Work slabs' glass language
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
export const MAX_TOK = 24;
/** The arrival pulse: one ring sprite right after the tokens; then two joint dots per conduit. */
export const PULSE = MAX_TOK;
export const PORTS = MAX_TOK + 1;
/** Sprites written per frame (tokens, pulse, joints). */
export const DYN = PORTS + 2 * MAX_COND;

/** Panel shapes (aK.x). */
export const SHAPE = { card: 0, bubble: 1, pill: 2, ring: 3, hex: 5, face: 6 } as const;
/** Panel roles (aK.y): what animates it. */
export const ROLE = { none: 0, text: 1, tool: 2, ring: 3, wave: 4, body: 5 } as const;
/** Link kinds (aK.x). */
export const LINK = { conduit: 0, synapse: 1, spoke: 2, query: 3, line: 4 } as const;
/** Sprite kinds (aK.x). */
export const SPRITE = { neuron: 0, embed: 1, token: 2, halo: 3, orb: 4, ringNode: 5, pulse: 6 } as const;
/**
 * Variant gate (panels aK.z, sprites aK.z): 0 always; 1 / 2 / 3 while the project's input
 * is chat / code / voice; 4 unless it is code. The output object reads the same weights
 * (a code system answers with an edit, the others with an answer).
 */
export const VAR = { all: 0, chat: 1, code: 2, voice: 3, notCode: 4 } as const;

// Shader notes (kept out of the GLSL strings, which ship as written):
// - uSlot / uSlotB / uVar: per slot live centre + scale; yaw, presence, activity, phase
//   (0..1 through its stage); input weights (chat, code, voice) and model rings.
//   uLow: low tier (denser-looking core); uScale: world units per layout unit;
//   uClear: the finished request fading before the next one.
// - panels by role: text bars type in left to right with their stage's phase; a tool box
//   lights while the planner calls it (orange); model rings show one per provider;
//   waveform bars follow the voice; bodies glow with their stage's activity. A tool-box
//   face seen edge-on fades (no hairlines). Shapes are signed distances: card (header
//   line), chat bubble (tail lower left), pill, ring, hex, box face.
// - links: conduit dashes drift toward the next stage, the request leaves a lit wake,
//   the answer streams as tokens; synapses fire (faintly at rest); a spoke carries the
//   call out to its tool and back; query lines reach from the query to its matches.
// - sprites: neurons wave from the centre and spark while the model thinks (a slow wave at
//   rest); a match lights when the query reaches it; the query drops into the store and
//   holds; halos follow their stage (k1 = 1: the model's breathing inner glow, 2: only
//   while active); the answer's done mark; a provider rides its ring; the pulse is a ring.
const COMMON = /* glsl */ `
#define SLOTS ${MAX_SLOTS}
uniform vec4 uSlot[SLOTS];
uniform vec4 uSlotB[SLOTS];
uniform vec4 uVar[SLOTS];
uniform float uTime;
uniform float uLow;
uniform float uOpacity;
uniform float uLight;
uniform float uScale;
uniform float uClear;
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
float gate(float v, vec4 Va) {
  if (v < 0.5) return 1.0;
  return v < 1.5 ? Va.x : (v < 2.5 ? Va.y : (v < 3.5 ? Va.z : 1.0 - Va.y));
}
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
varying float vNeutral;
void main() {
  vec4 B = slotB(aGroup);
  vec3 color = aColor;
  vec4 Va = aGroup < -0.5 ? vec4(1.0) : uVar[slotOf(aGroup)];
  float role = aK.y;
  float variant = aK.z;
  float a = aAlpha * B.y;
  a *= gate(variant, Va);
  vec3 U = aU;
  vec3 W = aV;
  vec3 P = aPos;
  float glow = 0.0;
  if (role > 0.5 && role < 1.5) {
    float r = clamp((B.w - aP.x) / aP.y, 0.0, 1.0);
    float e = r * r * (3.0 - 2.0 * r);
    P -= U * (1.0 - e);
    U *= max(e, 0.001);
    a *= step(0.001, r) * (1.0 - uClear);
    glow = (1.0 - e) * step(0.001, r);
  } else if (role > 1.5 && role < 2.5) {
    float k = B.w * 5.0 - 0.6 - aP.x;
    glow = B.z * exp(-k * k * 6.0);
    color = mix(aColor, uAccent, glow);
  } else if (role > 2.5 && role < 3.5) {
    a *= clamp(Va.w - aP.x, 0.0, 1.0);
    glow = B.z * 0.7;
  } else if (role > 3.5 && role < 4.5) {
    float amp = abs(sin(uTime * 6.0 + aP.x * 1.9) * sin(uTime * 2.3 + aP.x * 0.7));
    W *= 0.2 + 0.8 * (0.3 + 0.7 * B.z) * amp;
  } else if (role > 4.5) {
    glow = B.z;
  }
  if (aK.x > 5.5) {
    vec3 n = normalize(normalMatrix * rotY(B.x, normalize(cross(aU, aV))));
    vec4 c = modelViewMatrix * vec4(toRoot(aGroup, aPos), 1.0);
    a *= smoothstep(0.14, 0.34, abs(dot(n, normalize(-c.xyz))));
  }
  vNeutral = role > 4.5 ? aP.x : 0.0;
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
varying float vNeutral;
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
    inner = 1.0 - smoothstep(0.0, fwidth(vP.y) * 1.5, abs(vP.y - (h.y - 0.3)) - 0.003);
    inner *= step(abs(vP.x), h.x - 0.02);
  } else if (s < 1.5) {
    d = sdBox(vP, h, 0.2);
    float tail = sdTri(vP, vec2(-0.62 * h.x, -h.y + 0.04), vec2(-0.3 * h.x, -h.y + 0.04), vec2(-0.74 * h.x, -h.y - 0.24));
    d = min(d, tail);
  } else if (s < 2.5) {
    d = sdBox(vP, h, m);
    glass = 0.0;
  } else if (s < 3.5) {
    d = abs(length(vP / h) - 1.0) * m;
    glass = 0.0;
  } else if (s < 5.5) {
    d = sdHex(vP, m * 0.9);
  } else {
    d = sdBox(vP, h, 0.035);
  }
  float w = fwidth(d);
  float body = 1.0 - smoothstep(-w, w, d);
  float lw = w * mix(0.5, 0.75, uLight);
  float rim = 1.0 - smoothstep(lw, lw + w, abs(d));
  float od = clamp(max(d, 0.0) / uPad, 0.0, 1.0);
  float halo = (1.0 - od) * (1.0 - od) * exp(-od * 2.5) * (1.0 - body);
  float g = vGlow;
  vec3 tint = mix(vColor, mix(mix(uFg, uBg, 0.5), vColor, g), vNeutral);
  vec3 col;
  float a;
  if (glass < 0.5) {
    col = mix(tint * (1.05 + 0.6 * g), mix(tint, uFg, 0.2), uLight);
    a = max(body, rim) * mix(0.8, 0.5 + 0.3 * g, uLight) + halo * mix(0.28 + 0.5 * g, 0.04, uLight);
  } else {
    float inGlow = body * exp(max(d, -1.0) * 18.0);
    vec3 fillD = mix(uBg, tint, 0.1 + 0.08 * g);
    vec3 fillL = mix(vec3(1.0), tint, 0.04 + 0.08 * g);
    float fa = body * mix(0.34 + 0.14 * g, 0.78, uLight);
    vec3 rimC = mix(tint * (1.2 + 0.5 * g), mix(tint, uFg, 0.35), uLight);
    float e = max(rim, max(inGlow * mix(0.5, 0.12, uLight), inner * 0.5));
    col = mix(mix(fillD, fillL, uLight), rimC, e);
    fa = max(fa, max(rim * mix(0.95, 0.7, uLight), max(inGlow * mix(0.45, 0.1, uLight), inner * body * 0.45)));
    float oa = halo * mix(0.14 + 0.4 * g, 0.05, uLight);
    if (uLight > 0.5 && s < 1.5) {
      float ds = sdBox(vP + vec2(0.0, 0.07), h, s < 0.5 ? min(0.16, m) : 0.2);
      oa = max(oa, (1.0 - smoothstep(-0.05, 0.17, ds)) * 0.12 * (1.0 - body));
    }
    vec3 oc = mix(tint, uFg, uLight);
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
uniform vec4 uCond[${MAX_COND}];
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
    float len = vC.w;
    float s = vS * len;
    float ph = fract(s * 2.6 - uTime * 0.9);
    float dash = smoothstep(0.25, 0.5, ph) * (1.0 - smoothstep(0.5, 0.75, ph));
    vec3 hotC = mix(mix(uAi, uHot, 0.35), uAccent, vC.z);
    float head = 0.0;
    if (vC.x > -0.5) {
      float dh = (vS - vC.x) * len;
      head = dh > 0.0 ? exp(-dh * dh * 30.0) : 0.25 + 0.75 * exp(dh * 1.4);
      head *= step(vS, vC.x + 0.25);
    }
    float stream = vC.y * (0.35 + 0.65 * smoothstep(0.55, 0.95, fract(s * 1.6 - uTime * 2.4)));
    float hot = clamp(head + stream, 0.0, 1.0);
    float cw = mix(0.16, 0.42, hot);
    float line = 1.0 - smoothstep(cw, cw + w * 2.0, u);
    a = line * mix(0.36, 0.62, uLight) + soft * mix(0.06, 0.03, uLight) + line * dash * mix(0.2, 0.16, uLight);
    a = max(a, (line * 0.95 + soft * 0.45) * hot);
    col = mix(col, hotC, hot);
  } else if (k < 1.5) {
    float p = fract(uTime * (0.45 + 0.4 * fract(vSeed * 7.13)) + vSeed);
    float sig = exp(-pow((vT - p) * 7.0, 2.0)) * (0.22 + 0.78 * vAct);
    float ends = smoothstep(0.0, 0.12, vT) * smoothstep(1.0, 0.88, vT);
    a = a * (0.32 + 0.4 * vAct) * mix(1.0, 1.7, uLight) * ends + sig * core * 1.2;
    col = mix(col, uHot, sig);
  } else if (k < 2.5) {
    float c = vPh * 5.0 - 0.6 - vSeed;
    float t = clamp(c + 0.5, 0.0, 1.0);
    float pos = t < 0.5 ? t * 2.0 : 2.0 - t * 2.0;
    float on = step(-0.5, c) * step(c, 0.5) * vAct;
    float sig = exp(-pow((vT - pos) * 6.0, 2.0)) * on;
    a = a * (0.45 + 0.9 * on) + sig * 1.1;
    col = mix(col, uAccent, max(sig, on * 0.35));
  } else if (k < 3.5) {
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
  float a = aAlpha * B.y * gate(aK.z, Va);
  float size = aSize;
  vec3 col = aColor;
  float core = 0.55;
  if (kind < 0.5) {
    float act = B.z;
    float r = length(local);
    float f = fract(uTime * 0.8);
    float f2 = fract(uTime * 0.8 + 0.5);
    float wave = exp(-pow((r - f * 1.2) * 6.0, 2.0)) * (1.0 - f) + exp(-pow((r - f2 * 1.2) * 6.0, 2.0)) * (1.0 - f2);
    float fi = fract(uTime * 0.38);
    float idle = exp(-pow((r - fi * 1.1) * 5.0, 2.0)) * (1.0 - fi);
    float slot = uTime * 2.4 + aK.y * 13.7;
    float spark = step(0.86, hash(floor(slot) + aK.y * 7.7)) * exp(-fract(slot) * 4.0);
    float e = clamp(act * (wave * 1.3 + spark) + (1.0 - act) * 0.5 * idle + 0.18 * spark, 0.0, 1.0);
    local *= 1.0 + 0.025 * sin(uTime * 1.3 + r * 2.0);
    col = mix(aColor, uHot, e);
    a *= (0.45 + 0.3 * act + e * 0.8) * (1.0 + 0.12 * uLow) * (1.0 + 0.6 * uLight);
    size *= (1.0 + e * 0.7) * (1.0 + 0.12 * uLow);
  } else if (kind < 1.5) {
    float rank = aK.y;
    float ph = B.w;
    float on = step(0.001, B.z);
    if (rank > -0.5) {
      float lit = smoothstep(0.34 + 0.07 * rank, 0.46 + 0.07 * rank, ph) * (1.0 - smoothstep(0.86, 0.98, ph)) * on;
      col = mix(aColor, uAccent, lit);
      a *= 0.55 + lit * 1.2;
      size *= 1.0 + lit * 1.4;
      core = 0.55 + 0.4 * lit;
    } else if (rank < -1.5) {
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
    float hot = step(0.5, aK.y) * step(aK.y, 1.5);
    a *= hot > 0.5 ? 0.42 + 0.58 * B.z + 0.1 * sin(uTime * 1.7) : (aK.y > 1.5 ? B.z : 0.22 + 0.78 * B.z);
    size *= 0.9 + 0.22 * B.z;
    col = mix(aColor, uHot, 0.35 * hot);
    core = 0.0;
  } else if (kind < 4.5) {
    if (aK.y > 0.5) {
      a *= smoothstep(0.96, 1.0, B.w) * (1.0 - uClear);
      col = uOk;
      size *= 1.0 + 0.15 * sin(uTime * 5.0);
    } else {
      a *= 0.65 + 0.5 * B.z;
      size *= 1.0 + 0.18 * B.z * sin(uTime * 6.0);
    }
    core = 0.85;
  } else if (kind > 5.5) {
    core = -1.0;
  } else {
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
  if (vCore < -0.5) {
    float r = sqrt(r2);
    float ring = exp(-pow((r - 0.8) * 9.0, 2.0)) + 0.35 * (1.0 - uLight) * exp(-pow((r - 0.8) * 3.5, 2.0));
    gl_FragColor = vec4(vColor, clamp(ring * vA * mix(1.0, 0.8, uLight), 0.0, 1.0));
    #include <colorspace_fragment>
    return;
  }
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
  /** Mark instances [from, from + n) of one attribute for upload. Adds to the ranges queued
   *  since the last upload (a palette repaint is a whole-buffer range), skipping one already
   *  covered: while the mesh is hidden nothing uploads, and three clears them only on upload. */
  touch(name: keyof S, from: number, n: number) {
    if (n <= 0) return;
    const a = this.attr[name];
    const s = from * a.itemSize;
    const c = n * a.itemSize;
    a.needsUpdate = true;
    for (const r of a.updateRanges) if (r.start <= s && r.start + r.count >= s + c) return;
    a.addUpdateRange(s, c);
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
    uLow: { value: 0 },
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
