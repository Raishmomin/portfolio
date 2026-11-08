// GL primitives of the FAQ scene (lazy 3D chunk): three instanced draw calls that every
// visual is built from, each backed by a morphing pool.
// - Arcs:  circles / arcs / dashed dials / filled discs drawn in the fragment shader on one
//          quad per instance (centre, Euler orientation, radius, thickness, sweep, dashes).
// - Segs:  anti-aliased screen-space lines with a glow and travelling light pulses.
// - Dots:  glow sprites (the shared Sprites of the stack scene).
// A pool keeps a current and a target value per slot; visuals write targets, the pool eases
// the current values toward them (a slot that appears flies in from an origin: the active
// question's node), so switching visuals morphs one into the next. Units: CSS px in the
// scene's local space (the rig scales the root group to world units). No per-frame allocation.
import {
  DoubleSide,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  ShaderMaterial,
  type Color,
  BufferAttribute,
} from "three";
import { GLOW_OUT, Sprites, setGlowBlending } from "../stack/gl";

/** Ease rate (1/s) while a visual morphs in, and once it has settled (tracks live motion). */
const ARC_SEGS = 96; // strip segments per arc (sub-pixel chord error up to r ≈ 400 px)
const RATE_MORPH = 5.2;
const RATE_SETTLED = 16;
const SETTLE_S = 1.3;
const STAGGER_S = 0.013;
const STAGGER_MAX = 34;

/** Current/target values per slot, eased each frame. `alpha` = index of the alpha component. */
class Pool {
  readonly cur: Float32Array;
  readonly tgt: Float32Array;
  /** Components that snap instead of easing (dash/flow counts). */
  private readonly snap: number[];
  constructor(
    readonly count: number,
    readonly stride: number,
    readonly alpha: number,
    snap: number[] = [],
  ) {
    this.cur = new Float32Array(count * stride);
    this.tgt = new Float32Array(count * stride);
    this.snap = snap;
  }

  /** Hide every slot from `from` on (targets keep their last pose: they fade in place). */
  hideFrom(from: number) {
    const { tgt, stride, alpha } = this;
    for (let i = from; i < this.count; i++) tgt[i * stride + alpha] = 0;
  }

  /**
   * Ease toward the targets. `birth(i)` prepares a slot that is appearing (current alpha 0,
   * target > 0); slots wait their stagger after a switch (`since` = s since it). `out`: the
   * outgoing visual is fading, fast, before the next one assembles.
   */
  ease(dt: number, since: number, fast: number, birth: (i: number) => void, out: boolean) {
    const { cur, tgt, stride, alpha, snap } = this;
    const settled = out || since > SETTLE_S;
    const kSlow = 1 - Math.exp(-dt * (settled ? RATE_SETTLED : RATE_MORPH));
    const kFast = 1 - Math.exp(-dt * RATE_SETTLED);
    for (let i = 0; i < this.count; i++) {
      const o = i * stride;
      const ta = tgt[o + alpha];
      if (ta <= 0.001 && cur[o + alpha] <= 0.001) {
        cur[o + alpha] = 0;
        continue;
      }
      if (i >= fast && !settled && since < Math.min(i - fast, STAGGER_MAX) * STAGGER_S) continue;
      if (cur[o + alpha] <= 0.004 && ta > 0.004) birth(i);
      const k = i < fast || out ? kFast : kSlow;
      for (let c = 0; c < stride; c++) cur[o + c] += (tgt[o + c] - cur[o + c]) * k;
      for (const c of snap) cur[o + c] = tgt[o + c];
    }
  }
}

// ---------------------------------------------------------------- arcs
// Per instance: aC centre · aE Euler XYZ · aR (radius, thickness, start, end in turns from
// 12 o'clock, clockwise) · aCol · aA (alpha, dashes (see `dashes`), tail gradient 0..1,
// glow 0..1).
export const ARC = { cx: 0, ex: 3, rad: 6, thick: 7, start: 8, end: 9, r: 10, alpha: 13, dash: 14, tail: 15, glow: 16, stride: 17 } as const;

const ARC_VERT = /* glsl */ `
  attribute vec3 aC;
  attribute vec3 aE;
  attribute vec4 aR;
  attribute vec3 aCol;
  attribute vec4 aA;
  varying vec2 vP;
  varying vec4 vR;
  varying vec3 vCol;
  varying vec4 vA;
  mat3 rotE(vec3 e) {
    float cx = cos(e.x), sx = sin(e.x), cy = cos(e.y), sy = sin(e.y), cz = cos(e.z), sz = sin(e.z);
    mat3 rx = mat3(1.0, 0.0, 0.0, 0.0, cx, sx, 0.0, -sx, cx);
    mat3 ry = mat3(cy, 0.0, -sy, 0.0, 1.0, 0.0, sy, 0.0, cy);
    mat3 rz = mat3(cz, sz, 0.0, -sz, cz, 0.0, 0.0, 0.0, 1.0);
    return rx * ry * rz;
  }
  void main() {
    float ext = aR.y * (0.5 + 2.5 * aA.w) + 3.0;
    float span = aR.w - aR.z;
    float a0 = 0.0;
    float a1 = 1.0;
    if (span < 0.999) {
      float cap = ext / (6.2831853 * max(aR.x, 1.0));
      a0 = aR.z - cap;
      a1 = aR.w + cap;
    }
    float ang = (a0 + (a1 - a0) * position.x) * 6.2831853;
    float rad = max(0.0, aR.x + position.y * ext);
    vec2 p = vec2(sin(ang), cos(ang)) * rad;
    vP = p;
    vR = aR;
    vCol = aCol;
    vA = aA;
    vec3 local = rotE(aE) * vec3(p, 0.0) + aC;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(local, 1.0);
  }
`;
const ARC_FRAG = /* glsl */ `
  uniform float uOpacity;
  uniform float uLight;
  varying vec2 vP;
  varying vec4 vR;
  varying vec3 vCol;
  varying vec4 vA;
  void main() {
    float span = vR.w - vR.z;
    if (vA.x <= 0.002 || span <= 0.0008) discard;
    float r = length(vP);
    float aa = max(fwidth(r), 1e-3);
    float hw = vR.y * 0.5;
    float d = abs(r - vR.x);
    float t = fract(atan(vP.x, vP.y) / 6.2831853 + 1.0);
    float u = t;
    float outPx = 0.0;
    if (span < 0.999) {
      float rel = fract(t - vR.z + 1.0);
      float outA = rel <= span ? 0.0 : min(rel - span, 1.0 - rel);
      outPx = outA * 6.2831853 * vR.x;
      u = rel <= span ? rel / span : (rel - span < 1.0 - rel ? 1.0 : 0.0);
    }
    float dc = outPx > 0.0 ? length(vec2(outPx, d)) : d;
    float core = 1.0 - smoothstep(hw - aa * 0.6, hw + aa * 0.6, dc);
    float gd = max(dc - hw, 0.0);
    float glow = vA.w * exp(-pow(gd / max(vR.y * 1.4, 1.5), 2.0) * 2.2) * (uLight > 0.5 ? 0.25 : 0.55);
    float dash = 1.0;
    if (vA.y >= 1.0) {
      float n = floor(vA.y) * 0.1;
      float duty = fract(vA.y);
      float pos = span < 0.999 ? fract(t - vR.z + 1.0) : t;
      float f = fract(pos * n);
      float de = aa * n / max(r * 6.2831853, 1.0);
      dash = smoothstep(0.0, de, f) * (1.0 - smoothstep(duty - de, duty + de, f));
    }
    float tail = mix(1.0, u * u, vA.z);
    float a = min(1.0, (core + glow) * dash * tail * vA.x * (uLight > 0.5 ? 1.45 : 1.0)) * uOpacity;
    if (a < 0.002) discard;
    vec3 c = uLight > 0.5 ? vCol : vCol * (1.0 + 0.35 * core);
    ${GLOW_OUT}
  }
`;

// ---------------------------------------------------------------- segments
// Per instance: aA, aB ends · aCol · aP (alpha, width px, flow speed, flow pulses).
export const SEG = { ax: 0, bx: 3, r: 6, alpha: 9, width: 10, speed: 11, flow: 12, stride: 13 } as const;

const SEG_VERT = /* glsl */ `
  uniform vec2 uRes;
  attribute vec3 aA;
  attribute vec3 aB;
  attribute vec3 aCol;
  attribute vec4 aP;
  varying float vT;
  varying float vS;
  varying vec3 vCol;
  varying vec4 vP;
  void main() {
    vec4 ca = projectionMatrix * modelViewMatrix * vec4(aA, 1.0);
    vec4 cb = projectionMatrix * modelViewMatrix * vec4(aB, 1.0);
    vec2 h = uRes * 0.5;
    vec2 sa = ca.xy / ca.w * h;
    vec2 sb = cb.xy / cb.w * h;
    vec2 dir = sb - sa;
    float len = length(dir);
    dir = len > 1e-4 ? dir / len : vec2(1.0, 0.0);
    vec2 n = vec2(-dir.y, dir.x);
    float hw = aP.y * 0.5 + 1.5;
    vec4 c = mix(ca, cb, position.x);
    c.xy += (n * position.y * hw) / h * c.w;
    gl_Position = c;
    vT = position.x;
    vS = position.y * hw;
    vCol = aCol;
    vP = aP;
  }
`;
const SEG_FRAG = /* glsl */ `
  uniform float uOpacity;
  uniform float uLight;
  uniform float uTime;
  varying float vT;
  varying float vS;
  varying vec3 vCol;
  varying vec4 vP;
  void main() {
    if (vP.x <= 0.002) discard;
    float hw = vP.y * 0.5;
    float d = abs(vS);
    float core = 1.0 - smoothstep(hw - 0.7, hw + 0.7, d);
    float glow = exp(-d * d / (hw * hw * 5.0 + 2.0)) * (uLight > 0.5 ? 0.18 : 0.4);
    float base = 1.0;
    float hot = 0.0;
    if (vP.w >= 1.0) {
      float f = fract(vT * vP.w - uTime * vP.z);
      hot = smoothstep(0.0, 0.08, f) * (1.0 - smoothstep(0.08, 0.32, f));
      base = 0.42 + 1.5 * hot;
    }
    float a = min(1.0, (core + glow) * base * vP.x * (uLight > 0.5 ? 1.6 : 1.0)) * uOpacity;
    if (a < 0.002) discard;
    vec3 c = uLight > 0.5 ? vCol : mix(vCol, vec3(1.0), hot * 0.35);
    ${GLOW_OUT}
  }
`;

function copy(from: Float32Array, to: Float32Array, o: number, n: number) {
  for (let c = 0; c < n; c++) to[o + c] = from[o + c];
}

function instanced(geo: InstancedBufferGeometry, name: string, arr: Float32Array, n: number) {
  const a = new InstancedBufferAttribute(arr, n);
  a.setUsage(DynamicDrawUsage);
  geo.setAttribute(name, a);
  return a;
}

export class FaqGL {
  readonly dots: Pool;
  readonly arcs: Pool;
  readonly segs: Pool;
  readonly sprites: Sprites;
  readonly arcMesh: Mesh;
  readonly segMesh: Mesh;
  private readonly arcGeo = new InstancedBufferGeometry();
  private readonly segGeo = new InstancedBufferGeometry();
  readonly arcMat: ShaderMaterial;
  readonly segMat: ShaderMaterial;
  private readonly arcAttr: { c: InstancedBufferAttribute; e: InstancedBufferAttribute; r: InstancedBufferAttribute; col: InstancedBufferAttribute; a: InstancedBufferAttribute };
  private readonly segAttr: { a: InstancedBufferAttribute; b: InstancedBufferAttribute; col: InstancedBufferAttribute; p: InstancedBufferAttribute };

  constructor(nDots: number, nArcs: number, nSegs: number) {
    // Dots: x y z · r g b · size(px) · alpha
    this.dots = new Pool(nDots, 8, 7);
    this.arcs = new Pool(nArcs, ARC.stride, ARC.alpha, [ARC.dash]);
    this.segs = new Pool(nSegs, SEG.stride, SEG.alpha, [SEG.flow]);
    this.sprites = new Sprites(nDots, { core: 0.22, halo: 0.95, renderOrder: 3 });

    const strip = new Float32Array((ARC_SEGS + 1) * 2 * 3);
    const idx: number[] = [];
    for (let i = 0; i <= ARC_SEGS; i++) {
      strip.set([i / ARC_SEGS, -1, 0, i / ARC_SEGS, 1, 0], i * 6);
      if (i < ARC_SEGS) idx.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 2, 2 * i + 1, 2 * i + 3);
    }
    this.arcGeo.setIndex(idx);
    this.arcGeo.setAttribute("position", new BufferAttribute(strip, 3));
    this.arcGeo.instanceCount = nArcs;
    this.arcAttr = {
      c: instanced(this.arcGeo, "aC", new Float32Array(nArcs * 3), 3),
      e: instanced(this.arcGeo, "aE", new Float32Array(nArcs * 3), 3),
      r: instanced(this.arcGeo, "aR", new Float32Array(nArcs * 4), 4),
      col: instanced(this.arcGeo, "aCol", new Float32Array(nArcs * 3), 3),
      a: instanced(this.arcGeo, "aA", new Float32Array(nArcs * 4), 4),
    };
    this.arcMat = new ShaderMaterial({
      vertexShader: ARC_VERT,
      fragmentShader: ARC_FRAG,
      uniforms: { uOpacity: { value: 1 }, uLight: { value: 0 } },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
      side: DoubleSide,
    });
    this.arcMesh = new Mesh(this.arcGeo, this.arcMat);
    this.arcMesh.frustumCulled = false;
    this.arcMesh.renderOrder = 1;

    // Segment quad: x = 0 (end A) / 1 (end B), y = -1 / +1 (side).
    this.segGeo.setIndex([0, 1, 2, 2, 1, 3]);
    this.segGeo.setAttribute("position", new BufferAttribute(new Float32Array([0, -1, 0, 1, -1, 0, 0, 1, 0, 1, 1, 0]), 3));
    this.segGeo.instanceCount = nSegs;
    this.segAttr = {
      a: instanced(this.segGeo, "aA", new Float32Array(nSegs * 3), 3),
      b: instanced(this.segGeo, "aB", new Float32Array(nSegs * 3), 3),
      col: instanced(this.segGeo, "aCol", new Float32Array(nSegs * 3), 3),
      p: instanced(this.segGeo, "aP", new Float32Array(nSegs * 4), 4),
    };
    this.segMat = new ShaderMaterial({
      vertexShader: SEG_VERT,
      fragmentShader: SEG_FRAG,
      uniforms: { uOpacity: { value: 1 }, uLight: { value: 0 }, uTime: { value: 0 }, uRes: { value: [1, 1] } },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
      side: DoubleSide,
    });
    this.segMesh = new Mesh(this.segGeo, this.segMat);
    this.segMesh.frustumCulled = false;
    this.segMesh.renderOrder = 2;
    this.sprites.material.depthTest = false;
  }

  private light = false;

  setLight(light: boolean) {
    this.light = light;
    ink = light ? 1.5 : 1;
    for (const m of [this.arcMat, this.segMat, this.sprites.material]) {
      setGlowBlending(m, light);
      m.uniforms.uLight.value = light ? 1 : 0;
    }
  }

  setOpacity(o: number) {
    this.arcMat.uniforms.uOpacity.value = o;
    this.segMat.uniforms.uOpacity.value = o;
    this.sprites.material.uniforms.uOpacity.value = o;
  }

  /** Ease every pool; `fast` = slots per pool that track the page (the question nodes). */
  ease(dt: number, since: number, fast: number, ox: number, oy: number, oz: number, out: boolean) {
    const D = this.dots;
    D.ease(dt, since, fast, (i) => {
      const o = i * 8;
      copy(D.tgt, D.cur, o, 8);
      if (i >= fast) {
        D.cur[o] = ox;
        D.cur[o + 1] = oy;
        D.cur[o + 2] = oz;
      }
      D.cur[o + 6] = 0;
      D.cur[o + 7] = 0;
    }, out);
    const A = this.arcs;
    A.ease(dt, since, fast, (i) => {
      const o = i * ARC.stride;
      copy(A.tgt, A.cur, o, ARC.stride);
      A.cur[o + ARC.end] = A.cur[o + ARC.start];
      A.cur[o + ARC.rad] *= 0.55;
      A.cur[o + ARC.alpha] = 0;
    }, out);
    const S = this.segs;
    S.ease(dt, since, fast, (i) => {
      const o = i * SEG.stride;
      copy(S.tgt, S.cur, o, SEG.stride);
      S.cur[o + 3] = S.cur[o];
      S.cur[o + 4] = S.cur[o + 1];
      S.cur[o + 5] = S.cur[o + 2];
      S.cur[o + SEG.alpha] = 0;
    }, out);
  }

  /** Copy the current values into the GPU attributes. */
  upload(perPx: number, resW: number, resH: number, time: number) {
    const sp = this.sprites;
    const d = this.dots.cur;
    for (let i = 0; i < this.dots.count; i++) {
      const o = i * 8;
      sp.pos[i * 3] = d[o];
      sp.pos[i * 3 + 1] = d[o + 1];
      sp.pos[i * 3 + 2] = d[o + 2];
      sp.color[i * 3] = d[o + 3];
      sp.color[i * 3 + 1] = d[o + 4];
      sp.color[i * 3 + 2] = d[o + 5];
      sp.size[i] = d[o + 6];
      sp.alpha[i] = d[o + 7];
    }
    sp.material.uniforms.uSize.value = perPx * (this.light ? 1.35 : 1);
    sp.flush();

    const a = this.arcs.cur;
    const A = this.arcAttr;
    const ac = A.c.array as Float32Array;
    const ae = A.e.array as Float32Array;
    const ar = A.r.array as Float32Array;
    const acol = A.col.array as Float32Array;
    const aa = A.a.array as Float32Array;
    for (let i = 0; i < this.arcs.count; i++) {
      const o = i * ARC.stride;
      ac[i * 3] = a[o];
      ac[i * 3 + 1] = a[o + 1];
      ac[i * 3 + 2] = a[o + 2];
      ae[i * 3] = a[o + 3];
      ae[i * 3 + 1] = a[o + 4];
      ae[i * 3 + 2] = a[o + 5];
      ar[i * 4] = a[o + ARC.rad];
      ar[i * 4 + 1] = a[o + ARC.thick];
      ar[i * 4 + 2] = a[o + ARC.start];
      ar[i * 4 + 3] = a[o + ARC.end];
      acol[i * 3] = a[o + 10];
      acol[i * 3 + 1] = a[o + 11];
      acol[i * 3 + 2] = a[o + 12];
      aa[i * 4] = a[o + ARC.alpha];
      aa[i * 4 + 1] = a[o + ARC.dash];
      aa[i * 4 + 2] = a[o + ARC.tail];
      aa[i * 4 + 3] = a[o + ARC.glow];
    }
    for (const attr of [A.c, A.e, A.r, A.col, A.a]) attr.needsUpdate = true;

    const s = this.segs.cur;
    const S = this.segAttr;
    const sa = S.a.array as Float32Array;
    const sb = S.b.array as Float32Array;
    const scol = S.col.array as Float32Array;
    const sprm = S.p.array as Float32Array;
    for (let i = 0; i < this.segs.count; i++) {
      const o = i * SEG.stride;
      sa[i * 3] = s[o];
      sa[i * 3 + 1] = s[o + 1];
      sa[i * 3 + 2] = s[o + 2];
      sb[i * 3] = s[o + 3];
      sb[i * 3 + 1] = s[o + 4];
      sb[i * 3 + 2] = s[o + 5];
      scol[i * 3] = s[o + 6];
      scol[i * 3 + 1] = s[o + 7];
      scol[i * 3 + 2] = s[o + 8];
      sprm[i * 4] = s[o + SEG.alpha];
      sprm[i * 4 + 1] = s[o + SEG.width];
      sprm[i * 4 + 2] = s[o + SEG.speed];
      sprm[i * 4 + 3] = s[o + SEG.flow];
    }
    for (const attr of [S.a, S.b, S.col, S.p]) attr.needsUpdate = true;
    const res = this.segMat.uniforms.uRes.value as number[];
    res[0] = resW;
    res[1] = resH;
    this.segMat.uniforms.uTime.value = time;
  }

  dispose() {
    this.sprites.dispose();
    this.arcGeo.dispose();
    this.segGeo.dispose();
    this.arcMat.dispose();
    this.segMat.dispose();
  }
}

// ---------------------------------------------------------------- writers (targets)

/**
 * Paper needs more ink than light on dark: thin strokes get heavier in the light theme and
 * glass (wide, faint strokes) more opaque, since dark mode's sRGB output already lifts it.
 */
let ink = 1;

/** Arc dash pattern: `perTurn` dashes per full turn, counted from the arc's start, each `duty` long. */
export const dashes = (perTurn: number, duty: number) => Math.round(perTurn * 10) + Math.min(0.99, duty);

/** Glow dot target: position (local px), colour, size (px), alpha. */
export function dot(gl: FaqGL, i: number, x: number, y: number, z: number, c: Color, size: number, alpha: number) {
  const t = gl.dots.tgt;
  const o = i * 8;
  t[o] = x;
  t[o + 1] = y;
  t[o + 2] = z;
  t[o + 3] = c.r;
  t[o + 4] = c.g;
  t[o + 5] = c.b;
  t[o + 6] = size;
  t[o + 7] = alpha;
}

/** Arc target. Sweep in turns from 12 o'clock clockwise (end - start ≥ 1 = full circle). */
export function arc(
  gl: FaqGL,
  i: number,
  x: number,
  y: number,
  z: number,
  ex: number,
  ey: number,
  ez: number,
  radius: number,
  thick: number,
  start: number,
  end: number,
  c: Color,
  alpha: number,
  dash = 0,
  tail = 0,
  glow = 0.6,
) {
  const t = gl.arcs.tgt;
  const o = i * ARC.stride;
  t[o] = x;
  t[o + 1] = y;
  t[o + 2] = z;
  t[o + 3] = ex;
  t[o + 4] = ey;
  t[o + 5] = ez;
  t[o + ARC.rad] = radius;
  t[o + ARC.thick] = thick < 4 ? thick * ink : thick;
  t[o + ARC.start] = start;
  t[o + ARC.end] = end;
  t[o + 10] = c.r;
  t[o + 11] = c.g;
  t[o + 12] = c.b;
  t[o + ARC.alpha] = thick >= 4 && ink > 1 ? Math.min(1, alpha * 3.2) : alpha;
  t[o + ARC.dash] = dash;
  t[o + ARC.tail] = tail;
  t[o + ARC.glow] = glow;
}

/** Segment target from A to B; flow = pulses along it (0 = none), speed in lengths/s. */
export function seg(
  gl: FaqGL,
  i: number,
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  c: Color,
  alpha: number,
  width: number,
  flow = 0,
  speed = 0.5,
) {
  const t = gl.segs.tgt;
  const o = i * SEG.stride;
  t[o] = ax;
  t[o + 1] = ay;
  t[o + 2] = az;
  t[o + 3] = bx;
  t[o + 4] = by;
  t[o + 5] = bz;
  t[o + 6] = c.r;
  t[o + 7] = c.g;
  t[o + 8] = c.b;
  t[o + SEG.alpha] = width >= 4 && ink > 1 ? Math.min(1, alpha * 3.2) : alpha;
  t[o + SEG.width] = width < 4 ? width * ink : width;
  t[o + SEG.speed] = speed;
  t[o + SEG.flow] = flow;
}
