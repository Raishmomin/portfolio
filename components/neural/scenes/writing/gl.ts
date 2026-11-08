// Writing scene GPU side. One instanced quad batch draws every flat element from a frame
// per instance (centre + two edge vectors, so each quad has its own size and 3D tilt):
// the glass manuscript pages, the sheets stacked behind them, the build terminal and the
// rail. All detail (rims, folded corner, text lines typed by the cursor, the scrolling
// build log, ink comets on the rail) is procedural in the fragment shader. Glow points
// reuse the shared Sprites batch (scenes/stack/gl.ts): two draw calls in all.
// Dark theme adds light (colour as light); paper uses normal alpha blending with ink.
import { Color, DynamicDrawUsage, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, PlaneGeometry, ShaderMaterial } from "three";

/** Instance kinds (aK.x). */
export const KIND = { page: 0, back: 1, term: 2, lit: 3, dim: 4 } as const;
/** Page text layout (sheet-height units), mirrored by the CPU cursor (rig.ts). */
export const PAGE = { m: 0.085, top: 0.25, rh: 0.066 } as const;

/** Length (fraction of the line) of body line i of a page seeded s: GLSL twin below. */
export function lineLen(i: number, s: number): number {
  const m = (i + Math.floor(s * 5)) % 5;
  const h = (i * 0.618034 + s * 0.73) % 1;
  return m > 3.5 ? 0 : m > 2.5 ? 0.25 + 0.3 * h : 0.7 + 0.3 * h;
}

const VERT = /* glsl */ `
attribute vec3 aC;
attribute vec3 aX;
attribute vec3 aY;
attribute vec4 aK;
attribute vec4 aM;
varying vec2 vUv;
varying vec2 vS;
varying vec4 vK;
varying vec4 vM;
void main() {
  vUv = position.xy + 0.5;
  vS = vec2(length(aX), length(aY));
  vK = aK;
  vM = aM;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(aC + position.x * aX + position.y * aY, 1.0);
}`;

const FRAG = /* glsl */ `
uniform float uTime;
uniform float uLight;
uniform float uOpacity;
uniform float uPer;
uniform vec3 uTint;
uniform vec3 uHot;
uniform vec3 uFg;
uniform vec3 uOk;
varying vec2 vUv;
varying vec2 vS;
varying vec4 vK; // kind, seed, lines written | rail warmth, active
varying vec4 vM; // alpha, title label shown, rail end fade
float sdBox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
float seg(vec2 p, float x0, float x1) { return length(vec2(p.x - clamp(p.x, x0, x1), p.y)); }
float ink(float d, float w) { float aa = fwidth(d); return 1.0 - smoothstep(w - aa, w + aa, d); }
float hair(float d, float px) { return 1.0 - smoothstep(0.4 * px, 1.4 * px, abs(d)); }
float lineLen(float i, float s) {
  float m = mod(i + floor(s * 5.0), 5.0);
  float h = fract(i * 0.618034 + s * 0.73);
  return m > 3.5 ? 0.0 : m > 2.5 ? 0.25 + 0.3 * h : 0.7 + 0.3 * h;
}
void main() {
  float k = vK.x;
  float act = vK.w;
  vec3 tint = mix(uTint, uHot, act);
  vec3 c = tint;
  float a = 0.0;
  if (k > 2.5) {
    // Rail: a 1px line in a soft glow; lit stretches carry ink comets to the active page.
    float y = abs(vUv.y - 0.5) * vS.y / uPer;
    float s = vUv.x * vS.x / uPer;
    float core = 1.0 - smoothstep(0.5, 1.5, y);
    float glow = exp(-y * y * 0.035);
    if (k < 3.5) {
      float ph = fract((s - uTime * 140.0) / 64.0 + vK.y);
      float comet = smoothstep(0.55, 0.96, ph) * (1.0 - smoothstep(0.96, 1.0, ph));
      a = core * 0.8 + glow * (0.18 + 0.75 * comet);
      vec3 base = mix(uTint, uHot, smoothstep(0.6, 1.0, vK.z) * vUv.x);
      c = mix(base, mix(base, vec3(1.0), 0.6 * (1.0 - uLight)), comet);
    } else {
      a = core * step(0.5, fract(s / 9.0)) * 0.4 + glow * 0.05;
      c = uTint;
    }
    a *= 1.0 - vM.z * smoothstep(0.2, 1.0, vUv.x);
  } else {
    float asp = vS.x / vS.y;
    vec2 hb = vec2(asp * 0.5, 0.5);
    vec2 q = (vUv - 0.5) * vec2(asp, 1.0);
    float px = fwidth(q.y);
    float e = k > 1.5 ? 0.0 : 0.1;
    float d = sdBox(q, hb, 0.03);
    if (e > 0.0) d = max(d, (q.x + q.y - hb.x - hb.y + e) * 0.7071);
    float body = 1.0 - smoothstep(-px, px, d);
    float rim = hair(d, px);
    float halo = exp(-max(d, 0.0) / (px * 8.0)) * (1.0 - body);
    vec2 fq = q - hb + e;
    float flap = e > 0.0 ? step(0.0, fq.x) * step(0.0, fq.y) * step(fq.x + fq.y, e) : 0.0;
    rim = max(rim, flap * max(hair(fq.x, px), hair(fq.y, px)));
    vec2 p = vec2(q.x + hb.x, hb.y - q.y); // from the top-left corner, y down
    float txt = 0.0;
    float warm = 0.0;
    float ok = 0.0;
    if (k < 0.5) {
      // Page: meta + title bars (hidden while the DOM title label sits there), then body
      // lines typed by the cursor; a full page feeds up one line at a time (typewriter).
      float m = ${PAGE.m};
      float cw = asp - 2.0 * m;
      p -= m;
      txt = (ink(seg(p - vec2(0.0, 0.02), 0.0, cw * 0.42), 0.007) * 0.6
        + ink(seg(p - vec2(0.0, 0.08), 0.0, cw * 0.95), 0.016)
        + ink(seg(p - vec2(0.0, 0.13), 0.0, cw * 0.62), 0.016)) * (1.0 - vM.y) * 0.85;
      float TOP = ${PAGE.top};
      float RH = ${PAGE.rh};
      float rows = floor((1.0 - 2.0 * m - TOP) / RH);
      float L = vK.z;
      float l0 = floor(L);
      float w0 = L - l0;
      float scroll = max(0.0, l0 - rows + smoothstep(0.0, 0.12, w0));
      float yy = p.y - TOP;
      float fi = yy / RH + scroll;
      float li = floor(fi);
      float len = lineLen(li, vK.y) * cw * clamp(L - li, 0.0, 1.0);
      float on = step(0.0, li) * step(0.0005, len) * smoothstep(0.0, RH * 0.9, yy) * (1.0 - smoothstep(rows * RH - RH * 0.4, rows * RH, yy));
      float b = ink(seg(vec2(p.x, (fract(fi) - 0.5) * RH), 0.0, len), 0.0105) * on;
      float fresh = exp(-max(L - li - 1.0, 0.0) * 1.2);
      txt = max(txt, b * (0.55 + 0.45 * fresh));
      warm = b * fresh * act;
      // The light-cursor's caret at the write head.
      vec2 cp = p - vec2(lineLen(l0, vK.y) * cw * w0 + 0.01, TOP + (l0 + 0.5 - scroll) * RH);
      float caret = (1.0 - smoothstep(0.4 * px, 1.4 * px, max(abs(cp.x) - 0.004, abs(cp.y) - RH * 0.38))) * act;
      txt = max(txt, caret);
      warm = max(warm, caret);
    } else if (k > 1.5) {
      // Build terminal: three lights on a title bar, then a build log that keeps running;
      // each line starts with a prompt tick, passing steps end in a green dot.
      float m = 0.07;
      float tb = 0.15;
      float cw = asp - 2.0 * m;
      float dots = 0.0;
      for (int i = 0; i < 3; i++) dots += ink(length(p - vec2(m + float(i) * 0.055, tb * 0.5)), 0.016);
      float RH = 0.1;
      float hgt = 1.0 - tb - 0.05 - m;
      float yy = p.y - tb - 0.05;
      float fi = yy / RH + uTime * 1.15;
      float li = floor(fi);
      vec2 rp = vec2(p.x - m, (fract(fi) - 0.5) * RH);
      float on = smoothstep(0.0, RH, yy) * (1.0 - smoothstep(hgt - RH, hgt, yy));
      float pre = ink(seg(rp, 0.0, 0.035), 0.012);
      float bar = ink(seg(rp, 0.075, 0.075 + (0.25 + 0.55 * fract(li * 0.618034 + 0.3)) * (cw - 0.12)), 0.011);
      ok = (pre + step(0.6, fract(li * 0.377 + 0.1)) * ink(length(rp - vec2(cw - 0.02, 0.0)), 0.017)) * on;
      txt = max(max(bar * on, dots) * 0.85, hair(p.y - tb, px) * 0.5);
    }
    float back = step(0.5, k) * step(k, 1.5);
    vec3 glass = mix(tint, vec3(1.0), uLight);
    vec3 txtC = mix(mix(tint, vec3(1.0), 0.5), mix(uFg, tint, 0.35), uLight);
    txtC = mix(txtC, mix(uHot, vec3(1.0), 0.25 * (1.0 - uLight)), warm);
    vec3 rimC = mix(mix(tint, vec3(1.0), 0.25), mix(tint, uFg, 0.3), uLight);
    // Glass: lit from above, a thick-edge glow inside the rim and a slow light sweep.
    float sheen = smoothstep(0.1, 0.0, abs(fract((q.x + q.y * 0.6) * 0.7 - uTime * 0.06) - 0.5) - 0.4);
    float edgeIn = exp(min(d, 0.0) / (px * 6.0)) * body;
    c = glass;
    a = body * mix((0.05 + 0.08 * act) * (0.7 + 0.6 * vUv.y) + sheen * 0.05 + edgeIn * 0.18, 0.5, uLight) * (1.0 - 0.6 * back);
    a = max(a, flap * mix(0.14, 0.3, uLight));
    c = mix(c, txtC, txt);
    a = max(a, txt * mix(0.95, 0.85, uLight));
    c = mix(c, mix(uOk, uOk * 0.8, uLight), ok);
    a = max(a, ok * 0.9);
    c = mix(c, rimC, rim);
    a = max(a, rim * mix(0.85 + 0.15 * act, 0.8, uLight) * (1.0 - 0.5 * back));
    float glowA = halo * mix(0.14 + 0.18 * act, 0.05, uLight) * (1.0 - back);
    c = mix(c, tint, glowA * (1.0 - a));
    a += glowA * (1.0 - a);
  }
  a = clamp(a * vM.x * uOpacity, 0.0, 1.0);
  if (a < 0.002) discard;
  // Encode first, then premultiply (dark: added light), so alpha reads as coverage.
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
  gl_FragColor = uLight > 0.5 ? vec4(gl_FragColor.rgb, a) : vec4(gl_FragColor.rgb * a, a);
}`;

export type Quads = ReturnType<typeof createQuads>;

/** The instanced quad batch: per-instance frame (aC, aX, aY) and params (aK, aM). */
export function createQuads(max: number) {
  const geometry = new InstancedBufferGeometry();
  const plane = new PlaneGeometry(1, 1);
  geometry.index = plane.index;
  geometry.setAttribute("position", plane.getAttribute("position"));
  const attr = (name: string, n: number) => {
    const a = new InstancedBufferAttribute(new Float32Array(max * n), n);
    a.setUsage(DynamicDrawUsage);
    geometry.setAttribute(name, a);
    return a;
  };
  const a = { C: attr("aC", 3), X: attr("aX", 3), Y: attr("aY", 3), K: attr("aK", 4), M: attr("aM", 4) };
  geometry.instanceCount = 0;
  const material = new ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uTime: { value: 0 },
      uLight: { value: 0 },
      uOpacity: { value: 1 },
      uPer: { value: 0.01 },
      uTint: { value: new Color() },
      uHot: { value: new Color() },
      uFg: { value: new Color() },
      uOk: { value: new Color() },
    },
    transparent: true,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
  });
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  return {
    mesh,
    material,
    a,
    dispose() {
      geometry.dispose();
      plane.dispose();
      material.dispose();
    },
  };
}
