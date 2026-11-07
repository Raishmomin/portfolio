// The services scene's mutable side: pools of slabs, solids, links and sprites eased toward
// the active machine's blueprint, plus the machine's program (packets, fills, containers in
// flight) written into the five instanced draw calls every frame.
// Switching machines reuses the pools: a part that keeps its kind glides to its new place
// (left to right, staggered), parts the new machine lacks sink and dissolve, new ones rise
// in from below while their links draw on. No allocation per frame: every buffer, scratch
// array and override table is preallocated.
import { Color, type Group } from "three";
import { isLight } from "../../fx";
import type { NeuralData, ScenePalette } from "../../types";
import { buildDesigns, type Design, type Live, type Tint } from "./designs";
import { createGl, MAX, type Gl } from "./gl";

const DYN = { sprites: 84, boxes: 10 } as const;
const STATIC = { slabs: MAX.slabs, boxes: MAX.boxes - DYN.boxes, cyls: MAX.cyls, sprites: MAX.sprites - DYN.sprites, links: MAX.links } as const;
/** Seconds after a switch before the program runs (the machine assembles first). */
const ASSEMBLE = 0.85;
const YAW = 0.3;
const PITCH = 0.1;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const damp = (a: number, b: number, lambda: number, dt: number) => a + (b - a) * (1 - Math.exp(-lambda * dt));

/**
 * One pool of instances: `ch` eased float channels per slot (position first), a kind key
 * (a slot glides only between parts of the same kind; otherwise it dissolves and respawns),
 * snapped extras, presence and a draw-on fraction.
 */
class Track {
  readonly cur: Float32Array;
  readonly tgt: Float32Array;
  readonly ext: Float32Array;
  readonly next: Float32Array;
  readonly nextExt: Float32Array;
  readonly alpha: Float32Array;
  readonly talpha: Float32Array;
  readonly wait: Float32Array;
  readonly draw: Float32Array;
  readonly key: Int16Array;
  readonly nextKey: Int16Array;
  readonly pend: Uint8Array;
  readonly delay: Float32Array;
  constructor(
    readonly n: number,
    readonly ch: number,
    readonly ex: number,
    /** Channels shrunk while a part spawns (sizes). */
    private readonly sizes: number[],
    /** Spawn offset per channel (rise from below and in front). */
    private readonly offset: number[],
  ) {
    this.cur = new Float32Array(n * ch);
    this.tgt = new Float32Array(n * ch);
    this.next = new Float32Array(n * ch);
    this.ext = new Float32Array(n * ex);
    this.nextExt = new Float32Array(n * ex);
    this.alpha = new Float32Array(n);
    this.talpha = new Float32Array(n);
    this.wait = new Float32Array(n);
    this.draw = new Float32Array(n);
    this.key = new Int16Array(n).fill(-1);
    this.nextKey = new Int16Array(n).fill(-1);
    this.pend = new Uint8Array(n);
    this.delay = new Float32Array(n);
  }

  /** New target for slot i (vals = null: the slot empties). */
  assign(i: number, vals: number[] | null, key: number, extras: number[], delay: number) {
    const { ch, ex } = this;
    if (!vals) {
      this.talpha[i] = 0;
      this.pend[i] = 0;
      this.wait[i] = 0;
      if (this.alpha[i] > 0.02) {
        // Sink while dissolving.
        this.tgt[i * ch + 1] = this.cur[i * ch + 1] - 0.35;
      }
      return;
    }
    for (let c = 0; c < ch; c++) this.next[i * ch + c] = vals[c];
    for (let c = 0; c < ex; c++) this.nextExt[i * ex + c] = extras[c];
    this.nextKey[i] = key;
    this.delay[i] = delay;
    if (this.alpha[i] < 0.02) this.spawn(i);
    else if (this.key[i] === key) {
      // Glide: same kind of part, new place.
      for (let c = 0; c < ch; c++) this.tgt[i * ch + c] = vals[c];
      for (let c = 0; c < ex; c++) this.ext[i * ex + c] = extras[c];
      this.talpha[i] = 1;
      this.pend[i] = 0;
      this.wait[i] = delay * 0.6;
    } else {
      // Another kind: dissolve first, then respawn as the new part.
      this.talpha[i] = 0;
      this.pend[i] = 1;
      this.wait[i] = 0;
    }
  }

  private spawn(i: number) {
    const { ch, ex } = this;
    for (let c = 0; c < ch; c++) {
      const v = this.next[i * ch + c];
      this.tgt[i * ch + c] = v;
      this.cur[i * ch + c] = v + this.offset[c];
    }
    for (const c of this.sizes) this.cur[i * ch + c] *= 0.3;
    for (let c = 0; c < ex; c++) this.ext[i * ex + c] = this.nextExt[i * ex + c];
    this.key[i] = this.nextKey[i];
    this.alpha[i] = 0;
    this.talpha[i] = 1;
    this.draw[i] = 0;
    this.wait[i] = this.delay[i];
    this.pend[i] = 0;
  }

  /** Everything gone at once (a fresh assembly follows). */
  reset() {
    this.alpha.fill(0);
    this.talpha.fill(0);
    this.pend.fill(0);
  }

  step(dt: number) {
    const { ch, n } = this;
    const k = 1 - Math.exp(-5.2 * dt);
    const kIn = 1 - Math.exp(-5.5 * dt);
    const kOut = 1 - Math.exp(-7 * dt);
    for (let i = 0; i < n; i++) {
      if (this.wait[i] > 0) {
        this.wait[i] -= dt;
        continue;
      }
      if (this.talpha[i] === 0 && this.alpha[i] === 0) continue;
      const o = i * ch;
      for (let c = 0; c < ch; c++) this.cur[o + c] += (this.tgt[o + c] - this.cur[o + c]) * k;
      this.alpha[i] += (this.talpha[i] - this.alpha[i]) * (this.talpha[i] > 0 ? kIn : kOut);
      if (this.talpha[i] > 0) this.draw[i] = Math.min(1, this.draw[i] + dt * 1.8);
      if (this.talpha[i] === 0 && this.alpha[i] < 0.01) {
        this.alpha[i] = 0;
        if (this.pend[i]) this.spawn(i);
      }
    }
  }
}

export type ServicesRegistry = { root: Group | null; tilt: Group | null };
export const emptyRegistry = (): ServicesRegistry => ({ root: null, tilt: null });

export type ServicesFrame = {
  /** Index of the service to show. */
  active: number;
  weight: number;
  pointer: { x: number; y: number };
  /** Where the machine's centre goes (world, z = 0), its world units per layout unit, and its turn (-1..1). */
  x: number;
  y: number;
  scale: number;
  turn: number;
  /** 0..1 extra fade (no room in the frame). */
  room: number;
};

/** The programs' frame interface (one instance, reused). */
class LiveImpl implements Live {
  t = 0;
  dt = 0;
  low = false;
  /** Emits' alpha multiplier; overrides are ignored when false (a program fading out). */
  mul = 1;
  own = true;
  ns = 0;
  nb = 0;
  constructor(private readonly r: ServicesRig) {}
  fill(i: number, v: number) {
    if (this.own && i < STATIC.slabs) this.r.fillOv[i] = v;
  }
  glow(kind: 0 | 1 | 2, i: number, v: number) {
    if (!this.own) return;
    const a = kind === 0 ? this.r.glowB : kind === 1 ? this.r.glowC : this.r.glowS;
    const cur = a[i];
    a[i] = cur !== cur ? clamp01(v) : Math.max(cur, clamp01(v));
  }
  line(i: number, ax: number, ay: number, az: number, bx: number, by: number, bz: number) {
    if (!this.own || i >= STATIC.links) return;
    const o = i * 6;
    const L = this.r.lineOv;
    L[o] = ax;
    L[o + 1] = ay;
    L[o + 2] = az;
    L[o + 3] = bx;
    L[o + 4] = by;
    L[o + 5] = bz;
    this.r.lineSet[i] = 1;
  }
  packet(x: number, y: number, z: number, size: number, tint: Tint, alpha: number, tx = 0, ty = 0, tz = 0) {
    const a = alpha * this.mul;
    if (a <= 0.01) return;
    const trail = tx !== 0 || ty !== 0 || tz !== 0 ? (this.low ? 1 : 2) : 0;
    for (let g = 0; g <= trail; g++) {
      if (this.ns >= DYN.sprites) return;
      this.r.emitSprite(STATIC.sprites + this.ns++, x + tx * g, y + ty * g, z + tz * g, size * (1 - g * 0.22), tint, a * (1 - g * 0.38));
    }
  }
  box(x: number, y: number, z: number, size: number, tint: Tint, alpha: number, glow: number, ry: number) {
    const a = alpha * this.mul;
    if (a <= 0.01 || this.nb >= DYN.boxes) return;
    this.r.emitBox(STATIC.boxes + this.nb++, x, y, z, size, tint, a, glow, ry);
  }
}

export class ServicesRig {
  readonly gl: Gl;
  readonly designs: Design[];
  private readonly slabs = new Track(STATIC.slabs, 8, 3, [3, 4], [0, -0.45, 0.6, 0, 0, 0, 0, 0]);
  private readonly boxes = new Track(STATIC.boxes, 11, 1, [3, 4, 5], [0, -0.5, 0.7, 0, 0, 0, 0, 0, 0, 0, 0]);
  private readonly cyls = new Track(STATIC.cyls, 11, 1, [3, 4, 5], [0, -0.5, 0.7, 0, 0, 0, 0, 0, 0, 0, 0]);
  private readonly sprites = new Track(STATIC.sprites, 7, 0, [3], [0, -0.4, 0.6, 0, 0, 0, 0]);
  private readonly links = new Track(STATIC.links, 12, 2, [], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  /** Program overrides, reset every frame (NaN = untouched). */
  readonly fillOv = new Float32Array(STATIC.slabs);
  readonly glowB = new Float32Array(STATIC.boxes);
  readonly glowC = new Float32Array(STATIC.cyls);
  readonly glowS = new Float32Array(STATIC.sprites);
  readonly lineOv = new Float32Array(STATIC.links * 6);
  readonly lineSet = new Uint8Array(STATIC.links);
  /** Label presence per machine (the component places them). */
  readonly labelAlpha: Float32Array;
  current = -1;
  private prev = -1;
  private clock = 0;
  private prevClock = 0;
  private time = 0;
  private readonly live = new LiveImpl(this);
  private readonly tints = [0, 1, 2, 3, 4].map(() => new Color());
  private readonly fit = { x: 0, y: 0, s: 0, turn: 0, first: true };
  private yaw = 0;
  private pitch = PITCH;
  private low: boolean;
  private readonly tracks: Track[];
  private readonly attrs: { needsUpdate: boolean }[][];

  constructor(services: NeuralData["services"], quality: "high" | "low") {
    this.low = quality === "low";
    this.designs = buildDesigns(services, this.low);
    this.gl = createGl();
    this.tracks = [this.slabs, this.boxes, this.cyls, this.sprites, this.links];
    const g = this.gl;
    this.attrs = [g.sAttr, g.bAttr, g.cAttr, g.lAttr, g.pAttr].map((a) => Object.values(a));
    this.labelAlpha = new Float32Array(this.designs.length);
    this.gl.slabMat.uniforms.uDetail.value = this.low ? 0 : 1;
  }

  setPalette(p: ScenePalette) {
    this.gl.setLight(isLight(p.bg));
    [p.fg, p.accent, p.ok, p.muted, p.ai].forEach((h, k) => this.tints[k].set(h));
    const { slabMat, boxMat, cylMat, linkMat, spriteMat } = this.gl;
    slabMat.uniforms.uBg.value.set(p.bg);
    slabMat.uniforms.uFg.value.set(p.fg);
    slabMat.uniforms.uMuted.value.set(p.muted);
    for (const m of [boxMat, cylMat]) {
      m.uniforms.uBg.value.set(p.bg);
      m.uniforms.uFg.value.set(p.fg);
    }
    linkMat.uniforms.uReq.value.set(p.accent);
    linkMat.uniforms.uRes.value.set(p.ok);
    spriteMat.uniforms.uAccent.value.set(p.accent);
    // Snap every live colour to the new theme.
    if (this.current >= 0) this.apply(this.current, true);
  }

  /** Tint channels of a part. */
  private rgb(t: Tint, out: number[], o: number) {
    const c = this.tints[t];
    out[o] = c.r;
    out[o + 1] = c.g;
    out[o + 2] = c.b;
  }

  /** Point every pool at machine d. `snapColor`: only refresh colours (theme change). */
  private apply(d: number, snapColor = false) {
    const D = this.designs[d];
    const v: number[] = new Array(12).fill(0);
    const stagger = (x: number) => 0.03 + clamp01((x + 4.2) / 8.4) * 0.5;
    const fix = (tr: Track, i: number, o: number) => {
      // Theme change: colours jump to their new values.
      if (snapColor) for (let c = 0; c < 3; c++) tr.cur[i * tr.ch + o + c] = tr.tgt[i * tr.ch + o + c] = v[o + c];
    };
    for (let i = 0; i < STATIC.slabs; i++) {
      const s = D.slabs[i];
      if (!s) {
        if (!snapColor) this.slabs.assign(i, null, 0, [], 0);
        continue;
      }
      v[0] = s.x;
      v[1] = s.y;
      v[2] = s.z;
      v[3] = s.w;
      v[4] = s.h;
      this.rgb(s.tint, v, 5);
      if (snapColor) fix(this.slabs, i, 5);
      else this.slabs.assign(i, v, s.style * 2 + s.flat, [s.fill, s.style, s.flat], stagger(s.x));
    }
    for (const [tr, list] of [
      [this.boxes, D.boxes],
      [this.cyls, D.cyls],
    ] as const) {
      for (let i = 0; i < tr.n; i++) {
        const s = list[i];
        if (!s) {
          if (!snapColor) tr.assign(i, null, 0, [], 0);
          continue;
        }
        v[0] = s.x;
        v[1] = s.y;
        v[2] = s.z;
        v[3] = s.sx;
        v[4] = s.sy;
        v[5] = s.sz;
        this.rgb(s.tint, v, 6);
        v[9] = s.rx;
        v[10] = s.ry;
        if (snapColor) fix(tr, i, 6);
        else tr.assign(i, v, s.sides, [s.sides], stagger(s.x));
      }
    }
    for (let i = 0; i < STATIC.sprites; i++) {
      const s = D.sprites[i];
      if (!s) {
        if (!snapColor) this.sprites.assign(i, null, 0, [], 0);
        continue;
      }
      v[0] = s.x;
      v[1] = s.y;
      v[2] = s.z;
      v[3] = s.size;
      this.rgb(s.tint, v, 4);
      if (snapColor) fix(this.sprites, i, 4);
      else this.sprites.assign(i, v, s.kind, [], stagger(s.x));
    }
    for (let i = 0; i < STATIC.links; i++) {
      const s = D.links[i];
      if (!s) {
        if (!snapColor) this.links.assign(i, null, 0, [], 0);
        continue;
      }
      v[0] = s.ax;
      v[1] = s.ay;
      v[2] = s.az;
      v[3] = s.bx;
      v[4] = s.by;
      v[5] = s.bz;
      v[6] = s.w;
      this.rgb(s.tint, v, 7);
      v[10] = s.speed;
      v[11] = s.alpha;
      if (snapColor) fix(this.links, i, 7);
      else this.links.assign(i, v, s.kind, [s.kind, s.seed], stagger(Math.min(s.ax, s.bx)));
    }
  }

  /** Assemble machine d from scratch (first view, or returning to the section). */
  reassemble(d: number) {
    for (const tr of this.tracks) tr.reset();
    this.prev = -1;
    this.current = d;
    this.clock = 0;
    this.apply(d);
  }

  private switchTo(d: number) {
    this.prev = this.current;
    this.prevClock = this.clock;
    this.current = d;
    this.clock = 0;
    this.apply(d);
  }

  emitSprite(i: number, x: number, y: number, z: number, size: number, tint: Tint, a: number) {
    const A = this.gl.pAttr;
    const P = A.aPos.array as Float32Array;
    P[i * 3] = x;
    P[i * 3 + 1] = y;
    P[i * 3 + 2] = z;
    (A.aSize.array as Float32Array)[i] = size;
    this.tints[tint].toArray(A.aColor.array as Float32Array, i * 3);
    (A.aAlpha.array as Float32Array)[i] = a;
    (A.aKind.array as Float32Array)[i] = 2;
    (A.aHi.array as Float32Array)[i] = 0;
  }

  emitBox(i: number, x: number, y: number, z: number, size: number, tint: Tint, a: number, glow: number, ry: number) {
    const A = this.gl.bAttr;
    const P = A.aPos.array as Float32Array;
    P[i * 3] = x;
    P[i * 3 + 1] = y;
    P[i * 3 + 2] = z;
    const S = A.aScale.array as Float32Array;
    S[i * 3] = S[i * 3 + 1] = S[i * 3 + 2] = size;
    this.tints[tint].toArray(A.aTint.array as Float32Array, i * 3);
    (A.aAlpha.array as Float32Array)[i] = a;
    const R = A.aRot.array as Float32Array;
    R[i * 2] = 0;
    R[i * 2 + 1] = ry;
    (A.aGlow.array as Float32Array)[i] = glow;
    (A.aSides.array as Float32Array)[i] = 0;
  }

  frame(time: number, delta: number, f: ServicesFrame, root: Group, tilt: Group) {
    const dt = Math.min(delta, 0.1);
    this.time = time;
    const n = this.designs.length;
    if (n === 0) return;
    const active = Math.max(0, Math.min(n - 1, f.active));
    if (this.current < 0) this.reassemble(active);
    else if (active !== this.current) this.switchTo(active);
    this.clock += dt;
    this.prevClock += dt;

    // Fit: centre and scale eased; the machine turns toward the content it sits beside.
    const fit = this.fit;
    if (fit.first) {
      fit.x = f.x;
      fit.y = f.y;
      fit.s = f.scale;
      fit.turn = f.turn;
      fit.first = false;
    }
    fit.x = damp(fit.x, f.x, 12, dt);
    fit.y = damp(fit.y, f.y, 12, dt);
    fit.s = damp(fit.s, f.scale, 6, dt);
    fit.turn = damp(fit.turn, f.turn, 3, dt);
    const s = fit.s * (0.94 + 0.06 * f.weight);
    root.position.set(fit.x, fit.y, 0);
    root.scale.setScalar(s);
    this.yaw = damp(this.yaw, YAW * fit.turn + f.pointer.x * 0.14, 2.5, dt);
    this.pitch = damp(this.pitch, PITCH - f.pointer.y * 0.07, 2.5, dt);
    tilt.rotation.set(this.pitch + Math.sin(time * 0.21) * 0.012, this.yaw + Math.sin(time * 0.13) * 0.03, 0);

    for (let k = 0; k < this.tracks.length; k++) this.tracks[k].step(dt);

    // Programs: the current machine once assembled; the previous one fades out meanwhile.
    this.fillOv.fill(NaN);
    this.glowB.fill(NaN);
    this.glowC.fill(NaN);
    this.glowS.fill(NaN);
    this.lineSet.fill(0);
    const live = this.live;
    live.ns = 0;
    live.nb = 0;
    live.dt = dt;
    live.low = this.low;
    if (this.prev >= 0 && this.clock < 0.35) {
      live.own = false;
      live.mul = 1 - this.clock / 0.35;
      live.t = this.prevClock - ASSEMBLE;
      if (live.t > 0) this.designs[this.prev].animate(live);
    }
    live.own = true;
    live.t = this.clock - ASSEMBLE;
    live.mul = clamp01(live.t / 0.5);
    if (live.t > 0) this.designs[this.current].animate(live);
    for (let i = 0; i < n; i++) {
      const target = i === this.current && this.clock > 0.5 ? 1 : 0;
      this.labelAlpha[i] = damp(this.labelAlpha[i], target, target ? 4 : 9, dt);
    }

    this.write(live.ns, live.nb);
    const opacity = clamp01(f.weight * 1.15) * f.room;
    for (const m of this.gl.mats) {
      m.uniforms.uTime.value = time;
      m.uniforms.uOpacity.value = opacity;
    }
    this.gl.linkMat.uniforms.uScale.value = s;
    this.gl.spriteMat.uniforms.uScale.value = s;
  }

  /** Pools + program overrides → instance attributes. */
  private write(ns: number, nb: number) {
    const g = this.gl;
    for (const list of this.attrs) for (let k = 0; k < list.length; k++) list[k].needsUpdate = true;
    // Slabs.
    {
      const t = this.slabs;
      const A = g.sAttr;
      const P = A.aPos.array as Float32Array;
      const S = A.aSize.array as Float32Array;
      const C = A.aTint.array as Float32Array;
      const AL = A.aAlpha.array as Float32Array;
      const F = A.aFill.array as Float32Array;
      const ST = A.aStyle.array as Float32Array;
      const FL = A.aFlat.array as Float32Array;
      for (let i = 0; i < t.n; i++) {
        const o = i * 8;
        const c = t.cur;
        P[i * 3] = c[o];
        P[i * 3 + 1] = c[o + 1];
        P[i * 3 + 2] = c[o + 2];
        S[i * 2] = c[o + 3];
        S[i * 2 + 1] = c[o + 4];
        C[i * 3] = c[o + 5];
        C[i * 3 + 1] = c[o + 6];
        C[i * 3 + 2] = c[o + 7];
        AL[i] = t.alpha[i];
        const ov = this.fillOv[i];
        F[i] = ov === ov ? ov : t.ext[i * 3];
        ST[i] = t.ext[i * 3 + 1];
        FL[i] = t.ext[i * 3 + 2];
      }
    }
    this.writeSolids(this.boxes, g.bAttr, this.glowB, MAX.boxes, nb);
    this.writeSolids(this.cyls, g.cAttr, this.glowC, MAX.cyls, 0);
    // Links.
    {
      const t = this.links;
      const A = g.lAttr;
      const PA = A.aA.array as Float32Array;
      const PB = A.aB.array as Float32Array;
      const W = A.aW.array as Float32Array;
      const AL = A.aAlpha.array as Float32Array;
      const K = A.aKind.array as Float32Array;
      const SE = A.aSeed.array as Float32Array;
      const SP = A.aSpeed.array as Float32Array;
      const DR = A.aDraw.array as Float32Array;
      const C = A.aColor.array as Float32Array;
      let live = 0;
      for (let i = 0; i < t.n; i++) {
        const o = i * 12;
        const c = t.cur;
        if (this.lineSet[i] && t.talpha[i] > 0) {
          // A live graph line: follows the program exactly.
          for (let k = 0; k < 6; k++) c[o + k] = t.tgt[o + k] = this.lineOv[i * 6 + k];
        }
        PA[i * 3] = c[o];
        PA[i * 3 + 1] = c[o + 1];
        PA[i * 3 + 2] = c[o + 2];
        PB[i * 3] = c[o + 3];
        PB[i * 3 + 1] = c[o + 4];
        PB[i * 3 + 2] = c[o + 5];
        W[i] = c[o + 6];
        C[i * 3] = c[o + 7];
        C[i * 3 + 1] = c[o + 8];
        C[i * 3 + 2] = c[o + 9];
        SP[i] = c[o + 10];
        AL[i] = t.alpha[i] * c[o + 11];
        K[i] = t.ext[i * 2];
        SE[i] = t.ext[i * 2 + 1];
        DR[i] = t.draw[i];
        if (AL[i] > 0) live = i + 1;
      }
      // Draw only up to the last live link.
      g.links.instanceCount = live;
    }
    // Sprites (static part; the dynamic part was written by the programs).
    {
      const t = this.sprites;
      const A = g.pAttr;
      const P = A.aPos.array as Float32Array;
      const S = A.aSize.array as Float32Array;
      const C = A.aColor.array as Float32Array;
      const AL = A.aAlpha.array as Float32Array;
      const K = A.aKind.array as Float32Array;
      const H = A.aHi.array as Float32Array;
      let live = 0;
      for (let i = 0; i < t.n; i++) {
        const o = i * 7;
        const c = t.cur;
        const gv = this.glowS[i];
        const touched = gv === gv;
        const kind = t.key[i];
        P[i * 3] = c[o];
        P[i * 3 + 1] = c[o + 1] + Math.sin(this.time * 1.3 + i * 0.9) * 0.018;
        P[i * 3 + 2] = c[o + 2];
        S[i] = c[o + 3] * (1 + (touched && kind !== 3 ? gv * 0.4 : 0));
        C[i * 3] = c[o + 4];
        C[i * 3 + 1] = c[o + 5];
        C[i * 3 + 2] = c[o + 6];
        // Dots driven by a program blink; others brighten.
        AL[i] = t.alpha[i] * (touched && kind === 3 ? 0.25 + 0.75 * gv : 1);
        K[i] = kind < 0 ? 0 : kind;
        H[i] = touched && kind === 1 ? gv : 0;
        if (AL[i] > 0) live = i + 1;
      }
      for (let i = t.n + ns; i < MAX.sprites; i++) AL[i] = 0;
      // Static sprites up to the last live one, then the program's packets after them.
      g.sprites.instanceCount = ns > 0 ? t.n + ns : live;
    }
  }

  private writeSolids(t: Track, A: Gl["bAttr"], glow: Float32Array, max: number, dynamic: number) {
    const P = A.aPos.array as Float32Array;
    const S = A.aScale.array as Float32Array;
    const C = A.aTint.array as Float32Array;
    const AL = A.aAlpha.array as Float32Array;
    const R = A.aRot.array as Float32Array;
    const G = A.aGlow.array as Float32Array;
    const SD = A.aSides.array as Float32Array;
    const c = t.cur;
    for (let i = 0; i < t.n; i++) {
      const o = i * 11;
      const gv = glow[i];
      const lit = gv === gv ? gv : 0;
      const bob = Math.sin(this.time * 1.1 + i * 1.37) * 0.02;
      P[i * 3] = c[o];
      P[i * 3 + 1] = c[o + 1] + bob + lit * 0.06;
      P[i * 3 + 2] = c[o + 2];
      S[i * 3] = c[o + 3];
      S[i * 3 + 1] = c[o + 4];
      S[i * 3 + 2] = c[o + 5];
      C[i * 3] = c[o + 6];
      C[i * 3 + 1] = c[o + 7];
      C[i * 3 + 2] = c[o + 8];
      R[i * 2] = c[o + 9];
      R[i * 2 + 1] = c[o + 10];
      AL[i] = t.alpha[i];
      G[i] = lit;
      SD[i] = t.ext[i];
    }
    for (let i = t.n + dynamic; i < max; i++) AL[i] = 0;
  }

  dispose() {
    this.gl.dispose();
  }
}
