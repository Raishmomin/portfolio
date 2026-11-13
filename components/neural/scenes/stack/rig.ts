// The stack constellation as plain three.js objects driven by `frame()`; React only wires
// its lifecycle (stack.tsx), so nothing re-renders per frame and nothing allocates per frame.
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  Group,
  LineSegments,
  Mesh,
  ShaderMaterial,
  Vector3,
} from "three";
import type { Camera } from "three";
import { clearRect, framing, sceneFrames, type Rect } from "../../framing";
import type { ScenePalette, SkillLayer } from "../../types";
import { GLOW_OUT, Sprites, clamp01, fitScale, hash01, isLightBg, layerColors, setGlowBlending, smooth01 } from "./gl";
import type { Align, LabelLayer } from "./labels";
import { LAYER_NAME, bezier, type StackLayout } from "./layout";

const TILT = 0.38; // rad: view the plates from slightly above
const ORBIT_START = -0.6; // rad at progress 0
const ORBIT_RANGE = 1.5; // rad over the section
const SIGNAL_CYCLE = 1.45; // a signal travels for 1 of every 1.45 cycles, then rests
// Phones: the network is fitted whole into its section's opening (above the heading, below
// the header, clear of the panel), page-attached, and fades as that opening scrolls away.
const HEADER_PX = 64;
const PHONE_PAD = 10; // px kept clear below the header / the section's top edge
const PHONE_MIN = 110; // px: a smaller clear opening hides the network
const PHONE_FULL = 170; // px: from here on it draws at full strength
const KEY_PX = 28; // px kept clear above the heading (its kicker line), as the director does
const GLOW_PX = 12; // px kept around the outline for the nodes' glow
const PHONE_HALO = 0.45; // node halo on phones (desktop NODE_HALO)
const PHONE_EDGES = 0.65; // edge strength on phones
const NODE_HALO = 0.85;

const EDGE_VERT = /* glsl */ `
  attribute vec3 aColor;
  attribute float aT;
  attribute float aW;
  attribute float aPhase;
  attribute float aSpeed;
  attribute float aHi;
  varying vec3 vColor;
  varying float vT;
  varying float vW;
  varying float vPhase;
  varying float vSpeed;
  varying float vHi;
  void main() {
    vColor = aColor; vT = aT; vW = aW; vPhase = aPhase; vSpeed = aSpeed; vHi = aHi;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const EDGE_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  uniform float uFocus;
  uniform float uLight;
  varying vec3 vColor;
  varying float vT;
  varying float vW;
  varying float vPhase;
  varying float vSpeed;
  varying float vHi;
  void main() {
    // Same clock as the CPU signal sprites: a comet tail trails each travelling signal.
    float head = fract(uTime * vSpeed + vPhase) * ${SIGNAL_CYCLE.toFixed(2)};
    float along = vPhase > 0.5 ? vT : 1.0 - vT;
    float dd = min(head, 1.0) - along;
    float arrived = 1.0 - smoothstep(1.0, ${SIGNAL_CYCLE.toFixed(2)}, head);
    float tail = dd >= 0.0 ? exp(-dd * 7.0) * arrived : 0.0;
    float base = 0.14 + 0.5 * vW;
    float f = mix(1.0, mix(0.06, 1.7, vHi), uFocus);
    float a = (base + tail * (0.45 + 0.8 * vW)) * f * uOpacity;
    vec3 c = vColor * (1.0 + tail * 0.9);
    if (uLight > 0.5) a *= 0.9;
    ${GLOW_OUT}
  }
`;

const PLATE_VERT = /* glsl */ `
  attribute vec3 aColor;
  attribute float aR;
  attribute float aAng;
  varying vec3 vColor;
  varying float vR;
  varying float vAng;
  void main() {
    vColor = aColor; vR = aR; vAng = aAng;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const PLATE_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  uniform float uLight;
  varying vec3 vColor;
  varying float vR;
  varying float vAng;
  void main() {
    // dark: additive light is boosted by the sRGB encode, so the fill stays faint
    float fill = (pow(1.0 - vR, 2.0) * 0.075 + 0.012) * (uLight > 0.5 ? 1.0 : 0.45);
    float rim = smoothstep(0.962, 0.978, vR) * (1.0 - smoothstep(0.988, 1.0, vR));
    float dash = step(0.55, fract(vAng * 90.0 - uTime * 0.5));
    float inner = smoothstep(0.6, 0.607, vR) * (1.0 - smoothstep(0.611, 0.618, vR)) * step(0.72, fract(vAng * 140.0));
    float a = fill + rim * (0.1 + 0.32 * dash) + inner * 0.16;
    if (uLight > 0.5) a *= 1.1;
    a *= uOpacity;
    vec3 c = vColor;
    ${GLOW_OUT}
  }
`;

const tmp = new Vector3();
const ray = new Vector3();
/** World point on the z = 0 plane under a canvas pixel. */
function toWorld(camera: Camera, px: number, py: number, w: number, h: number, out: Vector3) {
  ray.set((px / w) * 2 - 1, 1 - (py / h) * 2, 0.5).unproject(camera).sub(camera.position);
  const t = Math.abs(ray.z) > 1e-6 ? -camera.position.z / ray.z : 0;
  return out.copy(camera.position).addScaledVector(ray, t);
}
/** Plate names sit left of the rim (or just inside it on narrow viewports). */
const PLATE_OUT: Align = { x: -1, y: -0.5, dx: -6 };
const PLATE_IN: Align = { x: 0, y: -0.5, dx: 8 };

export class StackRig {
  /** Weight fade/scale + tilt; React mounts it, plate labels live here (they do not orbit). */
  readonly root = new Group();
  /** The orbiting constellation; skill labels live here. */
  readonly spin = new Group();

  private readonly nodes: Sprites;
  private readonly signals: Sprites;
  private readonly edges: LineSegments;
  private readonly edgeMat: ShaderMaterial;
  private readonly edgeHi: BufferAttribute;
  private readonly edgeColor: BufferAttribute;
  private readonly plates: Mesh;
  private readonly plateMat: ShaderMaterial;
  private readonly plateColor: BufferAttribute;
  private readonly segs: number;
  private readonly sigSpeed: Float32Array;
  private readonly sigPhase: Float32Array;
  private readonly nodeHi: Float32Array; // damped 0..1 (focused node or neighbour)
  private readonly nodeHiT: Float32Array;
  private readonly nodeBoost: Float32Array; // damped 0..1 (the focused node itself)
  private readonly linkHi: Float32Array;
  private readonly linkHiT: Float32Array;
  private readonly baseAlpha: Float32Array;
  private readonly labelledSet: Set<number>;
  private labels: LabelLayer | null = null;
  private nodeLabel0 = 0; // label index of node 0 (nodes first, then plates)
  private plateLabel0 = 0;
  private palette: ScenePalette | null = null;
  private platesInside = false;
  private focusId: string | null = null;
  private focusAmt = 0;
  private focusAmtT = 0;
  private orbit = ORBIT_START;
  private px = 0;
  private py = 0;
  private settled = false;
  /** Outline sample points (spin space) the phone fit measures on screen. */
  private readonly hull: Float32Array;
  /** Phones: the fitted scale (0 = not fitted yet). */
  private phoneScale = 0;
  private headFor: HTMLElement | null = null;
  private head: HTMLElement | null = null;
  private readonly openPx: Rect = { l: 0, t: 0, r: 0, b: 0 };
  private readonly openClear: Rect = { l: 0, t: 0, r: 0, b: 0 };
  private readonly at = new Vector3();
  private readonly corner = new Vector3();

  constructor(private readonly layout: StackLayout, quality: "high" | "low") {
    const { nodes, links, plates } = layout;
    const N = nodes.length;
    const L = links.length;
    this.segs = quality === "high" ? 16 : 7;

    // Nodes.
    this.nodes = new Sprites(N, { core: 0.24, halo: NODE_HALO, renderOrder: 3 });
    this.baseAlpha = new Float32Array(N);
    nodes.forEach((nd, i) => {
      this.nodes.set(i, nd.x, nd.y, nd.z);
      this.nodes.size[i] = nd.d / 0.24;
      this.baseAlpha[i] = nd.uses > 0 ? 1 : 0.62;
      this.nodes.alpha[i] = this.baseAlpha[i];
    });
    this.nodeHi = new Float32Array(N);
    this.nodeHiT = new Float32Array(N);
    this.nodeBoost = new Float32Array(N);
    this.labelledSet = new Set(layout.labelled);

    // Edges: one LineSegments, each link a Bézier arc of `segs` segments.
    const V = L * this.segs * 2;
    const pos = new Float32Array(V * 3);
    const t = new Float32Array(V);
    const w = new Float32Array(V);
    const phase = new Float32Array(V);
    const speed = new Float32Array(V);
    this.sigSpeed = new Float32Array(L);
    this.sigPhase = new Float32Array(L);
    const pt = new Float32Array(3);
    let v = 0;
    links.forEach((lk, j) => {
      const A = nodes[lk.a];
      const B = nodes[lk.b];
      this.sigSpeed[j] = 0.16 + 0.12 * hash01(A.id + B.id, 3);
      this.sigPhase[j] = hash01(A.id + B.id, 11);
      for (let s = 0; s < this.segs; s++) {
        for (const k of [s, s + 1]) {
          const tt = k / this.segs;
          bezier(pt, 0, A, lk.ctrl, B, tt);
          pos.set(pt, v * 3);
          t[v] = tt;
          w[v] = lk.w;
          phase[v] = this.sigPhase[j];
          speed[v] = this.sigSpeed[j];
          v++;
        }
      }
    });
    const eg = new BufferGeometry();
    eg.setAttribute("position", new BufferAttribute(pos, 3));
    this.edgeColor = new BufferAttribute(new Float32Array(V * 3), 3);
    eg.setAttribute("aColor", this.edgeColor);
    eg.setAttribute("aT", new BufferAttribute(t, 1));
    eg.setAttribute("aW", new BufferAttribute(w, 1));
    eg.setAttribute("aPhase", new BufferAttribute(phase, 1));
    eg.setAttribute("aSpeed", new BufferAttribute(speed, 1));
    this.edgeHi = new BufferAttribute(new Float32Array(V), 1);
    this.edgeHi.setUsage(DynamicDrawUsage);
    eg.setAttribute("aHi", this.edgeHi);
    this.edgeMat = new ShaderMaterial({
      vertexShader: EDGE_VERT,
      fragmentShader: EDGE_FRAG,
      uniforms: { uTime: { value: 0 }, uOpacity: { value: 1 }, uFocus: { value: 0 }, uLight: { value: 0 } },
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    this.edges = new LineSegments(eg, this.edgeMat);
    this.edges.frustumCulled = false;
    this.edges.renderOrder = 2;
    this.linkHi = new Float32Array(L);
    this.linkHiT = new Float32Array(L);

    // Outline samples (phones fit the whole network into its opening): every node, every
    // other edge point and each plate's rim.
    {
      const RIM = 24;
      const pts: number[] = [];
      for (const nd of nodes) pts.push(nd.x, nd.y, nd.z);
      for (let i = 0; i < pos.length; i += 6) pts.push(pos[i], pos[i + 1], pos[i + 2]);
      for (const pl of plates)
        for (let a = 0; a < RIM; a++) {
          const ang = (a / RIM) * Math.PI * 2;
          pts.push(pl.x + Math.cos(ang) * pl.radius, pl.y, pl.z + Math.sin(ang) * pl.radius);
        }
      this.hull = new Float32Array(pts);
    }

    // Signals: one travelling glow per link, the edge shader draws its tail.
    this.signals = new Sprites(Math.max(1, L), { core: 0.2, halo: 1, renderOrder: 4 });
    links.forEach((lk, j) => {
      this.signals.size[j] = 0.13 + 0.12 * lk.w;
    });
    if (!L) this.signals.alpha[0] = 0;

    // Plates: merged triangle fans (one draw call) with radial + angular coordinates.
    const SEG = quality === "high" ? 96 : 48;
    const P = plates.length;
    const ppos = new Float32Array(P * SEG * 3 * 3);
    const pr = new Float32Array(P * SEG * 3);
    const pa = new Float32Array(P * SEG * 3);
    let q = 0;
    for (const pl of plates) {
      for (let s = 0; s < SEG; s++) {
        const a0 = (s / SEG) * Math.PI * 2;
        const a1 = ((s + 1) / SEG) * Math.PI * 2;
        const verts: [number, number, number, number, number][] = [
          [pl.x, pl.z, 0, s / SEG, 0],
          [pl.x + Math.cos(a0) * pl.radius, pl.z + Math.sin(a0) * pl.radius, 1, s / SEG, 0],
          [pl.x + Math.cos(a1) * pl.radius, pl.z + Math.sin(a1) * pl.radius, 1, (s + 1) / SEG, 0],
        ];
        for (const [x, z, r, ang] of verts) {
          ppos[q * 3] = x;
          ppos[q * 3 + 1] = pl.y - 0.03;
          ppos[q * 3 + 2] = z;
          pr[q] = r;
          pa[q] = ang;
          q++;
        }
      }
    }
    const pg = new BufferGeometry();
    pg.setAttribute("position", new BufferAttribute(ppos, 3));
    pg.setAttribute("aR", new BufferAttribute(pr, 1));
    pg.setAttribute("aAng", new BufferAttribute(pa, 1));
    this.plateColor = new BufferAttribute(new Float32Array(P * SEG * 3 * 3), 3);
    pg.setAttribute("aColor", this.plateColor);
    this.plateMat = new ShaderMaterial({
      vertexShader: PLATE_VERT,
      fragmentShader: PLATE_FRAG,
      uniforms: { uTime: { value: 0 }, uOpacity: { value: 1 }, uLight: { value: 0 } },
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      side: DoubleSide,
    });
    this.plates = new Mesh(pg, this.plateMat);
    this.plates.frustumCulled = false;
    this.plates.renderOrder = 1;

    this.spin.add(this.plates, this.edges, this.nodes.mesh, this.signals.mesh);
    this.root.rotation.x = TILT;
    this.root.visible = false;
  }

  setPalette(p: ScenePalette) {
    this.palette = p;
    const light = isLightBg(p.bg);
    const cols = layerColors(p);
    const colorOf = (l: SkillLayer) => cols[l];
    const { nodes, links, plates } = this.layout;
    nodes.forEach((nd, i) => this.nodes.setColor(i, colorOf(nd.layer)));
    const c = new Color();
    let v = 0;
    const arr = this.edgeColor.array as Float32Array;
    links.forEach((lk, j) => {
      const ca = colorOf(nodes[lk.a].layer);
      const cb = colorOf(nodes[lk.b].layer);
      for (let s = 0; s < this.segs; s++)
        for (const k of [s, s + 1]) {
          c.copy(ca).lerp(cb, k / this.segs);
          arr[v * 3] = c.r;
          arr[v * 3 + 1] = c.g;
          arr[v * 3 + 2] = c.b;
          v++;
        }
      c.copy(ca).lerp(cb, 0.5);
      this.signals.setColor(j, c);
    });
    this.edgeColor.needsUpdate = true;
    const pc = this.plateColor.array as Float32Array;
    const per = pc.length / 3 / Math.max(1, plates.length);
    plates.forEach((pl, k) => {
      const col = colorOf(pl.layer);
      for (let i = 0; i < per; i++) {
        const o = (k * per + i) * 3;
        pc[o] = col.r;
        pc[o + 1] = col.g;
        pc[o + 2] = col.b;
      }
    });
    this.plateColor.needsUpdate = true;
    this.nodes.flush(2);
    this.signals.flush(2);
    for (const m of [this.nodes.material, this.signals.material, this.edgeMat, this.plateMat]) {
      m.uniforms.uLight.value = light ? 1 : 0;
      setGlowBlending(m, light);
    }
    this.styleLabels();
  }

  /** Create the DOM labels (one per skill, one per plate) in the given layer. */
  attachLabels(layer: LabelLayer | null) {
    this.labels = layer;
    if (!layer) return;
    const { nodes, plates } = this.layout;
    this.nodeLabel0 = -1;
    nodes.forEach((nd) => {
      const i = layer.add(nd.name, "font-size:11px;line-height:14px;letter-spacing:0.02em;", "font-mono", { x: 0, y: -0.5, dx: 9 });
      if (this.nodeLabel0 < 0) this.nodeLabel0 = i;
    });
    this.plateLabel0 = -1;
    this.platesInside = false;
    plates.forEach((pl) => {
      const i = layer.add(`${LAYER_NAME[pl.layer]} · ${pl.count}`, "font-size:10px;line-height:12px;letter-spacing:0.16em;text-transform:uppercase;", "font-mono", PLATE_OUT);
      if (this.plateLabel0 < 0) this.plateLabel0 = i;
    });
    this.styleLabels();
  }

  private styleLabels() {
    const layer = this.labels;
    const p = this.palette;
    if (!layer || !p) return;
    const shadow = `0 0 3px ${p.bg}, 0 0 8px ${p.bg}, 0 0 14px ${p.bg}`;
    const cols = layerColors(p);
    this.layout.nodes.forEach((_, i) => layer.style(this.nodeLabel0 + i, { color: p.fg, textShadow: shadow }));
    this.layout.plates.forEach((pl, k) =>
      layer.style(this.plateLabel0 + k, { color: `#${cols[pl.layer].getHexString()}`, textShadow: shadow }),
    );
  }

  private setFocus(id: string | null) {
    const prev = this.focusId === null ? undefined : this.layout.index.get(this.focusId);
    if (this.labels && prev !== undefined) this.labels.style(this.nodeLabel0 + prev, { fontWeight: "400" });
    this.focusId = id;
    const fi = id === null ? undefined : this.layout.index.get(id);
    if (this.labels && fi !== undefined) this.labels.style(this.nodeLabel0 + fi, { fontWeight: "600" });
    this.nodeHiT.fill(0);
    this.linkHiT.fill(0);
    if (fi === undefined) {
      this.focusAmtT = 0;
    } else {
      this.focusAmtT = 1;
      this.nodeHiT[fi] = 1;
      for (const nb of this.layout.neighbours[fi]) this.nodeHiT[nb] = 1;
      this.layout.links.forEach((lk, j) => {
        if (lk.a === fi || lk.b === fi) this.linkHiT[j] = 1;
      });
    }
    this.settled = false;
  }

  /** Advance one frame; returns true while the scene is visible (keep rendering). */
  frame(
    time: number,
    dt: number,
    camera: Camera,
    size: { width: number; height: number },
    progress: number,
    weight: number,
    pointer: { x: number; y: number },
    focus: string | null,
  ): boolean {
    if (weight <= 0.001) {
      if (this.root.visible) this.labels?.hideAll();
      this.root.visible = false;
      return false;
    }
    this.root.visible = true;
    const d = Math.min(dt, 0.1);
    const e = smooth01(weight);
    const k = 1 - Math.exp(-d * 5);

    // Progress → slow orbit (damped, so scroll steps never jerk); pointer → slight lean.
    this.orbit += (ORBIT_START + clamp01(progress) * ORBIT_RANGE - this.orbit) * k;
    this.px += (pointer.x - this.px) * k;
    this.py += (pointer.y - this.py) * k;
    this.spin.rotation.y = this.orbit + Math.sin(time * 0.07) * 0.06 + this.px * 0.14;
    this.root.rotation.x = TILT - this.py * 0.06;

    // Weight: fade, scale in, and (desktop) the plates stack apart from one plane. Phones
    // keep the network's aspect, fitted whole into the section's opening, with smaller
    // glows and quieter edges (at phone size the desktop glow piles up into one hot blur).
    const phone = framing.phone;
    let room = 1;
    if (phone) {
      room = this.fitPhone(camera, size);
      if (room <= 0.001) {
        if (this.root.visible) this.labels?.hideAll();
        this.root.visible = false;
        return true;
      }
      const s = (0.86 + 0.14 * e) * this.phoneScale;
      this.root.scale.set(s, s, s);
    } else {
      this.root.position.set(0, 0, 0);
      this.phoneScale = 0;
      const s = (0.86 + 0.14 * e) * fitScale(camera, size, 3.5, 3.5, 1.4);
      this.root.scale.set(s, s * (0.3 + 0.7 * e), s);
    }
    this.nodes.material.uniforms.uHalo.value = phone ? PHONE_HALO : NODE_HALO;
    this.signals.material.uniforms.uSize.value = phone ? 0.8 : 1;

    // Focus: highlight the skill, its edges and neighbours; dim the rest.
    if (focus !== this.focusId) this.setFocus(focus);
    const kf = 1 - Math.exp(-d * 9);
    if (!this.settled) {
      let delta = Math.abs(this.focusAmtT - this.focusAmt);
      this.focusAmt += (this.focusAmtT - this.focusAmt) * kf;
      const fi = this.focusId === null ? -1 : (this.layout.index.get(this.focusId) ?? -1);
      for (let i = 0; i < this.nodeHi.length; i++) {
        delta += Math.abs(this.nodeHiT[i] - this.nodeHi[i]);
        this.nodeHi[i] += (this.nodeHiT[i] - this.nodeHi[i]) * kf;
        const bt = i === fi ? 1 : 0;
        delta += Math.abs(bt - this.nodeBoost[i]);
        this.nodeBoost[i] += (bt - this.nodeBoost[i]) * kf;
      }
      const hi = this.edgeHi.array as Float32Array;
      const per = this.segs * 2;
      for (let j = 0; j < this.linkHi.length; j++) {
        delta += Math.abs(this.linkHiT[j] - this.linkHi[j]);
        this.linkHi[j] += (this.linkHiT[j] - this.linkHi[j]) * kf;
        hi.fill(this.linkHi[j], j * per, (j + 1) * per);
      }
      this.edgeHi.needsUpdate = true;
      if (delta < 0.002) this.settled = true;
    }

    // Nodes: breathe gently; focus dims or boosts.
    const fa = this.focusAmt;
    const { nodes, links } = this.layout;
    for (let i = 0; i < nodes.length; i++) {
      const breathe = 1 + 0.045 * Math.sin(time * 1.3 + i * 1.7);
      this.nodes.size[i] = (nodes[i].d / 0.24) * breathe * (1 + 0.45 * this.nodeBoost[i]);
      const f = 1 + fa * (this.nodeHi[i] * 1.15 - 0.85 + 0.25 * this.nodeBoost[i]);
      this.nodes.alpha[i] = this.baseAlpha[i] * f;
    }
    this.nodes.flush(12);

    // Signals ride their edge (same clock as the edge shader's tails).
    for (let j = 0; j < links.length; j++) {
      const lk = links[j];
      const head = (((time * this.sigSpeed[j] + this.sigPhase[j]) % 1) + 1) % 1 * SIGNAL_CYCLE;
      const on = head <= 1 ? Math.sin(Math.PI * head) ** 0.35 : 0;
      const tt = this.sigPhase[j] > 0.5 ? Math.min(head, 1) : 1 - Math.min(head, 1);
      bezier(this.signals.pos, j * 3, nodes[lk.a], lk.ctrl, nodes[lk.b], tt);
      this.signals.alpha[j] = on * (0.55 + 0.45 * lk.w) * (1 + fa * (this.linkHi[j] * 1.3 - 0.92));
    }
    this.signals.flush(9);

    const o = e * room;
    this.nodes.material.uniforms.uOpacity.value = o;
    this.signals.material.uniforms.uOpacity.value = o;
    this.edgeMat.uniforms.uOpacity.value = o * (phone ? PHONE_EDGES : 1);
    this.plateMat.uniforms.uOpacity.value = o * (1 - 0.5 * fa);
    this.edgeMat.uniforms.uTime.value = time;
    this.edgeMat.uniforms.uFocus.value = fa;
    this.plateMat.uniforms.uTime.value = time;

    // Labels: the most-used skills, plus the focused skill and its neighbours; quieter at
    // the back of the orbit, dimmed by focus, faded with weight.
    const layer = this.labels;
    if (layer?.begin(weight)) {
      this.root.updateMatrixWorld(true);
      const fi = this.focusId === null ? -1 : (this.layout.index.get(this.focusId) ?? -1);
      for (let i = 0; i < nodes.length; i++) {
        const shown = this.labelledSet.has(i) ? 1 : Math.max(this.nodeBoost[i], i === fi ? 1 : 0, fa * this.nodeHi[i]);
        if (shown <= 0.01) {
          layer.hide(this.nodeLabel0 + i);
          continue;
        }
        tmp.set(nodes[i].x, nodes[i].y, nodes[i].z).applyMatrix4(this.spin.matrixWorld);
        const depth = 0.42 + 0.58 * clamp01((tmp.z + 2.2) / 3.6);
        const f = 1 + fa * (Math.max(this.nodeHi[i], this.nodeBoost[i]) * 1.1 - 0.85);
        const nd = nodes[i];
        layer.place(this.nodeLabel0 + i, nd.x, nd.y, nd.z, this.spin.matrixWorld, camera, size.width, size.height, e * shown * Math.min(1, depth * f));
      }
      // Narrow viewports: plate names sit just inside the rim instead of outside it.
      const inside = size.width < 640;
      if (inside !== this.platesInside) {
        this.platesInside = inside;
        this.layout.plates.forEach((_, k) => layer.setAlign(this.plateLabel0 + k, inside ? PLATE_IN : PLATE_OUT));
      }
      const plates = this.layout.plates;
      for (let k = 0; k < plates.length; k++) {
        const pl = plates[k];
        layer.place(this.plateLabel0 + k, pl.x - pl.radius - 0.1, pl.y, pl.z, this.root.matrixWorld, camera, size.width, size.height, e * (1 - 0.6 * fa));
      }
    }
    return true;
  }

  /**
   * Phones: the section's opening (its top, or the header line, down to the heading's
   * kicker), minus anything content covers (the panel). The network's outline is measured
   * on screen at the current scale and orbit, and the root rescaled and moved so that
   * outline sits centred in the opening (page-attached: it follows the scroll exactly).
   * Returns the room 0..1: the network fades as the clear opening shrinks.
   */
  private fitPhone(camera: Camera, size: { width: number; height: number }): number {
    const el = sceneFrames.stack.el;
    if (!el?.isConnected) return 0;
    if (el !== this.headFor || !this.head?.isConnected) {
      this.headFor = el;
      this.head = el.querySelector<HTMLElement>("[data-stage-content], h1, h2");
    }
    const W = size.width;
    const H = size.height;
    const r = el.getBoundingClientRect();
    const px = this.openPx;
    px.l = W * 0.04;
    px.r = W * 0.96;
    px.t = Math.max(r.top, HEADER_PX) + PHONE_PAD;
    px.b = Math.min(r.bottom, this.head ? this.head.getBoundingClientRect().top - KEY_PX : r.bottom) - PHONE_PAD;
    const c = clearRect(px, PHONE_MIN, this.openClear);
    if (!c) return 0;
    const root = this.root;
    camera.updateMatrixWorld();
    const cx = (c.l + c.r) / 2;
    const cy = (c.t + c.b) / 2;
    if (!(this.phoneScale > 0)) {
      // First fit: a rough start from the rect's world size (the measured fit refines it).
      const mid = toWorld(camera, cx, cy, W, H, this.at);
      const cor = toWorld(camera, c.l, c.t, W, H, this.corner);
      this.phoneScale = Math.min(Math.abs(cor.x - mid.x), Math.abs(cor.y - mid.y)) / 3.6;
    }
    // Measure: the outline's screen box around the root's own projection.
    const s = this.phoneScale;
    root.position.copy(toWorld(camera, cx, cy, W, H, this.at));
    root.scale.set(s, s, s);
    root.updateMatrixWorld(true);
    const M = this.spin.matrixWorld;
    const h = this.hull;
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (let i = 0; i < h.length; i += 3) {
      tmp.set(h[i], h[i + 1], h[i + 2]).applyMatrix4(M).project(camera);
      if (tmp.x < x0) x0 = tmp.x;
      if (tmp.x > x1) x1 = tmp.x;
      if (tmp.y < y0) y0 = tmp.y;
      if (tmp.y > y1) y1 = tmp.y;
    }
    tmp.copy(root.position).project(camera);
    // NDC → px (y down): box size and its centre's offset from the root's projection.
    const bw = ((x1 - x0) / 2) * W;
    const bh = ((y1 - y0) / 2) * H;
    const offX = (((x0 + x1) / 2 - tmp.x) / 2) * W;
    const offY = (-((y0 + y1) / 2 - tmp.y) / 2) * H;
    // The outline runs through the node centres: room is kept for their glow.
    const g = Math.min((c.r - c.l - 2 * GLOW_PX) / Math.max(1, bw), (c.b - c.t - 2 * GLOW_PX) / Math.max(1, bh));
    this.phoneScale = s * g;
    root.position.copy(toWorld(camera, cx - offX * g, cy - offY * g, W, H, this.at));
    return smooth01((c.b - c.t - PHONE_MIN) / (PHONE_FULL - PHONE_MIN));
  }

  dispose() {
    this.nodes.dispose();
    this.signals.dispose();
    this.edges.geometry.dispose();
    this.edgeMat.dispose();
    this.plates.geometry.dispose();
    this.plateMat.dispose();
  }
}
