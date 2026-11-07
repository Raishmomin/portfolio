// The work scene's mutable side: the live state of the active project's architecture
// (every technology node, the platforms, the AI cluster, the infra container) eased
// toward the current layout each frame, written into the three instanced draw calls.
// When the project changes, technologies it shares with the previous one glide to their
// new slot, new ones fly in from above (staggered) and the ones it lacks sink and
// dissolve. No allocation per frame: every buffer is preallocated.
import type { RootState } from "@react-three/fiber";
import { Color, type Group } from "three";
import type { NeuralData, ScenePalette } from "../../types";
import { clamp01, damp, isLight } from "../ai/shared";
import { createGl, LINK, MAX_LINKS, MAX_PLATFORMS, NODE, NODE_EXTRA, type Gl } from "./gl";
import { buildVocab, layout, PITCH, STACK, TIER_INDEX, YAW, type Layout, type Vocab } from "./layout";

const N_IN = 3;
const N_HID = 4;
const SIZE = { tech: 0.5, neuron: 0.26, port: 0.3 };
const LINK_ATTRS = ["aA", "aB", "aW", "aAlpha", "aKind", "aSeed", "aColor"] as const;

export type ArchRegistry = { root: Group | null; tilt: Group | null };
export const emptyRegistry = (): ArchRegistry => ({ root: null, tilt: null });

export type ArchFrame = {
  /** Index into data.work of the project to show. */
  active: number;
  /** Technology key to highlight (a hovered chip), or null. */
  tech: string | null;
  weight: number;
  pointer: { x: number; y: number };
  /** Where the system's centre goes (world, z = 0) and its world units per layout unit. */
  x: number;
  y: number;
  scale: number;
};

export class ArchRig {
  readonly vocab: Vocab;
  readonly gl: Gl;
  /** Technology nodes (one per distinct technology across the projects). */
  readonly v: number;
  readonly nodeCount: number;
  private readonly work: NeuralData["work"];
  L: Layout;
  /** Bumped on every relayout, so label sides / texts are refreshed once. */
  version = 0;
  private key = "";
  readonly pos: Float32Array;
  private readonly tgt: Float32Array;
  readonly alpha: Float32Array;
  private readonly talpha: Float32Array;
  private readonly wait: Float32Array;
  private readonly col: Float32Array;
  readonly hi: Float32Array;
  /** Tier of every technology node (a technology keeps its tier in every project). */
  readonly tierOf: Uint8Array;
  /** Live platforms (client, server, data): y, width, depth, presence. */
  readonly plat = STACK.map(() => ({ y: 0, w: 4, d: 1.2, a: 0 }));
  readonly ai = { x: 3, y: 0, a: 0 };
  readonly infra = { min: [0, 0, 0], max: [0, 0, 0], a: 0 };
  readonly title = [0, 0, 0];
  private readonly fit = { x: 0, y: 0, s: 0, cx: 0, cy: 0, first: true };
  private yaw = YAW;
  private pitch = PITCH;
  private quality: "high" | "low" = "high";
  private readonly tier: Color[] = [0, 1, 2, 3, 4].map(() => new Color());
  private readonly plate = new Color();

  constructor(work: NeuralData["work"]) {
    this.work = work;
    this.vocab = buildVocab(work);
    this.v = this.vocab.keys.length;
    this.nodeCount = this.v + NODE_EXTRA;
    this.gl = createGl(this.nodeCount);
    const v = this.v;
    this.pos = new Float32Array(v * 3);
    this.tgt = new Float32Array(v * 3);
    this.alpha = new Float32Array(v);
    this.talpha = new Float32Array(v);
    this.wait = new Float32Array(v);
    this.col = new Float32Array(v * 3);
    this.hi = new Float32Array(v);
    this.tierOf = new Uint8Array(v);
    for (const p of work) for (const t of p.stack) this.tierOf[this.vocab.index.get(t.key) ?? 0] = TIER_INDEX[t.tier];
    const kind = this.gl.nAttr.aKind.array as Float32Array;
    kind.fill(NODE.tech);
    for (let i = 0; i < N_IN + N_HID; i++) kind[v + i] = NODE.neuron;
    for (let i = 0; i < 3; i++) kind[v + N_IN + N_HID + i] = NODE.port;
    this.gl.nAttr.aKind.needsUpdate = true;
    this.L = layout(work[0], this.vocab, null);
  }

  /** Port node index of platform k (where the spine and the spokes meet). */
  port(k: number) {
    return this.v + N_IN + N_HID + k;
  }

  setPalette(p: ScenePalette) {
    this.gl.setLight(isLight(p.bg));
    [p.fg, p.accent, p.ok, p.muted, p.ai].forEach((h, k) => this.tier[k].set(h));
    const { platformMat, nodeMat, linkMat } = this.gl;
    platformMat.uniforms.uBg.value.set(p.bg);
    platformMat.uniforms.uFg.value.set(p.fg);
    nodeMat.uniforms.uBg.value.set(p.bg);
    nodeMat.uniforms.uAccent.value.set(p.accent);
    linkMat.uniforms.uReq.value.set(p.accent);
    linkMat.uniforms.uRes.value.set(p.ok);
    linkMat.uniforms.uAi.value.set(p.ai);
    // Snap node colours to the new theme; platform tints = client / server / data.
    for (let i = 0; i < this.v; i++) this.tier[this.tierOf[i]].toArray(this.col, i * 3);
    const tint = this.gl.pAttr.aTint.array as Float32Array;
    for (let k = 0; k < MAX_PLATFORMS; k++) this.tier[k].toArray(tint, k * 3);
    // The client platform (neutral ink/bone) is toned toward muted so its rim never blooms white.
    this.plate.set(p.fg).lerp(this.tier[3], 0.4).toArray(tint, 0);
    this.gl.pAttr.aTint.needsUpdate = true;
  }

  setQuality(q: "high" | "low") {
    this.quality = q;
    this.gl.platformMat.uniforms.uGrid.value = q === "low" ? 0 : 1;
  }

  /** Recompute the layout when the project or the highlighted technology changes. */
  private relayout(active: number, tech: string | null) {
    const project = this.work[active];
    // Pin only a technology of this project (its tier cap might hide it).
    const pin = tech && project?.stack.some((t) => t.key === tech) ? tech : null;
    const key = `${active}|${pin ?? ""}`;
    if (key === this.key) return;
    const firstTime = this.key === "";
    this.key = key;
    const L = (this.L = layout(project, this.vocab, pin));
    this.version++;
    for (let i = 0; i < this.v; i++) {
      const o = i * 3;
      if (L.on[i]) {
        // Still visible (even mid-dissolve): glide to the new slot instead of re-spawning.
        const was = this.alpha[i] > 0.04;
        this.tgt[o] = L.slot[o];
        this.tgt[o + 1] = L.slot[o + 1];
        this.tgt[o + 2] = L.slot[o + 2];
        if (!was) {
          // Fly in from above and in front, staggered in reading order.
          this.pos[o] = L.slot[o] + 0.3;
          this.pos[o + 1] = L.slot[o + 1] + (firstTime ? 2.4 : 1.7);
          this.pos[o + 2] = L.slot[o + 2] + 1.1;
          this.alpha[i] = 0;
          this.wait[i] = 0.05 + L.order[i] * 0.045;
          this.tier[this.tierOf[i]].toArray(this.col, o);
        }
        this.talpha[i] = 1;
      } else if (this.talpha[i] > 0) {
        // Dissolve: sink a little while fading and shrinking.
        this.talpha[i] = 0;
        this.wait[i] = 0;
        this.tgt[o + 1] = this.pos[o + 1] - 0.45;
      }
    }
  }

  frame(state: RootState, delta: number, f: ArchFrame, r: ArchRegistry) {
    const { root, tilt } = r;
    if (!root || !tilt) return;
    const dt = Math.min(delta, 0.1);
    const time = state.clock.elapsedTime;
    this.relayout(f.active, f.tech);
    const L = this.L;
    const v = this.v;
    const gl = this.gl;

    // Fit: centre and scale eased (a project switch zooms the system to its new size).
    const fit = this.fit;
    if (fit.first) {
      fit.x = f.x;
      fit.y = f.y;
      fit.s = f.scale;
      fit.cx = L.cx;
      fit.cy = L.cy;
      fit.first = false;
    }
    fit.x = damp(fit.x, f.x, 14, dt);
    fit.y = damp(fit.y, f.y, 14, dt);
    fit.s = damp(fit.s, f.scale, 4, dt);
    fit.cx = damp(fit.cx, L.cx, 4, dt);
    fit.cy = damp(fit.cy, L.cy, 4, dt);
    const s = fit.s * (0.94 + 0.06 * f.weight);
    root.position.set(fit.x - fit.cx * s, fit.y - fit.cy * s, 0);
    root.scale.setScalar(s);
    this.yaw = damp(this.yaw, YAW + f.pointer.x * 0.12, 2.5, dt);
    this.pitch = damp(this.pitch, PITCH - f.pointer.y * 0.06, 2.5, dt);
    tilt.rotation.set(this.pitch, this.yaw + Math.sin(time * 0.13) * 0.025, 0);

    // Platforms.
    const pa = gl.pAttr;
    const pPos = pa.aPos.array as Float32Array;
    const pSize = pa.aSize.array as Float32Array;
    const pAlpha = pa.aAlpha.array as Float32Array;
    for (let k = 0; k < 3; k++) {
      const p = this.plat[k];
      const t = L.platforms[k];
      if (t.on) {
        if (p.a < 0.02) {
          p.y = t.y + 0.9; // rise into place
          p.w = t.w;
          p.d = t.d;
        }
        p.y = damp(p.y, t.y, 5, dt);
        p.w = damp(p.w, t.w, 5, dt);
        p.d = damp(p.d, t.d, 5, dt);
      }
      p.a = damp(p.a, t.on ? 1 : 0, t.on ? 5 : 6, dt);
      pPos[k * 3] = 0;
      pPos[k * 3 + 1] = p.y + Math.sin(time * 0.8 + k * 1.7) * 0.03;
      pPos[k * 3 + 2] = 0;
      pSize[k * 2] = p.w;
      pSize[k * 2 + 1] = p.d;
      pAlpha[k] = p.a;
    }
    pa.aPos.needsUpdate = pa.aSize.needsUpdate = pa.aAlpha.needsUpdate = true;

    // AI cluster anchor and infra container.
    const ai = this.ai;
    if (L.ai.on) {
      if (ai.a < 0.02) {
        ai.x = L.ai.x + 1;
        ai.y = L.ai.y;
      }
      ai.x = damp(ai.x, L.ai.x, 5, dt);
      ai.y = damp(ai.y, L.ai.y, 5, dt);
    }
    ai.a = damp(ai.a, L.ai.on ? 1 : 0, 5, dt);
    const inf = this.infra;
    if (L.infra.on)
      for (let c = 0; c < 3; c++) {
        if (inf.a < 0.02) {
          inf.min[c] = L.infra.min[c] - 0.4;
          inf.max[c] = L.infra.max[c] + 0.4;
        }
        inf.min[c] = damp(inf.min[c], L.infra.min[c], 5, dt);
        inf.max[c] = damp(inf.max[c], L.infra.max[c], 5, dt);
      }
    inf.a = damp(inf.a, L.infra.on ? 1 : 0, 5, dt);
    for (let c = 0; c < 3; c++) this.title[c] = damp(this.title[c], L.title[c], 5, dt);

    // Technology nodes.
    const na = gl.nAttr;
    const nPos = na.aPos.array as Float32Array;
    const nSize = na.aSize.array as Float32Array;
    const nCol = na.aColor.array as Float32Array;
    const nAlpha = na.aAlpha.array as Float32Array;
    const nHi = na.aHi.array as Float32Array;
    const hiIdx = f.tech ? (this.vocab.index.get(f.tech) ?? -1) : -1;
    for (let i = 0; i < v; i++) {
      const o = i * 3;
      if (this.wait[i] > 0) {
        this.wait[i] -= dt;
      } else {
        const lam = this.talpha[i] > 0 ? 5.5 : 3;
        this.pos[o] = damp(this.pos[o], this.tgt[o], lam, dt);
        this.pos[o + 1] = damp(this.pos[o + 1], this.tgt[o + 1], lam, dt);
        this.pos[o + 2] = damp(this.pos[o + 2], this.tgt[o + 2], lam, dt);
        this.alpha[i] = damp(this.alpha[i], this.talpha[i], this.talpha[i] > 0 ? 6 : 4.5, dt);
        if (this.alpha[i] < 0.004 && this.talpha[i] === 0) this.alpha[i] = 0;
      }
      const c = this.tier[this.tierOf[i]];
      this.col[o] = damp(this.col[o], c.r, 6, dt);
      this.col[o + 1] = damp(this.col[o + 1], c.g, 6, dt);
      this.col[o + 2] = damp(this.col[o + 2], c.b, 6, dt);
      this.hi[i] = damp(this.hi[i], i === hiIdx && L.on[i] ? 1 : 0, 9, dt);
      const a = this.alpha[i];
      nPos[o] = this.pos[o];
      nPos[o + 1] = this.pos[o + 1] + Math.sin(time * 1.1 + i * 1.37) * 0.025 * a;
      nPos[o + 2] = this.pos[o + 2];
      nSize[i] = SIZE.tech * (0.3 + 0.7 * a) * (1 + 0.35 * this.hi[i]);
      nCol[o] = this.col[o];
      nCol[o + 1] = this.col[o + 1];
      nCol[o + 2] = this.col[o + 2];
      nAlpha[i] = a;
      nHi[i] = this.hi[i];
    }
    // Neurons (input, hidden) round the AI anchor; ports at each platform's centre.
    const aiC = this.tier[4];
    const nHidden = this.quality === "low" ? 3 : N_HID;
    for (let j = 0; j < N_IN + N_HID; j++) {
      const i = v + j;
      const o = i * 3;
      const input = j < N_IN;
      const k = input ? j : j - N_IN;
      const show = input || k < nHidden;
      nPos[o] = ai.x + (input ? 0 : 0.52);
      nPos[o + 1] = ai.y + (input ? (k - 1) * 0.36 : (k - (nHidden - 1) / 2) * 0.32) + Math.sin(time * 1.6 + j) * 0.03;
      nPos[o + 2] = input ? 0 : Math.sin(k * 2.1) * 0.18;
      nSize[i] = SIZE.neuron * (0.4 + 0.6 * ai.a);
      aiC.toArray(nCol, o);
      nAlpha[i] = show ? ai.a * (0.75 + 0.25 * Math.sin(time * 3 + j * 1.3)) : 0;
      nHi[i] = 0;
    }
    for (let k = 0; k < 3; k++) {
      const i = this.port(k);
      const o = i * 3;
      const p = this.plat[k];
      nPos[o] = 0;
      nPos[o + 1] = p.y + Math.sin(time * 0.8 + k * 1.7) * 0.03 + 0.02;
      nPos[o + 2] = 0;
      nSize[i] = SIZE.port;
      this.tier[k].toArray(nCol, o);
      nAlpha[i] = p.a * 0.9;
      nHi[i] = 0;
    }
    na.aPos.needsUpdate = na.aSize.needsUpdate = na.aColor.needsUpdate = na.aAlpha.needsUpdate = na.aHi.needsUpdate = true;

    this.links();

    const opacity = clamp01(f.weight * 1.15);
    for (const m of [gl.platformMat, gl.nodeMat, gl.linkMat]) {
      m.uniforms.uTime.value = time;
      m.uniforms.uOpacity.value = opacity;
      m.uniforms.uScale.value = s;
    }
    state.invalidate();
  }

  /** Rebuild the link instances from the live node positions. */
  private links() {
    const la = this.gl.lAttr;
    const A = la.aA.array as Float32Array;
    const B = la.aB.array as Float32Array;
    const W = la.aW.array as Float32Array;
    const AL = la.aAlpha.array as Float32Array;
    const K = la.aKind.array as Float32Array;
    const S = la.aSeed.array as Float32Array;
    const C = la.aColor.array as Float32Array;
    const v = this.v;
    const P = this.gl.nAttr.aPos.array as Float32Array;
    let n = 0;
    const push = (a: number, b: number, w: number, al: number, kind: number, color: Color, seed: number) => {
      if (n >= MAX_LINKS || al <= 0.004) return;
      const o = n * 3;
      A[o] = P[a];
      A[o + 1] = P[a + 1];
      A[o + 2] = P[a + 2];
      B[o] = P[b];
      B[o + 1] = P[b + 1];
      B[o + 2] = P[b + 2];
      W[n] = w;
      AL[n] = al;
      K[n] = kind;
      S[n] = seed;
      color.toArray(C, o);
      n++;
    };
    const L = this.L;
    // Spine between consecutive live platforms (requests down, responses up).
    let prev = -1;
    for (let k = 0; k < 3; k++) {
      if (!L.platforms[k].on) continue;
      if (prev >= 0)
        push(this.port(prev) * 3, this.port(k) * 3, 0.17, Math.min(this.plat[prev].a, this.plat[k].a), LINK.spine, this.tier[3], prev * 0.31);
      prev = k;
    }
    // Spokes: each platform's port to its technologies (dissolving ones included).
    for (let i = 0; i < v; i++) {
      const t = this.tierOf[i];
      if (t > 2 || this.alpha[i] <= 0.01) continue;
      push(this.port(t) * 3, i * 3, 0.05, this.alpha[i] * this.plat[t].a * 0.85, LINK.spoke, this.tier[t], i * 0.173);
    }
    // AI: the host platform's port → input neurons → hidden → AI technologies.
    const ai = this.ai;
    if (ai.a > 0.004) {
      const host = L.ai.port;
      const aiC = this.tier[4];
      const nHidden = this.quality === "low" ? 3 : N_HID;
      for (let j = 0; j < N_IN; j++) {
        const o = (v + j) * 3;
        push(this.port(host) * 3, o, 0.06, ai.a * this.plat[host].a, LINK.ai, aiC, j * 0.37);
        for (let h = 0; h < nHidden; h++) push(o, (v + N_IN + h) * 3, 0.035, ai.a * 0.7, LINK.ai, aiC, (j * 4 + h) * 0.21);
      }
      for (let i = 0; i < v; i++) {
        if (this.tierOf[i] !== 4 || this.alpha[i] <= 0.01) continue;
        for (let h = 0; h < nHidden; h++) push((v + N_IN + h) * 3, i * 3, 0.035, ai.a * this.alpha[i] * 0.8, LINK.ai, aiC, (i + h) * 0.29);
      }
    }
    const g = this.gl.links;
    g.instanceCount = this.frame12(n, A, B, W, AL, K, S, C);
    for (const k of LINK_ATTRS) la[k].needsUpdate = true;
  }

  /** Infra container: the 12 edges of its box, appended after the other links. */
  private frame12(
    n: number,
    A: Float32Array,
    B: Float32Array,
    W: Float32Array,
    AL: Float32Array,
    K: Float32Array,
    S: Float32Array,
    C: Float32Array,
  ): number {
    const inf = this.infra;
    if (inf.a <= 0.004) return n;
    const [x0, y0, z0] = inf.min;
    const [x1, y1, z1] = inf.max;
    const c = this.tier[3];
    for (let e = 0; e < 12 && n < MAX_LINKS; e++) {
      // Edges: 4 along x, 4 along y, 4 along z.
      const axis = e >> 2;
      const u = e & 1 ? 1 : 0;
      const w = e & 2 ? 1 : 0;
      const o = n * 3;
      const ax = axis === 0 ? x0 : u ? x1 : x0;
      const ay = axis === 1 ? y0 : axis === 0 ? (u ? y1 : y0) : w ? y1 : y0;
      const az = axis === 2 ? z0 : w ? z1 : z0;
      A[o] = ax;
      A[o + 1] = ay;
      A[o + 2] = az;
      B[o] = axis === 0 ? x1 : ax;
      B[o + 1] = axis === 1 ? y1 : ay;
      B[o + 2] = axis === 2 ? z1 : az;
      W[n] = 0.03;
      AL[n] = inf.a * 0.9;
      K[n] = LINK.frame;
      S[n] = e * 0.13;
      c.toArray(C, o);
      n++;
    }
    return n;
  }

  dispose() {
    this.gl.dispose();
  }
}
