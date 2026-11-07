// The experience timeline as plain three.js objects driven by `frame()` (no per-frame
// React work or allocation). Every frame the path is laid out in screen space and lifted
// into the world through the live camera (path.ts), so it is immune to the stage's
// composition blend:
// - home journey (live [data-hscroll]): each milestone ring sits on its role's rail dot
//   ([data-exp-node]) while the track moves, the trail head follows the track's reading line
//   (--hscroll-line, the same line that lights the DOM rail), and the floor grid and dust
//   slide with the track so the camera seems to travel along the path;
// - elsewhere (phones, subpages, static layout): laid out in the free rect the director
//   measured for the scene (framing.sceneFrames), shrunk by the visibility guard
//   (framing.clearRect) so it never sits under content, and faded out when no room is left.
// Data packets run along the drawn trail; the current role pulses in the status colour.
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  PlaneGeometry,
  Quaternion,
  ShaderMaterial,
  TorusGeometry,
  Vector3,
  type Camera,
  type PerspectiveCamera,
} from "three";
import { clearRect, framing, sceneFrames, type Rect } from "../../framing";
import type { ScenePalette } from "../../types";
import { GLOW_OUT, Sprites, clamp01, hash01, isLightBg, paletteColor, setGlowBlending, smooth01 } from "../stack/gl";
import type { LabelLayer } from "../stack/labels";
import { MAX_POINTS, PATH_GLSL, evalPath, fillArcs, milestoneS, screenPath, type Timeline } from "./path";

const TAIL_N = 22;
const PACKETS = 6;
const DUST_N = 110;
const WAVE_S = 1.1; // s per activation shockwave
const PULSE_EVERY = 2.4; // s between the current role's pulses
const RING_PX = 24; // ring radius on screen at full size
const RIBBON_PX = 15; // half-width of the trail's glow on screen
const HEADER_PX = 64; // the site header: never lay the free path under it

// Ribbon: a camera-facing strip along the spline (positions computed in the vertex shader
// from the control-point uniforms). Drawn part: bright core + glow + shimmer; the part
// still to come: a thin dashed line. Faded at the viewport edges like the DOM track.
const RIBBON_VERT = /* glsl */ `
  ${PATH_GLSL}
  uniform float uWidth;
  attribute float aS;
  attribute float aSide;
  varying float vS;
  varying float vSide;
  void main() {
    float s = aS * (uN - 1.0);
    vec3 p = pathAt(s);
    vec3 t = pathAt(s + 0.01) - pathAt(s - 0.01);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vec3 tv = mat3(modelViewMatrix) * t;
    vec3 side = cross(tv, mv.xyz);
    float l = length(side);
    side = l > 1e-6 ? side / l : vec3(0.0, 1.0, 0.0);
    mv.xyz += side * aSide * uWidth;
    vS = s;
    vSide = aSide;
    gl_Position = projectionMatrix * mv;
  }
`;
const RIBBON_FRAG = /* glsl */ `
  uniform float uHead;
  uniform float uTime;
  uniform float uOpacity;
  uniform float uLight;
  uniform float uCore;
  uniform float uDash;
  uniform float uTodoA;
  uniform vec2 uEdge;
  uniform vec3 uColor;
  uniform vec3 uHot;
  uniform vec3 uTodo;
  varying float vS;
  varying float vSide;
  void main() {
    float d = abs(vSide);
    float aa = fwidth(vSide) * 1.2;
    float core = 1.0 - smoothstep(uCore - aa, uCore + aa, d);
    float glow = exp(-d * d * 4.5) * (uLight > 0.5 ? 0.45 : 1.0);
    float a;
    vec3 c;
    if (vS <= uHead) {
      float near = smoothstep(uHead - 1.4, uHead, vS);
      float shimmer = 0.5 + 0.5 * sin(vS * 36.0 - uTime * 5.0);
      a = core * (0.82 + 0.18 * near) + glow * (0.14 + 0.32 * near + 0.07 * shimmer);
      c = mix(uColor, uHot, near * 0.45 + core * 0.25);
    } else {
      float dash = step(0.5, fract(vS * uDash));
      a = core * dash * (uLight > 0.5 ? 0.5 : 0.3) * uTodoA;
      c = uTodo;
    }
    float x = gl_FragCoord.x;
    a *= uOpacity * smoothstep(0.0, uEdge.x, x) * smoothstep(0.0, uEdge.x, uEdge.y - x);
    ${GLOW_OUT}
  }
`;

const RING_VERT = /* glsl */ `
  attribute vec3 aColor;
  attribute float aAlpha;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vFacing;
  void main() {
    vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    vec3 n = normalize(normalMatrix * mat3(instanceMatrix) * normal);
    vFacing = abs(dot(n, normalize(-mv.xyz)));
    vColor = aColor;
    vAlpha = aAlpha;
    gl_Position = projectionMatrix * mv;
  }
`;
const RING_FRAG = /* glsl */ `
  uniform float uOpacity;
  uniform float uLight;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vFacing;
  void main() {
    if (vAlpha <= 0.001) discard;
    float a = vAlpha * uOpacity * (0.55 + 0.45 * vFacing);
    vec3 c = vColor * (uLight > 0.5 ? 1.0 : 0.8 + 0.6 * vFacing);
    ${GLOW_OUT}
  }
`;

// Floor: a ground plane from the rail line (z = 0) back into depth. Its grid is in world
// x shifted by uOff (the distance travelled), so the lines slide with the track at the
// front and slower further back: the camera seems to truck along the path.
const FLOOR_VERT = /* glsl */ `
  varying vec3 vW;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
const FLOOR_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uLight;
  uniform float uOff;
  uniform float uCell;
  uniform vec2 uEdge;
  varying vec3 vW;
  float lines(vec2 p) {
    vec2 g = abs(fract(p - 0.5) - 0.5) / fwidth(p);
    return 1.0 - min(min(g.x, g.y), 1.0);
  }
  void main() {
    vec2 p = vec2(vW.x + uOff, vW.z) / uCell;
    float depth = -vW.z;
    float fade = exp(-depth * 0.08) * smoothstep(0.0, 0.8, depth);
    float a = max(lines(p) * 0.55, lines(p * 0.25)) * fade * uOpacity * (uLight > 0.5 ? 0.38 : 0.2);
    float x = gl_FragCoord.x;
    a *= smoothstep(0.0, uEdge.x, x) * smoothstep(0.0, uEdge.x, uEdge.y - x);
    vec3 c = uColor;
    ${GLOW_OUT}
  }
`;

// Scratch objects (module level: no per-frame allocation).
const v0 = new Vector3();
const v1 = new Vector3();
const v2 = new Vector3();
const ray = new Vector3();
const Z = new Vector3(0, 0, 1);
const sc = new Vector3();
const q0 = new Quaternion();
const m4 = new Matrix4();
const ID = new Matrix4();
const pxRect: Rect = { l: 0, t: 0, r: 0, b: 0 };
const clear: Rect = { l: 0, t: 0, r: 0, b: 0 };

type Layout = { live: boolean; edge: number; scale: number; target: number; travel: number; line: number };

const smooth = (a: number, b: number, x: number) => smooth01((x - a) / (b - a));
const pxVar = (el: HTMLElement, name: string) => parseFloat(el.style.getPropertyValue(name));

export class ExperienceRig {
  /** Everything, in world space (the path is placed through the camera each frame). */
  readonly root = new Group();

  private readonly tl: Timeline;
  private readonly n: number;
  private readonly ribbon: Mesh;
  private readonly ribbonMat: ShaderMaterial;
  private readonly pts: Float32Array;
  private readonly uP: Vector3[];
  private readonly sp = screenPath();
  private readonly rings: InstancedMesh;
  private readonly waves: InstancedMesh;
  private readonly ringMat: ShaderMaterial;
  private readonly waveMat: ShaderMaterial;
  private readonly ringColor: InstancedBufferAttribute;
  private readonly ringAlpha: InstancedBufferAttribute;
  private readonly waveColor: InstancedBufferAttribute;
  private readonly waveAlpha: InstancedBufferAttribute;
  private readonly floor: Mesh;
  private readonly floorMat: ShaderMaterial;
  private readonly sprites: Sprites;
  private readonly dust: Sprites;
  private readonly dustSeed: Float32Array;
  private readonly reached: boolean[];
  private readonly waveStart: Float32Array;
  /** Screen x of each milestone this frame (edge fades, label spacing; QA). */
  private readonly mx: Float32Array;
  private readonly my: Float32Array;
  // sprite index ranges
  private readonly sNode = 0;
  private readonly sNow: number;
  private readonly sHead: number;
  private readonly sTail: number;
  private readonly sPack: number;
  private readonly sTick: number;
  private colPast = new Color();
  private colNow = new Color();
  private colTodo = new Color();
  private colTrail = new Color();
  private colTick = new Color();
  private head = -1;
  private room = 0;
  private seenAt = -1;
  private labels: LabelLayer | null = null;
  private label0 = 0;
  private palette: ScenePalette | null = null;
  // DOM anchors of the driving section (re-queried when it changes)
  private host: HTMLElement | null = null;
  private nodes: HTMLElement[] = [];
  private track: HTMLElement | null = null;
  private rail: HTMLElement | null = null;

  constructor(tl: Timeline, quality: "high" | "low") {
    this.tl = tl;
    const M = tl.milestones.length;
    this.n = M;
    const hi = quality === "high";

    // Ribbon strip: SEG segments along the path, two vertices across.
    const SEG = hi ? 900 : 480;
    const s = new Float32Array((SEG + 1) * 2);
    const side = new Float32Array((SEG + 1) * 2);
    const pos = new Float32Array((SEG + 1) * 2 * 3);
    const index: number[] = [];
    for (let i = 0; i <= SEG; i++) {
      s[i * 2] = s[i * 2 + 1] = i / SEG;
      side[i * 2] = -1;
      side[i * 2 + 1] = 1;
      if (i < SEG) {
        const a = i * 2;
        index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const rg = new BufferGeometry();
    rg.setAttribute("position", new BufferAttribute(pos, 3));
    rg.setAttribute("aS", new BufferAttribute(s, 1));
    rg.setAttribute("aSide", new BufferAttribute(side, 1));
    rg.setIndex(index);
    this.pts = new Float32Array(MAX_POINTS * 3);
    this.uP = Array.from({ length: MAX_POINTS }, () => new Vector3());
    this.ribbonMat = new ShaderMaterial({
      vertexShader: RIBBON_VERT,
      fragmentShader: RIBBON_FRAG,
      uniforms: {
        uP: { value: this.uP },
        uN: { value: Math.max(2, tl.count) },
        uWidth: { value: 0.15 },
        uHead: { value: 0 },
        uTime: { value: 0 },
        uOpacity: { value: 1 },
        uLight: { value: 0 },
        uCore: { value: 0.16 },
        uDash: { value: 14 },
        uTodoA: { value: 1 },
        uEdge: { value: [1, 1] },
        uColor: { value: new Color() },
        uHot: { value: new Color() },
        uTodo: { value: new Color() },
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
      side: DoubleSide, // the strip's winding flips with the path's direction on screen
    });
    this.ribbon = new Mesh(rg, this.ribbonMat);
    this.ribbon.frustumCulled = false;
    this.ribbon.renderOrder = 3;

    // Milestone rings (and their shockwaves): unit tori, scaled to RING_PX on screen.
    const ringMesh = (tube: number) => {
      const g = new TorusGeometry(1, tube, hi ? 12 : 8, hi ? 96 : 64);
      const color = new InstancedBufferAttribute(new Float32Array(Math.max(1, M) * 3), 3);
      const alpha = new InstancedBufferAttribute(new Float32Array(Math.max(1, M)), 1);
      color.setUsage(DynamicDrawUsage);
      alpha.setUsage(DynamicDrawUsage);
      g.setAttribute("aColor", color);
      g.setAttribute("aAlpha", alpha);
      const mat = new ShaderMaterial({
        vertexShader: RING_VERT,
        fragmentShader: RING_FRAG,
        uniforms: { uOpacity: { value: 1 }, uLight: { value: 0 } },
        transparent: true,
        depthWrite: false,
        depthTest: false,
        toneMapped: false,
      });
      const mesh = new InstancedMesh(g, mat, Math.max(1, M));
      mesh.instanceMatrix.setUsage(DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.renderOrder = 4;
      return { mesh, mat, color, alpha };
    };
    const r = ringMesh(0.05);
    const w = ringMesh(0.022);
    this.rings = r.mesh;
    this.ringMat = r.mat;
    this.ringColor = r.color;
    this.ringAlpha = r.alpha;
    this.waves = w.mesh;
    this.waveMat = w.mat;
    this.waveColor = w.color;
    this.waveAlpha = w.alpha;
    this.reached = tl.milestones.map(() => false);
    this.waveStart = new Float32Array(Math.max(1, M)).fill(-1e9);
    this.mx = new Float32Array(Math.max(1, M));
    this.my = new Float32Array(Math.max(1, M));

    // Ground plane from the rail line back into depth.
    this.floorMat = new ShaderMaterial({
      vertexShader: FLOOR_VERT,
      fragmentShader: FLOOR_FRAG,
      uniforms: {
        uColor: { value: new Color() },
        uOpacity: { value: 1 },
        uLight: { value: 0 },
        uOff: { value: 0 },
        uCell: { value: 1 },
        uEdge: { value: [1, 1] },
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
    });
    const fg = new PlaneGeometry(90, 40);
    fg.rotateX(-Math.PI / 2);
    fg.translate(0, 0, -20);
    this.floor = new Mesh(fg, this.floorMat);
    this.floor.renderOrder = 0;
    this.floor.frustumCulled = false;

    // Sprites: milestone halos, the "now" cap, the head, its comet tail, data packets and
    // one tick per quarter-year.
    this.sNow = M;
    this.sHead = this.sNow + 1;
    this.sTail = this.sHead + 1;
    this.sPack = this.sTail + TAIL_N;
    this.sTick = this.sPack + PACKETS;
    this.sprites = new Sprites(this.sTick + tl.ticks.length, { core: 0.22, halo: 0.9, renderOrder: 5 });

    // Ambient dust in the band (normalised seeds; placed every frame around the camera).
    const dn = hi ? DUST_N : DUST_N >> 1;
    this.dust = new Sprites(dn, { core: 0.18, halo: 0.6, renderOrder: 1 });
    this.dustSeed = new Float32Array(dn * 3);
    for (let i = 0; i < dn; i++) {
      this.dustSeed[i * 3] = hash01(`d${i}`, 1);
      this.dustSeed[i * 3 + 1] = hash01(`d${i}`, 2);
      this.dustSeed[i * 3 + 2] = hash01(`d${i}`, 3);
      this.dust.alpha[i] = 0.18 + hash01(`d${i}`, 5) * 0.32;
    }
    this.dust.flush(8);

    this.root.add(this.floor, this.dust.mesh, this.ribbon, this.rings, this.waves, this.sprites.mesh);
    this.root.visible = false;
  }

  setPalette(p: ScenePalette) {
    this.palette = p;
    const light = isLightBg(p.bg);
    this.colTrail = paletteColor(p.accent);
    this.colPast = paletteColor(p.accent, p.fg, light ? 0.1 : 0.25);
    this.colNow = paletteColor(p.ok);
    this.colTodo = paletteColor(p.muted, p.bg, light ? 0.2 : 0.35);
    this.colTick = paletteColor(p.fg, p.bg, light ? 0.35 : 0.2);
    const u = this.ribbonMat.uniforms;
    (u.uColor.value as Color).copy(this.colTrail);
    (u.uHot.value as Color).copy(light ? paletteColor(p.accent, p.fg, 0.25) : paletteColor(p.accent, "#ffffff", 0.55));
    (u.uTodo.value as Color).copy(paletteColor(p.fg, p.bg, light ? 0.45 : 0.4));
    (this.floorMat.uniforms.uColor.value as Color).copy(paletteColor(light ? p.muted : p.fg, p.bg, light ? 0.3 : 0.5));
    const dustCol = paletteColor(p.ai, p.fg, 0.3);
    for (let i = 0; i < this.dust.count; i++) this.dust.setColor(i, dustCol);
    this.dust.flush(2);
    for (const m of [this.ribbonMat, this.ringMat, this.waveMat, this.floorMat, this.sprites.material, this.dust.material]) {
      m.uniforms.uLight.value = light ? 1 : 0;
      setGlowBlending(m, light);
    }
    this.styleLabels();
  }

  attachLabels(layer: LabelLayer | null) {
    this.labels = layer;
    if (!layer) return;
    this.label0 = -1;
    this.tl.milestones.forEach((m) => {
      // Below-right of the ring, beside its stem: the trail arrives from above and leaves
      // upward, so this corner stays clear of it.
      const a = layer.add(`${m.company} · ${m.years}`, "font-size:11px;line-height:14px;letter-spacing:0.02em;", "font-mono", { x: 0, y: 0 });
      layer.add(m.role, "font-size:10px;line-height:13px;letter-spacing:0.02em;", "font-mono", { x: 0, y: 0, dy: 15 });
      if (this.label0 < 0) this.label0 = a;
    });
    this.styleLabels();
  }

  private styleLabels() {
    const layer = this.labels;
    const p = this.palette;
    if (!layer || !p) return;
    const shadow = `0 0 3px ${p.bg}, 0 0 8px ${p.bg}, 0 0 14px ${p.bg}`;
    this.tl.milestones.forEach((m, i) => {
      layer.style(this.label0 + i * 2, { color: m.current ? p.ok : p.fg, textShadow: shadow, fontWeight: m.current ? "600" : "400" });
      layer.style(this.label0 + i * 2 + 1, { color: p.muted, textShadow: shadow });
    });
  }

  /** The driving section's DOM anchors (rail dots, track, rail), cached per section. */
  private anchors(el: HTMLElement | null) {
    if (el === this.host && (!this.nodes.length || this.nodes[0].isConnected)) return;
    this.host = el;
    this.nodes = el ? Array.from(el.querySelectorAll<HTMLElement>("[data-exp-node]")) : [];
    this.track = el?.querySelector<HTMLElement>("[data-hscroll-track]") ?? null;
    this.rail = this.nodes[0]?.parentElement ?? null;
  }

  /** Lay out the control points in screen px. Returns false when there is no room. */
  private layout(W: number, H: number, progress: number, time: number): Layout | null {
    const sp = this.sp;
    const n = this.n;
    const count = this.tl.count;
    const frame = sceneFrames.experience;
    this.anchors(frame.el);
    const el = this.host;
    const live = !framing.phone && !!el && el.hasAttribute("data-hscroll-live") && this.nodes.length === n && !!this.track;

    if (live && el && this.track) {
      // Home journey: milestones on the rail dots, the band above the cards around them.
      const items = this.track.children;
      const intro = items[0].getBoundingClientRect();
      const end = items[items.length - 1].getBoundingClientRect();
      const rr = this.rail!.getBoundingClientRect();
      const ground = rr.top + rr.height / 2;
      const top = Math.max(HEADER_PX + 8, ground - (pxVar(el, "--hscroll-band") || H * 0.4));
      const band = ground - top;
      for (let i = 0; i < n; i++) {
        const r = this.nodes[i].getBoundingClientRect();
        sp.x[1 + 2 * i] = r.left + r.width / 2;
        sp.y[1 + 2 * i] = r.top + r.height / 2;
      }
      sp.x[0] = intro.right - intro.width * 0.28;
      sp.y[0] = ground - band * 0.14;
      sp.x[count - 1] = end.left + Math.min(end.width * 0.4, 140);
      sp.y[count - 1] = Math.max(top + band * 0.12, sp.y[count - 3] - band * 0.14);
      fillArcs(sp, count, band * 0.16, top + band * 0.06);
      const line = pxVar(el, "--hscroll-line") || W * 0.5;
      const edge = pxVar(el, "--hscroll-edge") || 64;
      const travel = (parseFloat(el.style.getPropertyValue("--hscroll-progress")) || 0) * (pxVar(el, "--hscroll-length") || 0);
      this.groundPx = ground;
      this.topPx = top;
      this.room = 1;
      // The head target (the path's point under the reading line) needs the lifted points.
      return { live: true, edge, scale: 1, target: 0, travel, line };
    }

    // Free layout: the scene's own free rect, minus anything content covers.
    const fr = frame.rect;
    pxRect.l = fr.l * W;
    pxRect.r = fr.r * W;
    pxRect.t = Math.max(fr.t * H, framing.phone ? 56 : HEADER_PX);
    pxRect.b = Math.min(fr.b * H, H);
    const minH = framing.phone ? 110 : 130;
    const ok = clearRect(pxRect, minH, clear);
    if (!ok) return null;
    const w = clear.r - clear.l;
    const h = Math.min(clear.b - clear.t, framing.phone ? 300 : 420);
    const ground = clear.b - 10;
    const top = ground - h + 8;
    // Milestones: the DOM stops' x when they run in a row (the /about journey), else even.
    const row = this.nodes.length === n && n > 1 && this.inRow(clear);
    for (let i = 0; i < n; i++) {
      const k = 1 + 2 * i;
      sp.x[k] = row ? this.nodes[i].getBoundingClientRect().left + 5 : clear.l + w * (n > 1 ? 0.17 + (0.62 * i) / (n - 1) : 0.5);
      sp.y[k] = ground - h * (0.3 + 0.38 * this.tl.milestones[i].rise);
    }
    const first = sp.x[1];
    const last = sp.x[count - 3];
    const step = n > 1 ? (last - first) / (n - 1) : w * 0.3;
    sp.x[0] = Math.max(clear.l + w * 0.03, first - step * 0.45);
    sp.y[0] = ground - h * 0.14;
    sp.x[count - 1] = Math.min(clear.r - w * 0.03, last + step * 0.55);
    sp.y[count - 1] = Math.max(top + h * 0.12, sp.y[count - 3] - h * 0.14);
    fillArcs(sp, count, h * 0.16, top + h * 0.06);
    this.groundPx = ground;
    this.topPx = top;
    // Head: scroll through the section, and at least a steady draw once in view.
    if (this.seenAt < 0) this.seenAt = time;
    const byScroll = (count - 1) * smooth(0.02, 0.6, progress);
    const byTime = (count - 1) * smooth01((time - this.seenAt) / 4.5);
    const edge = framing.phone ? 12 : Math.min(64, W * 0.04);
    return { live: false, edge, scale: Math.max(0.6, Math.min(1, h / 320)), target: Math.max(byScroll, byTime, 0.6), travel: progress * W * 0.6, line: 0 };
  }

  /** Do the DOM stops run in one row inside the free rect's width (not a vertical list)? */
  private inRow(r: Rect) {
    const a = this.nodes[0].getBoundingClientRect();
    let prev = a.left;
    for (let i = 1; i < this.nodes.length; i++) {
      const b = this.nodes[i].getBoundingClientRect();
      if (Math.abs(b.top - a.top) > 4 || b.left <= prev + 40) return false;
      prev = b.left;
    }
    return a.left >= r.l && prev <= r.r;
  }

  /** Path parameter whose screen x is `x` (the path runs left to right). */
  private sAtX(x: number, count: number) {
    const cam = this.cam!;
    const W = this.W;
    let prevS = 0;
    let prevX = -Infinity;
    for (let k = 0; k <= (count - 1) * 12; k++) {
      const s = k / 12;
      evalPath(this.pts, count, s, v0).project(cam);
      const sx = ((v0.x + 1) / 2) * W;
      if (sx >= x) return k === 0 ? 0 : prevS + ((x - prevX) / Math.max(1e-3, sx - prevX)) * (s - prevS);
      prevS = s;
      prevX = sx;
    }
    return count - 1;
  }

  private cam: Camera | null = null;
  private W = 1;
  private H = 1;

  /** Screen px → world point on the plane z = depth (through the live camera). */
  private lift(px: number, py: number, depth: number, out: Vector3) {
    const cam = this.cam as PerspectiveCamera;
    ray.set((px / this.W) * 2 - 1, 1 - (py / this.H) * 2, 0.5).unproject(cam).sub(cam.position);
    const t = (depth - cam.position.z) / (ray.z || -1e-6);
    return out.copy(cam.position).addScaledVector(ray, t);
  }

  /** World units per CSS px at depth 0. */
  private perPx() {
    this.lift(this.W / 2, this.H / 2, 0, v1);
    this.lift(this.W / 2 + 100, this.H / 2, 0, v2);
    return v1.distanceTo(v2) / 100;
  }

  frame(
    time: number,
    dt: number,
    camera: Camera,
    size: { width: number; height: number },
    dpr: number,
    progress: number,
    weight: number,
  ): boolean {
    const n = this.n;
    const count = this.tl.count;
    if (weight <= 0.001 || !n) {
      if (this.root.visible) this.labels?.hideAll();
      this.root.visible = false;
      this.seenAt = -1;
      return false;
    }
    this.root.visible = true;
    const d = Math.min(dt, 0.1);
    this.cam = camera;
    this.W = size.width;
    this.H = size.height;
    camera.updateMatrixWorld();

    // Screen layout → world control points.
    const lay = this.layout(this.W, this.H, progress, time);
    this.room += ((lay ? 1 : 0) - this.room) * (1 - Math.exp(-d * 6));
    if (!lay && this.room < 0.01) {
      this.labels?.hideAll();
      this.root.visible = false;
      return true;
    }
    if (lay) {
      for (let k = 0; k < count; k++) {
        this.lift(this.sp.x[k], this.sp.y[k], this.sp.z[k], this.uP[k]);
        this.pts[k * 3] = this.uP[k].x;
        this.pts[k * 3 + 1] = this.uP[k].y;
        this.pts[k * 3 + 2] = this.uP[k].z;
      }
      if (lay.live) lay.target = this.sAtX(lay.line, count);
    }
    const L = lay ?? this.last;
    if (lay) this.last = lay;
    if (!L) return true;

    const e = smooth01(weight) * smooth01(this.room);
    const per = this.perPx();
    const sc0 = L.scale;

    // Trail head: eased toward its target (first frame snaps).
    const first = this.head < 0;
    this.head = first ? L.target : this.head + (L.target - this.head) * (1 - Math.exp(-d * (L.live ? 9 : 4)));
    const h = this.head;

    // Ribbon.
    const u = this.ribbonMat.uniforms;
    u.uN.value = count;
    u.uHead.value = h;
    u.uTime.value = time;
    u.uOpacity.value = e;
    u.uWidth.value = RIBBON_PX * sc0 * per * (framing.phone ? 0.75 : 1);
    u.uTodoA.value = framing.phone ? 0.6 : 1;
    const edgeDev = [L.edge * dpr, this.W * dpr];
    u.uEdge.value = edgeDev;
    // ~1 dash per 11 px of path on screen (its projected length, sampled).
    let len = 0;
    let px0 = 0;
    let py0 = 0;
    for (let k = 0; k <= (count - 1) * 8; k++) {
      evalPath(this.pts, count, k / 8, v0).project(camera);
      const x = ((v0.x + 1) / 2) * this.W;
      const y = ((1 - v0.y) / 2) * this.H;
      if (k) len += Math.hypot(x - px0, y - py0);
      px0 = x;
      py0 = y;
    }
    u.uDash.value = Math.max(3, len / 11 / Math.max(1, count - 1));
    const edgeFade = (x: number) => smooth(0, L.edge, x) * smooth(0, L.edge, this.W - x);

    // Floor: from the rail line back into depth, sliding with the distance travelled.
    const ground = this.lift(this.W / 2, this.groundPx, 0, v0);
    this.floor.position.set(ground.x, ground.y, 0);
    const fu = this.floorMat.uniforms;
    fu.uOff.value = L.travel * per;
    fu.uCell.value = 0.9 * sc0;
    fu.uOpacity.value = e;
    fu.uEdge.value = edgeDev;
    for (const m of [this.ringMat, this.waveMat, this.sprites.material, this.dust.material]) m.uniforms.uOpacity.value = e;

    // Milestones: reached → lit (current role pulses in the status colour), else dim.
    const sp = this.sprites;
    const rc = this.ringColor.array as Float32Array;
    const ra = this.ringAlpha.array as Float32Array;
    const wc = this.waveColor.array as Float32Array;
    const wa = this.waveAlpha.array as Float32Array;
    const ringW = RING_PX * sc0 * per;
    const toCam = v2;
    for (let i = 0; i < n; i++) {
      const m = this.tl.milestones[i];
      const k = milestoneS(i);
      const a = this.uP[k];
      this.mx[i] = this.sp.x[k];
      this.my[i] = this.sp.y[k];
      const fade = edgeFade(this.mx[i]);
      const reached = h >= k - 0.02;
      if (reached && !this.reached[i] && !first) this.waveStart[i] = time;
      this.reached[i] = reached;
      const col = !reached ? this.colTodo : m.current ? this.colNow : this.colPast;
      const pulse = reached && m.current ? 0.5 + 0.5 * Math.sin(time * ((Math.PI * 2) / PULSE_EVERY)) : 0;
      const near = clamp01(1 - Math.abs(h - k) / 0.5);
      rc[i * 3] = col.r;
      rc[i * 3 + 1] = col.g;
      rc[i * 3 + 2] = col.b;
      ra[i] = (reached ? 0.78 + 0.22 * near + 0.2 * pulse : 0.36 + 0.4 * near) * fade;
      // Ring normal: between the path's direction and the camera, so it reads as a gate
      // the trail threads while still opening toward the viewer.
      evalPath(this.pts, count, k + 0.05, v1).sub(evalPath(this.pts, count, k - 0.05, v0)).normalize();
      toCam.copy(camera.position).sub(a).normalize();
      v1.multiplyScalar(0.55).add(toCam).normalize();
      q0.setFromUnitVectors(Z, v1);
      sc.setScalar(ringW * (1 + (reached ? 0.08 * pulse : 0) + 0.1 * near));
      m4.compose(a, q0, sc);
      this.rings.setMatrixAt(i, m4);

      // Shockwave on arrival; the current role repeats it.
      let wt = (time - this.waveStart[i]) / WAVE_S;
      if (reached && m.current && wt > 1) wt = ((time - this.waveStart[i]) % PULSE_EVERY) / WAVE_S;
      const wOn = wt >= 0 && wt <= 1 ? 1 - wt : 0;
      sc.setScalar(ringW * (1 + 1.5 * smooth01(wt)));
      m4.compose(a, q0, sc);
      this.waves.setMatrixAt(i, m4);
      wc[i * 3] = col.r;
      wc[i * 3 + 1] = col.g;
      wc[i * 3 + 2] = col.b;
      wa[i] = wOn * wOn * 0.9 * fade;

      sp.set(this.sNode + i, a.x, a.y, a.z);
      sp.setColor(this.sNode + i, col);
      sp.alpha[this.sNode + i] = (reached ? 0.75 + 0.3 * pulse : 0.3) * fade;
      sp.size[this.sNode + i] = (reached ? 74 + 16 * pulse : 52) * sc0 * per;
    }
    this.rings.instanceMatrix.needsUpdate = true;
    this.waves.instanceMatrix.needsUpdate = true;
    this.ringColor.needsUpdate = true;
    this.ringAlpha.needsUpdate = true;
    this.waveColor.needsUpdate = true;
    this.waveAlpha.needsUpdate = true;

    // "Now" cap at the end of the path, lit once the trail gets there.
    const nowP = this.uP[count - 1];
    const atNow = h >= count - 1.05;
    sp.set(this.sNow, nowP.x, nowP.y, nowP.z);
    sp.setColor(this.sNow, atNow ? this.colNow : this.colTodo);
    sp.size[this.sNow] = 44 * sc0 * per;
    sp.alpha[this.sNow] = (atNow ? 0.8 + 0.2 * Math.sin(time * 2.6) : 0.25) * edgeFade(this.sp.x[count - 1]);

    // Head + comet tail.
    evalPath(this.pts, count, h, v0);
    v1.copy(v0).project(camera);
    const headX = ((v1.x + 1) / 2) * this.W;
    sp.set(this.sHead, v0.x, v0.y, v0.z);
    sp.setColor(this.sHead, this.colTrail);
    sp.size[this.sHead] = 64 * sc0 * per * (1 + 0.08 * Math.sin(time * 5));
    sp.alpha[this.sHead] = (h < count - 1.02 ? 1 : 0.4) * edgeFade(headX);
    for (let j = 0; j < TAIL_N; j++) {
      const f = h - (j + 1) * 0.035;
      const i = this.sTail + j;
      if (f <= 0) {
        sp.alpha[i] = 0;
        continue;
      }
      evalPath(this.pts, count, f, v0);
      sp.set(i, v0.x, v0.y + 0.02 * Math.sin(time * 9 + j * 2.3) * sc0, v0.z);
      sp.setColor(i, this.colTrail);
      const fall = 1 - j / TAIL_N;
      sp.size[i] = (22 * fall + 4) * sc0 * per;
      sp.alpha[i] = 0.7 * fall * fall * edgeFade(headX);
    }

    // Data packets: small lights running along the drawn trail, start → head.
    for (let j = 0; j < PACKETS; j++) {
      const i = this.sPack + j;
      const ph = (time * 0.11 + j / PACKETS) % 1;
      const f = ph * h;
      if (h < 0.3) {
        sp.alpha[i] = 0;
        continue;
      }
      evalPath(this.pts, count, f, v0);
      v1.copy(v0).project(camera);
      sp.set(i, v0.x, v0.y, v0.z);
      sp.setColor(i, j % 3 === 2 ? this.colNow : this.colTrail);
      sp.size[i] = 26 * sc0 * per;
      sp.alpha[i] = Math.sin(Math.PI * ph) * 0.95 * edgeFade(((v1.x + 1) / 2) * this.W);
    }

    // Quarter-year ticks: lit once passed.
    for (let k2 = 0; k2 < this.tl.ticks.length; k2++) {
      const s = this.tl.ticks[k2];
      evalPath(this.pts, count, s, v0);
      v1.copy(v0).project(camera);
      const passed = h >= s;
      sp.set(this.sTick + k2, v0.x, v0.y, v0.z);
      sp.setColor(this.sTick + k2, passed ? this.colTrail : this.colTick);
      sp.size[this.sTick + k2] = (framing.phone ? 9 : 14) * sc0 * per;
      sp.alpha[this.sTick + k2] = (passed ? 0.85 : 0.45) * edgeFade(((v1.x + 1) / 2) * this.W);
    }
    sp.flush();

    // Dust: a field through the band that slides with the travel (parallax by depth).
    const topY = this.lift(this.W / 2, this.topPx, 0, v1).y;
    const span = 34;
    const shift = L.travel * per * 0.6;
    const dust = this.dust;
    for (let i = 0; i < dust.count; i++) {
      const s0 = this.dustSeed[i * 3];
      const s1 = this.dustSeed[i * 3 + 1];
      const s2 = this.dustSeed[i * 3 + 2];
      const z = -9 + s2 * 10;
      let x = s0 * span - shift;
      x = ((x % span) + span) % span - span / 2;
      dust.set(i, camera.position.x + x, ground.y + (topY - ground.y) * (0.1 + s1 * 1.1), z);
      dust.size[i] = (0.05 + s1 * 0.06) * Math.max(0.6, sc0);
    }
    dust.flush(5);

    // Labels: above each ring; upcoming roles are quieter; never over content (layer).
    const layer = this.labels;
    if (layer?.begin(weight)) {
      const gap = n > 1 ? Math.abs(this.mx[n - 1] - this.mx[0]) / (n - 1) : 1e9;
      for (let i = 0; i < n; i++) {
        const o = e * (this.reached[i] ? 1 : 0.55) * edgeFade(this.mx[i]);
        this.lift(this.mx[i] + 12, this.my[i] + (ringW / per) * 0.7, 0, v0);
        if (gap > 150) layer.place(this.label0 + i * 2, v0.x, v0.y, v0.z, ID, camera, this.W, this.H, o);
        else layer.hide(this.label0 + i * 2);
        if (gap > 250) layer.place(this.label0 + i * 2 + 1, v0.x, v0.y, v0.z, ID, camera, this.W, this.H, o * 0.9);
        else layer.hide(this.label0 + i * 2 + 1);
      }
    }
    this.expose();
    return true;
  }

  private last: Layout | null = null;
  /** The ground line (rail / free rect bottom) and the band top, px. */
  private groundPx = 0;
  private topPx = 0;

  /** QA hook: milestone screen positions on the stage element (dev + prod, cheap). */
  private exposedAt = 0;
  private expose() {
    const now = performance.now();
    if (now - this.exposedAt < 100) return;
    this.exposedAt = now;
    const stage = this.root.parent ? document.querySelector<HTMLElement>("[data-neural-stage]") : null;
    if (!stage) return;
    let s = "";
    for (let i = 0; i < this.n; i++) s += `${i ? ";" : ""}${this.mx[i].toFixed(1)},${this.my[i].toFixed(1)}`;
    stage.dataset.expMilestones = this.room > 0.5 ? s : "";
  }

  dispose() {
    this.ribbon.geometry.dispose();
    this.ribbonMat.dispose();
    this.rings.geometry.dispose();
    this.waves.geometry.dispose();
    this.rings.dispose();
    this.waves.dispose();
    this.ringMat.dispose();
    this.waveMat.dispose();
    this.floor.geometry.dispose();
    this.floorMat.dispose();
    this.sprites.dispose();
    this.dust.dispose();
  }
}
