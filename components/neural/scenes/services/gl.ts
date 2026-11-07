// Services scene GPU side: five instanced draw calls for every engagement's machine.
// 1. slabs:    rounded glass panels / content blocks (one quad each, shaped in the fragment
//              shader; blocks fill left to right over a shimmering skeleton)
// 2. boxes:    shaded solid cubes with lit edges (servers, containers, pods, queue jobs)
// 3. cylinders: shaded solid discs (database stacks) and hexagonal prisms (Node.js)
// 4. links:    camera-facing ribbons; comets run inside them (fragment shader, from uTime)
// 5. sprites:  camera-facing orbs, rings, dots and packets
// Dark theme glows additively; on paper everything is ink with normal blending.
import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  DynamicDrawUsage,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  NormalBlending,
  ShaderMaterial,
} from "three";

export const MAX = { slabs: 28, boxes: 40, cyls: 12, links: 200, sprites: 150 } as const;

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

/** An instanced copy of a plain geometry (position, normal, index). */
function instanced(src: BufferGeometry) {
  const g = new InstancedBufferGeometry();
  g.setIndex(src.getIndex());
  g.setAttribute("position", src.getAttribute("position"));
  g.setAttribute("normal", src.getAttribute("normal"));
  return g;
}

// ---------- slabs ----------

const SLAB_VERT = /* glsl */ `
attribute vec3 aPos;
attribute vec2 aSize;
attribute vec3 aTint;
attribute float aAlpha;
attribute float aFill;
attribute float aStyle;
attribute float aFlat;
uniform float uPad;
varying vec2 vP;
varying vec2 vSize;
varying vec3 vTint;
varying float vAlpha;
varying float vFill;
varying float vStyle;
void main() {
  vSize = aSize;
  vTint = aTint;
  vAlpha = aAlpha;
  vFill = aFill;
  vStyle = aStyle;
  vec2 q = position.xy * (aSize + 2.0 * uPad);
  vP = q;
  // Upright in the XY plane, or lying flat (XZ, y = depth toward the viewer).
  vec3 p = aPos + (aFlat > 0.5 ? vec3(q.x, 0.0, -q.y) : vec3(q, 0.0));
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);  if (aAlpha < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}
`;

const SLAB_FRAG = /* glsl */ `
uniform float uOpacity;
uniform float uLight;
uniform float uTime;
uniform float uDetail;
uniform vec3 uBg;
uniform vec3 uFg;
uniform vec3 uMuted;
varying vec2 vP;
varying vec2 vSize;
varying vec3 vTint;
varying float vAlpha;
varying float vFill;
varying float vStyle;
float sdBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
float fill(float d) { float w = fwidth(d); return 1.0 - smoothstep(-w, w, d); }
void main() {
  vec2 h = vSize * 0.5;
  float r = min(0.16, min(h.x, h.y) * 0.6);
  float d = sdBox(vP, h, r);
  float body = fill(d);
  float edge = fill(abs(d) - 0.011);
  float od = max(d, 0.0);
  vec3 col;
  float a;
  if (vStyle < 0.5 || vStyle > 1.5) {
    // Glass panel (2 = window: a darker title bar along its top).
    vec2 g = abs(fract(vP / 0.36) - 0.5);
    float grid = (1.0 - smoothstep(0.0, 0.04, min(g.x, g.y))) * uDetail * step(vStyle, 0.5);
    float sweep = smoothstep(0.5, 0.0, abs(fract(vP.x * 0.1 + vP.y * 0.05 - uTime * 0.05) - 0.5) - 0.34);
    float bar = step(1.5, vStyle) * step(h.y - 0.34, vP.y);
    vec3 glass = mix(uBg, vTint, 0.08 + 0.05 * bar) + sweep * 0.03;
    vec3 glassL = mix(vec3(1.0), vTint, 0.04 + 0.06 * bar);
    col = mix(glass, glassL, uLight);
    a = body * mix(0.42 + 0.18 * bar, 0.84, uLight);
    col = mix(col, mix(vTint, uFg, 0.3 * uLight), grid * 0.45);
    a = max(a, grid * body * mix(0.2, 0.12, uLight));
    // Title-bar divider.
    float div = step(1.5, vStyle) * (1.0 - smoothstep(0.0, fwidth(vP.y) * 1.5, abs(vP.y - (h.y - 0.34)))) * body;
    col = mix(col, mix(vTint, uFg, 0.4 * uLight), div * 0.6);
    vec3 rim = mix(vTint * 1.2, mix(vTint, uFg, 0.35), uLight);
    col = mix(col, rim, edge);
    a = max(a, edge * mix(0.9, 0.8, uLight));
    float glow = exp(-od * 8.0) * (1.0 - body);
    vec3 outCol = mix(vTint, uFg, uLight);
    float outA = mix(glow * 0.2, glow * 0.06, uLight);
    float A = a + outA * (1.0 - a);
    col = (col * a + outCol * outA * (1.0 - a)) / max(A, 1e-4);
    a = A;
  } else {
    // Content block: filled left to right (vFill) over a shimmering skeleton.
    float x = (vP.x + h.x) / max(2.0 * h.x, 1e-3);
    float filled = 1.0 - smoothstep(vFill - 0.02, vFill + 0.02, x);
    float shimmer = smoothstep(0.42, 0.0, abs(fract(x * 0.5 - uTime * 0.7) - 0.5)) * uDetail;
    vec3 skel = mix(mix(uBg, uMuted, 0.22), mix(vec3(1.0), uMuted, 0.18), uLight) + shimmer * mix(0.08, 0.06, uLight) * mix(1.0, -1.0, uLight);
    vec3 solid = mix(mix(vTint, uBg, 0.24), mix(vTint, uFg, 0.15), uLight);
    col = mix(skel, solid, filled);
    a = body * mix(mix(0.55, 0.7, uLight), mix(0.9, 0.92, uLight), filled);
    col = mix(col, mix(vTint * 1.3, vTint, uLight), edge * filled);
    a = max(a, edge * mix(0.35, 0.9, filled));
    float glow = exp(-od * 10.0) * (1.0 - body) * filled * (1.0 - uLight);
    float A = a + glow * 0.3 * (1.0 - a);
    col = (col * a + vTint * glow * 0.3 * (1.0 - a)) / max(A, 1e-4);
    a = A;
  }
  gl_FragColor = vec4(col, a * vAlpha * uOpacity);
  #include <colorspace_fragment>
}
`;

// ---------- solids (boxes, cylinders / hexagonal prisms) ----------

const SOLID_VERT = /* glsl */ `
attribute vec3 aPos;
attribute vec3 aScale;
attribute vec3 aTint;
attribute float aAlpha;
attribute vec2 aRot;
attribute float aGlow;
attribute float aSides;
varying vec3 vN;
varying vec3 vL;
varying vec3 vNl;
varying vec3 vS;
varying vec3 vTint;
varying float vAlpha;
varying float vGlow;
varying float vSides;
void main() {
  vec3 lp = position;
  vec3 ln = normal;
  // Hexagonal prism from the 24-sided cylinder: each side vertex moves onto the hexagon.
  if (aSides > 5.5 && abs(normal.y) < 0.5) {
    float th = atan(lp.z, lp.x);
    float seg = 1.0471976;
    float k = 0.8660254 / cos(mod(th, seg) - seg * 0.5);
    lp.xz *= k;
    float face = floor(th / seg) * seg + seg * 0.5;
    ln = vec3(cos(face), 0.0, sin(face));
  } else if (aSides > 5.5) {
    float rr = length(lp.xz);
    if (rr > 1e-4) {
      float th = atan(lp.z, lp.x);
      float seg = 1.0471976;
      lp.xz *= 0.8660254 / cos(mod(th, seg) - seg * 0.5);
    }
  }
  vL = lp;
  vNl = ln;
  vS = aScale;
  vec3 p = lp * aScale;
  vec3 n = ln / max(aScale, vec3(1e-3));
  // Orientation: about x (aRot.x), then about y (aRot.y).
  float cx = cos(aRot.x), sx = sin(aRot.x);
  p = vec3(p.x, cx * p.y - sx * p.z, sx * p.y + cx * p.z);
  n = vec3(n.x, cx * n.y - sx * n.z, sx * n.y + cx * n.z);
  float cy = cos(aRot.y), sy = sin(aRot.y);
  p = vec3(cy * p.x + sy * p.z, p.y, -sy * p.x + cy * p.z);
  n = vec3(cy * n.x + sy * n.z, n.y, -sy * n.x + cy * n.z);
  vN = normalize(normalMatrix * n);
  vTint = aTint;
  vAlpha = aAlpha;
  vGlow = aGlow;
  vSides = aSides;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p + aPos, 1.0);
  // Solids write depth: an invisible one must not rasterise at all (it would punch holes).
  if (aAlpha < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}
`;

const SOLID_FRAG = /* glsl */ `
uniform float uOpacity;
uniform float uLight;
uniform float uCyl;
uniform vec3 uFg;
uniform vec3 uBg;
varying vec3 vN;
varying vec3 vL;
varying vec3 vNl;
varying vec3 vS;
varying vec3 vTint;
varying float vAlpha;
varying float vGlow;
varying float vSides;
void main() {
  vec3 n = normalize(vN);
  vec3 L = normalize(vec3(-0.35, 0.75, 0.55));
  float diff = max(dot(n, L), 0.0);
  float fres = pow(1.0 - abs(n.z), 2.0);
  // Distance to the nearest edge of the face, in world units.
  float d;
  if (uCyl < 0.5) {
    vec3 an = abs(vNl);
    vec3 e = (0.5 - abs(vL)) * vS + step(0.5, an) * 1e3;
    d = min(e.x, min(e.y, e.z));
  } else {
    float side = 1.0 - step(0.5, abs(vNl.y));
    float rim = (0.5 - abs(vL.y)) * vS.y;
    float rr = length(vL.xz);
    float capEdge = (0.5 - rr) * vS.x;
    if (vSides > 5.5) {
      vec2 q = vL.xz;
      float hx = max(abs(dot(q, vec2(0.8660254, 0.5))), max(abs(q.y), abs(dot(q, vec2(-0.8660254, 0.5)))));
      capEdge = (0.4330127 - hx) * vS.x;
    }
    d = mix(capEdge, rim, side);
    if (vSides > 5.5 && side > 0.5) {
      // Hexagon corners read as vertical edges.
      float th = atan(vL.z, vL.x);
      float seg = 1.0471976;
      float m = abs(mod(th, seg) - seg * 0.5);
      d = min(d, (seg * 0.5 - m) * 0.5 * vS.x);
    }
  }
  float w = fwidth(d) * 1.2 + 1e-4;
  float edge = 1.0 - smoothstep(0.012, 0.012 + w + 0.02, d);
  // Dark: tinted glass-metal with glowing edges. Paper: white faces with inked edges.
  vec3 bodyD = mix(uBg, vTint, 0.28 + 0.22 * diff) + vTint * fres * 0.25;
  vec3 colD = mix(bodyD, vTint * 1.35 + 0.08, edge);
  float aD = mix(0.8, 1.0, edge);
  vec3 bodyL = mix(vec3(1.0), vTint, 0.1 + 0.12 * (1.0 - diff));
  vec3 colL = mix(bodyL, mix(vTint, uFg, 0.35), edge);
  float aL = mix(0.94, 1.0, edge);
  vec3 col = mix(colD, colL, uLight);
  float a = mix(aD, aL, uLight);
  col = mix(col, mix(vTint * 1.6 + 0.2, vTint, uLight), vGlow * 0.6);
  if (a * vAlpha * uOpacity < 0.02) discard;
  gl_FragColor = vec4(col, a * vAlpha * uOpacity);
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
attribute float aSpeed;
attribute float aDraw;
attribute vec3 aColor;
uniform float uScale;
varying float vT;
varying float vU;
varying float vLen;
varying float vAlpha;
varying float vKind;
varying float vSeed;
varying float vSpeed;
varying float vDraw;
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
  vSpeed = aSpeed;
  vDraw = aDraw;
  vColor = aColor;
  gl_Position = projectionMatrix * p;  if (aAlpha < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}
`;

const LINK_FRAG = /* glsl */ `
uniform float uOpacity;
uniform float uLight;
uniform float uTime;
uniform float uComets;
uniform vec3 uReq;
uniform vec3 uRes;
varying float vT;
varying float vU;
varying float vLen;
varying float vAlpha;
varying float vKind;
varying float vSeed;
varying float vSpeed;
varying float vDraw;
varying vec3 vColor;
float comet(float s, float speed, float spacing, float seed) {
  float ph = fract((s - uTime * speed) / spacing + seed);
  return smoothstep(0.6, 0.97, ph) * (1.0 - smoothstep(0.97, 1.0, ph));
}
void main() {
  if (vT > vDraw) discard;
  float u = abs(vU);
  float w = fwidth(vU);
  float core = 1.0 - smoothstep(0.2, 0.2 + w * 2.0, u);
  float soft = exp(-u * u * 5.0);
  // Path position: seed carries the offset of this segment along its whole path.
  float s = vT * vLen;
  float ends = vKind > 0.5 && vKind < 1.5 ? 1.0 : smoothstep(0.0, 0.05, vT) * smoothstep(1.0, 0.95, vT);
  float a = core * mix(0.5, 0.72, uLight) + soft * mix(0.16, 0.04, uLight);
  vec3 col = vColor;
  if (vKind > 0.5 && vKind < 1.5) {
    // Flow: comets in the direction of vSpeed (continuous across a path's segments).
    float dir = sign(vSpeed);
    float c = comet(dir * (s + vSeed), abs(vSpeed), 1.15, 0.0) * (1.0 - smoothstep(0.0, 0.75, u)) * uComets;
    a = a * 0.6 + c;
    col = mix(col, mix(col * 1.5 + 0.15, col, uLight), c);
  } else if (vKind > 1.5 && vKind < 2.5) {
    // Dashed (infrastructure outlines, traces): marching slowly.
    float dash = step(0.5, fract(s * 2.6 - uTime * 0.3 * vSpeed + vSeed));
    a *= 0.3 + 0.7 * dash;
  } else if (vKind > 2.5) {
    // Two lanes: requests one way (accent), responses back (ok).
    float lane = 1.0 - smoothstep(0.1, 0.45, abs(vU + 0.42));
    float lane2 = 1.0 - smoothstep(0.1, 0.45, abs(vU - 0.42));
    float req = comet(s, abs(vSpeed), 1.0, vSeed) * lane;
    float res = comet(-s, abs(vSpeed) * 0.9, 1.0, vSeed + 0.5) * lane2;
    a = a * 0.55 + (req + res) * uComets;
    col = mix(col, uReq, req * uComets);
    col = mix(col, uRes, res * uComets);
  }
  // Drawing on: a bright tip where the line is being drawn.
  float tip = (1.0 - smoothstep(0.0, 0.06, vDraw - vT)) * step(vDraw, 0.995);
  col = mix(col, mix(vec3(1.0), col, uLight), tip * 0.6);
  gl_FragColor = vec4(col, clamp(a + tip * 0.5, 0.0, 1.0) * ends * vAlpha * uOpacity);
  #include <colorspace_fragment>
}
`;

// ---------- sprites ----------

const SPRITE_VERT = /* glsl */ `
attribute vec3 aPos;
attribute float aSize;
attribute vec3 aColor;
attribute float aAlpha;
attribute float aKind;
attribute float aHi;
uniform float uScale;
varying vec2 vUv;
varying vec3 vColor;
varying float vAlpha;
varying float vKind;
varying float vHi;
void main() {
  vUv = position.xy * 2.0;
  vColor = aColor;
  vAlpha = aAlpha;
  vKind = aKind;
  vHi = aHi;
  vec4 mv = modelViewMatrix * vec4(aPos, 1.0);
  mv.xy += position.xy * aSize * uScale;
  gl_Position = projectionMatrix * mv;  if (aAlpha < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}
`;

const SPRITE_FRAG = /* glsl */ `
uniform float uOpacity;
uniform float uLight;
uniform float uTime;
uniform vec3 uAccent;
varying vec2 vUv;
varying vec3 vColor;
varying float vAlpha;
varying float vKind;
varying float vHi;
void main() {
  float d = length(vUv);
  if (d > 1.0) discard;
  float w = fwidth(d);
  vec3 col;
  float a;
  if (vKind < 0.5) {
    // Orb: disc, bright core, thin ring, halo.
    float r = 0.32;
    float disc = 1.0 - smoothstep(r - w, r + w, d);
    float core = smoothstep(r * 0.85, 0.0, d);
    float ring = 1.0 - smoothstep(0.0, w * 1.5, abs(d - (r + 0.12)) - 0.02);
    float halo = exp(-d * d * 7.0) * (1.0 - disc);
    vec3 cD = mix(vColor * 1.1, mix(vColor, vec3(1.0), core * 0.7), disc);
    float aD = disc + halo * 0.6 + ring * 0.6;
    vec3 cL = mix(vColor, mix(vColor, vec3(1.0), core * 0.45), disc);
    float aL = disc + ring * 0.8 + halo * 0.1;
    col = mix(cD, cL, uLight);
    a = mix(aD, aL, uLight);
  } else if (vKind < 1.5) {
    // Ring: a hollow circle (stations, boundaries).
    float ring = 1.0 - smoothstep(0.0, w * 1.5, abs(d - 0.7) - 0.045);
    float halo = exp(-pow((d - 0.7) * 6.0, 2.0)) * (1.0 - uLight);
    col = vColor * mix(1.15, 1.0, uLight);
    a = ring + halo * 0.35;
  } else if (vKind < 2.5) {
    // Packet: a hot core and a wide halo.
    float core = 1.0 - smoothstep(0.16 - w, 0.2 + w, d);
    float halo = exp(-d * d * 6.0);
    col = mix(mix(vColor, vec3(1.0), core * 0.75), vColor, uLight * (1.0 - core * 0.3));
    a = core + halo * mix(0.75, 0.25, uLight);
  } else {
    // Dot: a small flat disc.
    float disc = 1.0 - smoothstep(0.55 - w, 0.55 + w, d);
    col = vColor;
    a = disc * 0.95 + exp(-d * d * 4.0) * 0.25 * (1.0 - uLight);
  }
  float pulse = 0.6 + 0.4 * sin(uTime * 4.0);
  float hiRing = (1.0 - smoothstep(0.0, w * 1.5, abs(d - (0.82 + 0.06 * pulse)) - 0.03)) * vHi;
  col = mix(col, uAccent, hiRing);
  a = max(a, hiRing);
  gl_FragColor = vec4(col, clamp(a, 0.0, 1.0) * vAlpha * uOpacity);
  #include <colorspace_fragment>
}
`;

export type Gl = ReturnType<typeof createGl>;

export function createGl() {
  const slabs = quad(-0.5, 0.5, -0.5, 0.5);
  const sAttr = {
    aPos: dyn(MAX.slabs, 3),
    aSize: dyn(MAX.slabs, 2),
    aTint: dyn(MAX.slabs, 3),
    aAlpha: dyn(MAX.slabs, 1),
    aFill: dyn(MAX.slabs, 1),
    aStyle: dyn(MAX.slabs, 1),
    aFlat: dyn(MAX.slabs, 1),
  };
  for (const [k, a] of Object.entries(sAttr)) slabs.setAttribute(k, a);
  slabs.instanceCount = MAX.slabs;

  const boxSrc = new BoxGeometry(1, 1, 1);
  const cylSrc = new CylinderGeometry(0.5, 0.5, 1, 24, 1);
  const boxes = instanced(boxSrc);
  const cyls = instanced(cylSrc);
  const solidAttrs = (n: number) => ({
    aPos: dyn(n, 3),
    aScale: dyn(n, 3),
    aTint: dyn(n, 3),
    aAlpha: dyn(n, 1),
    aRot: dyn(n, 2),
    aGlow: dyn(n, 1),
    aSides: dyn(n, 1),
  });
  const bAttr = solidAttrs(MAX.boxes);
  const cAttr = solidAttrs(MAX.cyls);
  for (const [k, a] of Object.entries(bAttr)) boxes.setAttribute(k, a);
  for (const [k, a] of Object.entries(cAttr)) cyls.setAttribute(k, a);
  boxes.instanceCount = MAX.boxes;
  cyls.instanceCount = MAX.cyls;

  const links = quad(0, 1, -1, 1);
  const lAttr = {
    aA: dyn(MAX.links, 3),
    aB: dyn(MAX.links, 3),
    aW: dyn(MAX.links, 1),
    aAlpha: dyn(MAX.links, 1),
    aKind: dyn(MAX.links, 1),
    aSeed: dyn(MAX.links, 1),
    aSpeed: dyn(MAX.links, 1),
    aDraw: dyn(MAX.links, 1),
    aColor: dyn(MAX.links, 3),
  };
  for (const [k, a] of Object.entries(lAttr)) links.setAttribute(k, a);
  links.instanceCount = MAX.links;

  const sprites = quad(-0.5, 0.5, -0.5, 0.5);
  const pAttr = {
    aPos: dyn(MAX.sprites, 3),
    aSize: dyn(MAX.sprites, 1),
    aColor: dyn(MAX.sprites, 3),
    aAlpha: dyn(MAX.sprites, 1),
    aKind: dyn(MAX.sprites, 1),
    aHi: dyn(MAX.sprites, 1),
  };
  for (const [k, a] of Object.entries(pAttr)) sprites.setAttribute(k, a);
  sprites.instanceCount = MAX.sprites;

  const common = () => ({ uOpacity: { value: 0 }, uLight: { value: 0 }, uTime: { value: 0 } });
  const slabMat = new ShaderMaterial({
    uniforms: {
      ...common(),
      uPad: { value: 0.3 },
      uDetail: { value: 1 },
      uBg: { value: new Color() },
      uFg: { value: new Color() },
      uMuted: { value: new Color() },
    },
    vertexShader: SLAB_VERT,
    fragmentShader: SLAB_FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    side: DoubleSide,
  });
  const solid = (cyl: boolean) =>
    new ShaderMaterial({
      uniforms: { ...common(), uCyl: { value: cyl ? 1 : 0 }, uFg: { value: new Color() }, uBg: { value: new Color() } },
      vertexShader: SOLID_VERT,
      fragmentShader: SOLID_FRAG,
      transparent: true,
      depthWrite: true,
      depthTest: true,
    });
  const boxMat = solid(false);
  const cylMat = solid(true);
  const linkMat = new ShaderMaterial({
    uniforms: { ...common(), uScale: { value: 1 }, uComets: { value: 1 }, uReq: { value: new Color() }, uRes: { value: new Color() } },
    vertexShader: LINK_VERT,
    fragmentShader: LINK_FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: true,
  });
  const spriteMat = new ShaderMaterial({
    uniforms: { ...common(), uScale: { value: 1 }, uAccent: { value: new Color() } },
    vertexShader: SPRITE_VERT,
    fragmentShader: SPRITE_FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: true,
  });
  const mats = [slabMat, boxMat, cylMat, linkMat, spriteMat];

  return {
    slabs,
    boxes,
    cyls,
    links,
    sprites,
    sAttr,
    bAttr,
    cAttr,
    lAttr,
    pAttr,
    slabMat,
    boxMat,
    cylMat,
    linkMat,
    spriteMat,
    mats,
    setLight(light: boolean) {
      const blending = light ? NormalBlending : AdditiveBlending;
      for (const m of [linkMat, spriteMat]) {
        if (m.blending !== blending) {
          m.blending = blending;
          m.needsUpdate = true;
        }
      }
      for (const m of mats) m.uniforms.uLight.value = light ? 1 : 0;
    },
    dispose() {
      boxSrc.dispose();
      cylSrc.dispose();
      for (const g of [slabs, boxes, cyls, links, sprites] as BufferGeometry[]) g.dispose();
      for (const m of mats) m.dispose();
    },
  };
}
