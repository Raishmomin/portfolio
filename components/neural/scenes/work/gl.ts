// Work scene GPU side: three instanced draw calls for the whole architecture.
// 1. platforms: rounded glass slabs (one quad each, drawn in the fragment shader)
// 2. nodes:     camera-facing orbs for technologies, AI neurons and spine ports
// 3. links:     camera-facing ribbons for the spine, spokes, AI wires/synapses and the
//               infra container's edges; request/response packets run inside them
//               (fragment shader, from uTime: zero CPU per packet).
// Dark theme glows additively; on paper everything is ink with normal blending.
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
} from "three";

export const MAX_PLATFORMS = 3;
export const NODE_EXTRA = 16; // neurons + ports on top of the technology nodes
export const MAX_LINKS = 72;

/** Link kinds (aKind): spine with two packet lanes, spoke, AI wire/synapse, infra edge. */
export const LINK = { spine: 0, spoke: 1, ai: 2, frame: 3 } as const;
/** Node kinds (aKind): technology, AI neuron, spine port. */
export const NODE = { tech: 0, neuron: 1, port: 2 } as const;

const dyn = (n: number, size: number) => {
  const a = new InstancedBufferAttribute(new Float32Array(n * size), size);
  a.setUsage(DynamicDrawUsage);
  return a;
};

function quad(x0: number, x1: number, y0: number, y1: number) {
  const g = new InstancedBufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute([x0, y0, 0, x1, y0, 0, x1, y1, 0, x0, y1, 0], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
}

// ---------- platforms ----------

const PLATFORM_VERT = /* glsl */ `
attribute vec3 aPos;
attribute vec2 aSize;
attribute float aAlpha;
attribute vec3 aTint;
uniform float uPad;
varying vec2 vP;
varying vec2 vSize;
varying float vAlpha;
varying vec3 vTint;
void main() {
  vSize = aSize;
  vAlpha = aAlpha;
  vTint = aTint;
  vec2 q = position.xy * (aSize + 2.0 * uPad);
  vP = q;
  // The quad lies flat (XZ): x across, y = depth toward the viewer.
  vec3 p = aPos + vec3(q.x, 0.0, q.y);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

const PLATFORM_FRAG = /* glsl */ `
uniform float uOpacity;
uniform float uLight;
uniform float uTime;
uniform float uGrid;
uniform vec3 uBg;
uniform vec3 uFg;
varying vec2 vP;
varying vec2 vSize;
varying float vAlpha;
varying vec3 vTint;
float sdBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
float fill(float d) { float w = fwidth(d); return 1.0 - smoothstep(-w, w, d); }
void main() {
  vec2 h = vSize * 0.5;
  float d = sdBox(vP, h, 0.22);
  float body = fill(d);
  float edge = fill(abs(d) - 0.012);
  // Blueprint grid on the glass, and a soft light band sweeping across it.
  vec2 g = abs(fract(vP / 0.42) - 0.5);
  float grid = (1.0 - smoothstep(0.0, 0.035, min(g.x, g.y))) * uGrid;
  float sweep = smoothstep(0.5, 0.0, abs(fract(vP.x * 0.12 - uTime * 0.06) - 0.5) - 0.32);
  float front = smoothstep(-h.y, h.y, vP.y); // brighter toward the viewer
  // Dark: tinted glass + glowing rim. Paper: frosted white glass, inked rim, soft shadow.
  vec3 glass = mix(uBg, vTint, 0.10 + 0.06 * front) + sweep * 0.035;
  vec3 glassL = mix(vec3(1.0), vTint, 0.05);
  vec3 col = mix(glass, glassL, uLight);
  float a = body * mix(0.36 + 0.1 * front, 0.82, uLight);
  col = mix(col, mix(vTint, uFg, 0.25 * uLight), grid * 0.5);
  a = max(a, grid * body * mix(0.22, 0.14, uLight));
  vec3 rim = mix(vTint * 1.25, mix(vTint, uFg, 0.35), uLight);
  col = mix(col, rim, edge);
  a = max(a, edge * mix(0.95, 0.85, uLight));
  // Outside: a glow on dark, a contact shadow on paper.
  float od = max(d, 0.0);
  float glow = exp(-od * 9.0) * (1.0 - body);
  vec3 outCol = mix(vTint, uFg, uLight);
  float outA = mix(glow * 0.22, glow * 0.07, uLight);
  float A = a + outA * (1.0 - a);
  vec3 C = (col * a + outCol * outA * (1.0 - a)) / max(A, 1e-4);
  gl_FragColor = vec4(C, A * vAlpha * uOpacity);
  #include <colorspace_fragment>
}
`;

// ---------- nodes ----------

const NODE_VERT = /* glsl */ `
attribute vec3 aPos;
attribute float aSize;
attribute vec3 aColor;
attribute float aAlpha;
attribute float aHi;
attribute float aKind;
uniform float uScale;
varying vec2 vUv;
varying vec3 vColor;
varying float vAlpha;
varying float vHi;
varying float vKind;
void main() {
  vUv = position.xy * 2.0;
  vColor = aColor;
  vAlpha = aAlpha;
  vHi = aHi;
  vKind = aKind;
  vec4 mv = modelViewMatrix * vec4(aPos, 1.0);
  mv.xy += position.xy * aSize * uScale;
  gl_Position = projectionMatrix * mv;
}
`;

const NODE_FRAG = /* glsl */ `
uniform float uOpacity;
uniform float uLight;
uniform float uTime;
uniform vec3 uBg;
uniform vec3 uAccent;
varying vec2 vUv;
varying vec3 vColor;
varying float vAlpha;
varying float vHi;
varying float vKind;
void main() {
  float d = length(vUv);
  if (d > 1.0) discard;
  float w = fwidth(d);
  float tech = 1.0 - step(0.5, vKind);
  float port = step(1.5, vKind);
  // Orb: a solid disc with a bright core, a thin ring and a halo; the highlighted node
  // gets an orange ring that breathes.
  float r = mix(0.3, 0.42, port);
  float disc = 1.0 - smoothstep(r - w, r + w, d);
  float core = smoothstep(r * 0.85, 0.0, d);
  float ring = (1.0 - smoothstep(0.0, w * 1.5, abs(d - (r + 0.11)) - 0.018)) * tech;
  float halo = exp(-d * d * 7.0) * (1.0 - disc);
  float pulse = 0.6 + 0.4 * sin(uTime * 4.0);
  float hiRing = (1.0 - smoothstep(0.0, w * 1.5, abs(d - (0.66 + 0.08 * pulse)) - 0.03)) * vHi;
  // Dark
  vec3 cD = mix(vColor, vec3(1.0), core * 0.75);
  float aD = disc + halo * mix(0.55, 0.9, vHi) + ring * 0.7;
  vec3 colD = mix(vColor * 1.15, cD, disc);
  // Paper
  vec3 cL = mix(vColor, mix(vColor, vec3(1.0), 0.45), core * 0.6);
  float aL = disc + ring * 0.85 + halo * 0.12;
  vec3 colL = mix(vColor, cL, disc);
  vec3 col = mix(colD, colL, uLight);
  float a = mix(aD, aL, uLight);
  col = mix(col, uAccent, hiRing);
  a = max(a, hiRing);
  // Ports are hollow rings.
  float hollow = port * (1.0 - smoothstep(r * 0.55, r * 0.55 + w, d)) * disc;
  a *= 1.0 - hollow * 0.85;
  gl_FragColor = vec4(col, clamp(a, 0.0, 1.0) * vAlpha * uOpacity);
  #include <colorspace_fragment>
}
`;

// ---------- links ----------

const LINK_VERT = /* glsl */ `
attribute vec3 aA;
attribute vec3 aB;
attribute float aW;
attribute float aAlpha;
attribute float aKind;
attribute float aSeed;
attribute vec3 aColor;
uniform float uScale;
varying float vT;
varying float vU;
varying float vLen;
varying float vAlpha;
varying float vKind;
varying float vSeed;
varying vec3 vColor;
void main() {
  vec4 a = modelViewMatrix * vec4(aA, 1.0);
  vec4 b = modelViewMatrix * vec4(aB, 1.0);
  vec2 dir = b.xy - a.xy;
  float l2 = length(dir);
  dir = l2 > 1e-5 ? dir / l2 : vec2(1.0, 0.0);
  vec2 side = vec2(-dir.y, dir.x);
  vec4 p = mix(a, b, position.x);
  p.xy += side * position.y * aW * uScale;
  vT = position.x;
  vU = position.y;
  vLen = distance(aA, aB);
  vAlpha = aAlpha;
  vKind = aKind;
  vSeed = aSeed;
  vColor = aColor;
  gl_Position = projectionMatrix * p;
}
`;

const LINK_FRAG = /* glsl */ `
uniform float uOpacity;
uniform float uLight;
uniform float uTime;
uniform float uPackets;
uniform vec3 uReq;
uniform vec3 uRes;
uniform vec3 uAi;
varying float vT;
varying float vU;
varying float vLen;
varying float vAlpha;
varying float vKind;
varying float vSeed;
varying vec3 vColor;
// Comet travelling along the link: bright head at the front, tail behind.
float comet(float s, float dir, float speed, float spacing, float seed) {
  float ph = fract((dir * s - uTime * speed) / spacing + seed);
  return smoothstep(0.62, 0.97, ph) * (1.0 - smoothstep(0.97, 1.0, ph));
}
void main() {
  float u = abs(vU);
  float w = fwidth(vU);
  float core = 1.0 - smoothstep(0.18, 0.18 + w * 2.0, u);
  float soft = exp(-u * u * 5.0);
  float s = vT * vLen;
  // Fade the ends so links meet their nodes softly.
  float ends = smoothstep(0.0, 0.06, vT) * smoothstep(1.0, 0.94, vT);
  float a = (core * mix(0.55, 0.75, uLight) + soft * mix(0.18, 0.05, uLight));
  vec3 col = vColor;
  float k = vKind;
  if (k < 0.5) {
    // Spine: requests run down the left lane (orange), responses up the right lane (green).
    float lane = 1.0 - smoothstep(0.1, 0.45, abs(vU + 0.42));
    float lane2 = 1.0 - smoothstep(0.1, 0.45, abs(vU - 0.42));
    float req = comet(s, 1.0, 1.3, 1.25, vSeed) * lane;
    float res = comet(s, -1.0, 1.1, 1.25, vSeed + 0.5) * lane2;
    a = a * 0.6 + (req + res) * uPackets;
    col = mix(col, uReq, req * uPackets);
    col = mix(col, uRes, res * uPackets);
  } else if (k < 1.5) {
    float p = comet(s, 1.0, 0.9, 1.1, vSeed) * (1.0 - smoothstep(0.0, 0.7, u));
    a = a * 0.55 + p * 0.9 * uPackets;
    col = mix(col, uReq, p * uPackets);
  } else if (k < 2.5) {
    float p = comet(s, 1.0, 1.0, 0.8, vSeed) * (1.0 - smoothstep(0.0, 0.7, u));
    a = a * 0.6 + p * uPackets;
    col = mix(col, mix(uAi, vec3(1.0), 0.35 * (1.0 - uLight)), p * uPackets);
  } else {
    // Infra container edge: a dashed line marching slowly.
    float dash = step(0.45, fract(s * 2.2 - uTime * 0.25 + vSeed));
    a *= 0.35 + 0.65 * dash;
  }
  gl_FragColor = vec4(col, clamp(a, 0.0, 1.0) * ends * vAlpha * uOpacity);
  #include <colorspace_fragment>
}
`;

export type Gl = ReturnType<typeof createGl>;

/** Geometries, attributes and materials of the three draw calls. */
export function createGl(nodeCount: number) {
  const platforms = quad(-0.5, 0.5, -0.5, 0.5);
  const pAttr = { aPos: dyn(MAX_PLATFORMS, 3), aSize: dyn(MAX_PLATFORMS, 2), aAlpha: dyn(MAX_PLATFORMS, 1), aTint: dyn(MAX_PLATFORMS, 3) };
  for (const [k, a] of Object.entries(pAttr)) platforms.setAttribute(k, a);
  platforms.instanceCount = MAX_PLATFORMS;

  const nodes = quad(-0.5, 0.5, -0.5, 0.5);
  const nAttr = {
    aPos: dyn(nodeCount, 3),
    aSize: dyn(nodeCount, 1),
    aColor: dyn(nodeCount, 3),
    aAlpha: dyn(nodeCount, 1),
    aHi: dyn(nodeCount, 1),
    aKind: dyn(nodeCount, 1),
  };
  for (const [k, a] of Object.entries(nAttr)) nodes.setAttribute(k, a);
  nodes.instanceCount = nodeCount;

  const links = quad(0, 1, -1, 1);
  const lAttr = {
    aA: dyn(MAX_LINKS, 3),
    aB: dyn(MAX_LINKS, 3),
    aW: dyn(MAX_LINKS, 1),
    aAlpha: dyn(MAX_LINKS, 1),
    aKind: dyn(MAX_LINKS, 1),
    aSeed: dyn(MAX_LINKS, 1),
    aColor: dyn(MAX_LINKS, 3),
  };
  for (const [k, a] of Object.entries(lAttr)) links.setAttribute(k, a);
  links.instanceCount = 0;

  const common = () => ({
    uOpacity: { value: 0 },
    uLight: { value: 0 },
    uTime: { value: 0 },
    uScale: { value: 1 },
  });
  const platformMat = new ShaderMaterial({
    uniforms: { ...common(), uPad: { value: 0.4 }, uGrid: { value: 1 }, uBg: { value: new Color() }, uFg: { value: new Color() } },
    vertexShader: PLATFORM_VERT,
    fragmentShader: PLATFORM_FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    side: DoubleSide,
  });
  const nodeMat = new ShaderMaterial({
    uniforms: { ...common(), uBg: { value: new Color() }, uAccent: { value: new Color() } },
    vertexShader: NODE_VERT,
    fragmentShader: NODE_FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: false,
  });
  const linkMat = new ShaderMaterial({
    uniforms: { ...common(), uPackets: { value: 1 }, uReq: { value: new Color() }, uRes: { value: new Color() }, uAi: { value: new Color() } },
    vertexShader: LINK_VERT,
    fragmentShader: LINK_FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: false,
  });

  return {
    platforms,
    nodes,
    links,
    pAttr,
    nAttr,
    lAttr,
    platformMat,
    nodeMat,
    linkMat,
    setLight(light: boolean) {
      const blending = light ? NormalBlending : AdditiveBlending;
      for (const m of [nodeMat, linkMat]) {
        if (m.blending !== blending) {
          m.blending = blending;
          m.needsUpdate = true;
        }
        m.uniforms.uLight.value = light ? 1 : 0;
      }
      platformMat.uniforms.uLight.value = light ? 1 : 0;
    },
    dispose() {
      for (const g of [platforms, nodes, links] as BufferGeometry[]) g.dispose();
      for (const m of [platformMat, nodeMat, linkMat]) m.dispose();
    },
  };
}
