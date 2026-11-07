// GLSL for the hero neural core (lazy 3D chunk). Every motion runs in these shaders from a
// handful of uniforms: the intro assembly, the living surface, firing, cursor ripples and
// the scroll dispersal. Shared by three draw calls: neurons (points), synapses (lines) and
// signals (instanced streak quads, instance 0 = the core's aura).

const COMMON = /* glsl */ `
uniform float uTime;
uniform float uIntro;    // s since the assembly started (0 = scattered, invisible)
uniform float uDisperse; // 0..1 scroll hand-off
uniform float uWeight;
uniform float uLight;
uniform float uCenterZ;  // view-space z of the brain's centre
uniform float uRadius;   // world units per local unit (the brain's scale)
uniform vec3 uPointer;   // cursor (or the touch auto-orbit's virtual cursor), local space
uniform float uPointerOn;
uniform vec3 uAi;
uniform vec3 uDeep;
uniform vec3 uCore;
uniform vec3 uHot;
float hash(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
vec3 hash3(float n) { return vec3(hash(n), hash(n + 17.17), hash(n + 41.31)); }
// The living form: a slow breath plus travelling swells along the surface normal.
vec3 living(vec3 p) {
  float w = sin(p.y * 4.0 + uTime * 0.9) * sin(p.z * 3.5 - uTime * 0.7) * sin(p.x * 3.0 + uTime * 0.6);
  vec3 n = normalize(p - vec3(0.0, 0.02, -0.05) + 1e-4);
  return p * (1.0 + 0.012 * sin(uTime * 0.8)) + n * w * 0.03;
}
float frontOf(float z) { return clamp((z - uCenterZ) / uRadius * 0.5 + 0.5, 0.0, 1.0); }
`;

const NEURON_VERT = /* glsl */ `
${COMMON}
uniform float uPx;      // drawing-buffer px per world unit at distance 1
uniform vec3 uStream;   // where the dispersal flows (local space)
uniform float uSpread;
attribute float aSeed;
attribute float aKind;
varying vec3 vColor;
varying float vA;
varying float vHalo;
// A thought: every 2.8 s a firing front spreads across the cortex from a fresh point.
float cascade(vec3 p, float offset) {
  float t = uTime / 2.8 + offset;
  float k = floor(t);
  float f = fract(t);
  vec3 o = normalize(hash3(k * 7.31 + offset * 3.0) * 2.0 - 1.0) * 0.8;
  float d = length(p - o) - f * 1.7;
  return exp(-d * d * 55.0) * (1.0 - f);
}
void main() {
  float s = aSeed;
  vec3 target = living(position);

  // Intro: from a scattered cloud, swirling in (expo-out, staggered, ~1.6 s in total).
  float ti = clamp((uIntro - hash(s * 3.17) * 0.45) / 1.15, 0.0, 1.0);
  float e = ti >= 1.0 ? 1.0 : 1.0 - pow(2.0, -10.0 * ti);
  vec3 scatter = normalize(hash3(s * 13.7) * 2.0 - 1.0) * (1.6 + 1.9 * hash(s * 5.9));
  vec3 p = mix(scatter, target, e);
  float ang = (1.0 - e) * (2.0 + 1.4 * hash(s * 2.3));
  p.xz = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * p.xz;

  // Scroll hand-off: neurons peel off (the side facing the next scene first) and stream there.
  vec3 toStream = normalize(uStream + 1e-4);
  float stagger = 0.5 * hash(s * 8.1) + 0.3 * (0.5 - 0.5 * dot(normalize(target), toStream));
  float dd = clamp(uDisperse * 1.8 - stagger, 0.0, 1.0);
  float de = dd * dd * (3.0 - 2.0 * dd);
  vec3 end = uStream + (hash3(s * 4.4) * 2.0 - 1.0) * uSpread * vec3(1.0, 0.6, 1.0);
  vec3 ctrl = mix(p, end, 0.45) + normalize(p + 1e-4) * 0.7;
  p = mix(mix(p, ctrl, de), mix(ctrl, end, de), de);

  // Activity: random spikes, cortical cascades, the cursor's glow and its firing ripple.
  float slot = uTime * 0.55 + s * 17.0;
  float spike = step(0.93, hash(floor(slot) + s * 91.7)) * exp(-fract(slot) * 6.0);
  float wave = cascade(target, 0.0) + cascade(target, 0.5);
  vec3 dp = target - uPointer;
  float near = exp(-dot(dp, dp) * 10.0) * uPointerOn;
  float dl = length(dp);
  float rf = fract(uTime * 0.85);
  float ripple = exp(-pow(dl - rf * 0.95, 2.0) * 90.0) * (1.0 - rf) * uPointerOn * (1.0 - smoothstep(0.6, 1.0, dl));
  float act = clamp(spike + wave + ripple, 0.0, 1.4);

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float front = frontOf(mv.z);
  float size = 0.016;
  float inten = 0.45;
  vec3 base = uDeep;
  vHalo = 0.3;
  if (aKind > 2.5) { size = 0.046; inten = 1.0; base = uCore; vHalo = 0.8; }
  else if (aKind > 1.5) { size = 0.013; inten = 0.3; }
  else if (aKind > 0.5) { size = 0.019; inten = 0.95; base = uAi; }
  vColor = mix(mix(base, uHot, clamp(act * 0.9, 0.0, 1.0)), uCore, near * 0.55);
  float visible = smoothstep(0.0, 0.35, e) * (1.0 - smoothstep(0.6, 1.0, dd)) * uWeight;
  vA = inten * mix(0.3, 1.0, front) * (1.0 + act * 1.7 + near * 1.3) * visible;
  float px = size * (1.0 + act * 0.8 + near * 0.7) * mix(0.75, 1.1, front) * mix(0.6, 1.0, e) * (1.0 - 0.45 * de) * uRadius * uPx / -mv.z;
  // Below 1.6 px a sprite shimmers: keep it 1.6 px and fade it by the area it lost.
  vA *= min(1.0, (px * px) / 2.56);
  gl_PointSize = max(px, 1.6);
  gl_Position = projectionMatrix * mv;
}`;

const NEURON_FRAG = /* glsl */ `
uniform float uLight;
varying vec3 vColor;
varying float vA;
varying float vHalo;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(c, c);
  if (r2 > 1.0) discard;
  float core = exp(-r2 * 10.0);
  float halo = exp(-r2 * 3.0) * (1.0 - r2) * vHalo;
  if (uLight < 0.5) gl_FragColor = vec4(vColor * (core + halo) * vA, 0.0);
  else gl_FragColor = vec4(vColor, clamp((core + halo * 0.25) * vA, 0.0, 1.0));
}`;

const SYNAPSE_VERT = /* glsl */ `
${COMMON}
attribute float aT;
attribute float aSeed;
attribute float aKind;
varying float vT;
varying float vS;
varying float vK;
varying float vNear;
varying float vFront;
void main() {
  vT = aT;
  vS = aSeed;
  vK = aKind;
  vec3 dp = position - uPointer;
  vNear = exp(-dot(dp, dp) * 6.0) * uPointerOn;
  vec4 mv = modelViewMatrix * vec4(living(position), 1.0);
  vFront = frontOf(mv.z);
  gl_Position = projectionMatrix * mv;
}`;

const SYNAPSE_FRAG = /* glsl */ `
${COMMON}
varying float vT;
varying float vS;
varying float vK;
varying float vNear;
varying float vFront;
void main() {
  // Arcs draw on, source → target, once the neurons have assembled.
  float grow = clamp((uIntro - 1.05 - vS * 0.55) / 0.5, 0.0, 1.0);
  if (vT > grow) discard;
  bool isLong = vK > 0.5;
  float c = uTime * (isLong ? 0.32 : 0.55) + vS * 7.0;
  float fire = max(step(isLong ? 0.4 : 0.66, hash(floor(c) + vS * 13.0)), step(0.3, vNear));
  float head = fract(c) * 1.3 - 0.15;
  float pulse = exp(-pow((vT - head) * (isLong ? 9.0 : 6.0), 2.0)) * fire;
  float a = ((isLong ? 0.08 : 0.12) + vNear * 0.4 + pulse * 0.95) * mix(0.3, 1.0, vFront);
  a *= uWeight * (1.0 - smoothstep(0.0, 0.35, uDisperse));
  vec3 col = mix(uAi, uHot, pulse * (isLong ? 0.9 : 0.55));
  if (uLight < 0.5) gl_FragColor = vec4(col * a, 0.0);
  else gl_FragColor = vec4(col, clamp(a * 1.25, 0.0, 1.0));
}`;

const SIGNAL_VERT = /* glsl */ `
${COMMON}
attribute vec3 aP0;
attribute vec3 aP1;
attribute vec3 aP2;
attribute vec3 aPh; // phase, speed, kind (0 = aura, 1 = signal)
varying vec2 vUv;
varying float vA;
varying float vKind;
vec3 bez(float t) {
  float u = 1.0 - t;
  return u * u * aP0 + 2.0 * u * t * aP1 + t * t * aP2;
}
void main() {
  vUv = position.xy + 0.5;
  vKind = aPh.z;
  if (aPh.z < 0.5) {
    // The core's aura: a soft light behind the brain that breathes with it.
    vec4 mv = modelViewMatrix * vec4(0.0, -0.02, -0.05, 1.0);
    mv.z -= uRadius * 0.8;
    mv.xy += position.xy * uRadius * 3.4;
    vA = uWeight * smoothstep(0.1, 1.4, uIntro) * (1.0 - 0.8 * uDisperse) * (0.88 + 0.12 * sin(uTime * 0.8));
    gl_Position = projectionMatrix * mv;
    return;
  }
  float c = uTime * aPh.y + aPh.x;
  float t = fract(c);
  vec3 dp = aP0 - uPointer;
  float near = exp(-dot(dp, dp) * 5.0) * uPointerOn;
  float fire = max(step(0.45, hash(floor(c) * 3.7 + aPh.x * 11.0)), step(0.3, near));
  vec4 head = modelViewMatrix * vec4(living(bez(t)), 1.0);
  vec4 tail = modelViewMatrix * vec4(living(bez(max(t - 0.09, 0.0))), 1.0);
  vec2 d = head.xy - tail.xy;
  float len = length(d);
  d = len > 1e-5 ? d / len : vec2(1.0, 0.0);
  vec2 side = vec2(-d.y, d.x);
  float w = uRadius * 0.02;
  vec4 mv = mix(tail, head, 0.5);
  mv.xy += d * position.x * (len + w * 2.0) + side * position.y * w * 2.0;
  vA = fire * sin(3.14159 * t) * (1.0 + near) * uWeight * mix(0.4, 1.0, frontOf(head.z))
    * smoothstep(1.3, 2.1, uIntro) * (1.0 - smoothstep(0.0, 0.3, uDisperse));
  gl_Position = projectionMatrix * mv;
}`;

const SIGNAL_FRAG = /* glsl */ `
${COMMON}
varying vec2 vUv;
varying float vA;
varying float vKind;
void main() {
  if (vKind < 0.5) {
    vec2 c = vUv * 2.0 - 1.0;
    float r2 = dot(c, c);
    if (r2 > 1.0) discard;
    float a = exp(-r2 * 4.5) * (1.0 - r2) * vA;
    if (uLight < 0.5) gl_FragColor = vec4(mix(uAi, uHot, 0.12) * a * 0.2, 0.0);
    else gl_FragColor = vec4(uAi, a * 0.07);
    return;
  }
  float across = 1.0 - abs(vUv.y * 2.0 - 1.0);
  float body = across * across * (0.08 + 0.92 * vUv.x * vUv.x * vUv.x) * vA;
  if (uLight < 0.5) gl_FragColor = vec4(mix(uHot, vec3(1.0), 0.45 * vUv.x) * body * 1.8, 0.0);
  else gl_FragColor = vec4(uHot, clamp(body * 1.2, 0.0, 1.0));
}`;

export const SHADERS = {
  neuron: { vertexShader: NEURON_VERT, fragmentShader: NEURON_FRAG },
  synapse: { vertexShader: SYNAPSE_VERT, fragmentShader: SYNAPSE_FRAG },
  signal: { vertexShader: SIGNAL_VERT, fragmentShader: SIGNAL_FRAG },
};
