// The AI scene's mutable side. Builds every stage object once (instances in slot-local
// space), then each frame: eases the slots toward the active project's plan (a project
// switch glides shared stages to their new place, grows new ones and dissolves the rest),
// runs one request through the system on a clock (each stage's activity and phase drive
// its animation in the shaders), writes the conduits between stages and the travelling
// tokens, and fits, tilts and gently follows the request. No allocation per frame.
import type { RootState } from "@react-three/fiber";
import { Color, type Group } from "three";
import type { ScenePalette } from "../../types";
import { createGl, Instances, LINK, LINK_SPEC, MAX_COND, MAX_TOK, PANEL_SPEC, ROLE, SEG, SHAPE, SPRITE, SPRITE_SPEC, type Gl } from "./gl";
import { CLEAR, EXT, MAX_RINGS, MAX_SLOTS, PORT, TRAVEL, type AiModel, type Plan } from "./layout";
import { clamp01, damp, isLight, rng, smooth } from "./shared";
import type { StageKind } from "./system";

/** Colour roles (resolved from the palette): foreground, AI accent, answer orange, data green, muted. */
const T = { fg: 0, ai: 1, accent: 2, ok: 3, muted: 4 } as const;
type Tone = (typeof T)[keyof typeof T];
const DEG = Math.PI / 180;
const STREAM_RATE = 7; // tokens per second while the model answers
const TOKEN_SIZE = [0.3, 0.21, 0.15, 0.1];
/** Base tilt of the whole system (looking a little down onto it) and its pointer parallax. */
const PITCH = 0.2;
const YAW = -0.1;

/** Ring r of the model core: one per model provider, crossed like an atom's orbits. */
export function ringBasis(r: number): [number[], number[]] {
  const R = 1.32 + 0.12 * r;
  const a = [0, 62, -62][r] * DEG;
  const b = 73 * DEG;
  return [
    [R * Math.cos(a), R * Math.sin(a), 0],
    [-R * Math.sin(a) * Math.cos(b), R * Math.cos(a) * Math.cos(b), R * Math.sin(b)],
  ];
}

class Tones {
  readonly tone: Uint8Array;
  readonly mix: Float32Array;
  constructor(n: number) {
    this.tone = new Uint8Array(n);
    this.mix = new Float32Array(n);
  }
}

type P = Instances<typeof PANEL_SPEC>;
type L = Instances<typeof LINK_SPEC>;
type S = Instances<typeof SPRITE_SPEC>;
type Pt = [number, number, number];

/** Rotation about x (the far side rises), so flat parts read from a little above. */
function tiltX(v: readonly number[], a: number): number[] {
  if (!a) return [...v];
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c];
}

/** Static instance builder: every instance remembers its colour role for theme changes. */
class Builder {
  /** Local tilt applied to everything pushed (per object). */
  tilt = 0;
  constructor(
    readonly P: P,
    readonly L: L,
    readonly S: S,
    readonly G: S,
    readonly tp: Tones,
    readonly tl: Tones,
    readonly ts: Tones,
    readonly tg: Tones,
  ) {}
  panel(
    g: number,
    tone: Tone,
    v: { pos: number[]; u: number[]; v: number[]; shape: number; role?: number; variant?: number; p?: number[]; alpha?: number },
    mix = 0,
  ) {
    const t = this.tilt;
    const i = this.P.push({ aPos: tiltX(v.pos, t), aU: tiltX(v.u, t), aV: tiltX(v.v, t), aGroup: g, aAlpha: v.alpha ?? 1, aK: [v.shape, v.role ?? 0, v.variant ?? 0], aP: v.p ?? [0, 1] });
    this.tp.tone[i] = tone;
    this.tp.mix[i] = mix;
  }
  link(g: number, tone: Tone, a: number[], b: number[], kind: number, w: number, alpha = 1, seed = 0, mix = 0) {
    const i = this.L.push({ aA: tiltX(a, this.tilt), aB: tiltX(b, this.tilt), aGroup: g, aAlpha: alpha, aW: w, aK: [kind, seed, 0], aT: [0, 1] });
    this.tl.tone[i] = tone;
    this.tl.mix[i] = mix;
  }
  sprite(g: number, tone: Tone, pos: number[], size: number, kind: number, k1 = 0, alpha = 1, mix = 0) {
    // Halos go to their own draw, under the glass.
    const [set, tones] = kind === SPRITE.halo ? [this.G, this.tg] : [this.S, this.ts];
    const i = set.push({ aPos: tiltX(pos, this.tilt), aGroup: g, aSize: size, aAlpha: alpha, aK: [kind, k1, 0] });
    tones.tone[i] = tone;
    tones.mix[i] = mix;
  }
}

// ---------- the stage objects (slot-local space, about ±1 unit) ----------

/** Text lines [x0, y, length, start, tone], typed / assembled left to right in turn. */
function bars(b: Builder, g: number, rows: [number, number, number, number, Tone][], variant: number, h = 0.042) {
  rows.forEach(([x0, y, len, start, tone]) =>
    b.panel(g, tone, { pos: [x0 + len / 2, y, 0.01], u: [len / 2, 0, 0], v: [0, h, 0], shape: SHAPE.pill, role: ROLE.text, variant, p: [start, 0.24] }),
  );
}

function waves(b: Builder, g: number, tone: Tone, variant: number, y: number, n: number, width: number, height: number) {
  for (let j = 0; j < n; j++) {
    const x = -width / 2 + (width * j) / (n - 1);
    b.panel(g, tone, { pos: [x, y, 0.01], u: [0.026, 0, 0], v: [0, height, 0], shape: SHAPE.pill, role: ROLE.wave, variant, p: [j, 0] });
  }
}

/** Input: a chat window whose prompt is typed (or source code, or a live voice waveform). */
function buildInput(b: Builder, g: number) {
  b.sprite(g, T.ai, [0, 0, -0.1], 2.5, SPRITE.halo, 0, 0.45);
  b.panel(g, T.fg, { pos: [0, 0.06, 0], u: [0.76, 0, 0], v: [0, 0.5, 0], shape: SHAPE.bubble, role: ROLE.body });
  bars(
    b,
    g,
    [
      [-0.56, 0.3, 1.02, 0.04, T.fg],
      [-0.56, 0.1, 1.12, 0.3, T.fg],
      [-0.56, -0.1, 0.62, 0.56, T.fg],
    ],
    1,
  );
  bars(
    b,
    g,
    [
      [-0.56, 0.32, 0.46, 0.04, T.accent],
      [-0.38, 0.18, 0.78, 0.2, T.fg],
      [-0.2, 0.04, 0.56, 0.36, T.ai],
      [-0.38, -0.1, 0.68, 0.52, T.fg],
      [-0.56, -0.24, 0.3, 0.68, T.accent],
    ],
    2,
    0.036,
  );
  waves(b, g, T.ai, 3, 0.06, 11, 1.0, 0.3);
  // Send: lights as the prompt leaves.
  b.sprite(g, T.accent, [0.58, -0.3, 0.03], 0.17, SPRITE.orb);
}

/** Speech-to-text / text-to-speech: a voice waveform. */
function buildSpeech(b: Builder, g: number, tone: Tone) {
  b.sprite(g, tone, [0, 0, -0.1], 2.3, SPRITE.halo, 0, 0.45);
  b.panel(g, tone, { pos: [0, 0, 0], u: [0.72, 0, 0], v: [0, 0.46, 0], shape: SHAPE.card, role: ROLE.body });
  waves(b, g, tone, 0, -0.04, 13, 1.06, 0.24);
}

/** Retrieval (RAG): a vector store whose embeddings a query searches; its nearest matches light. */
function buildStore(b: Builder, g: number, tier: number, rand: () => number, matches: Pt[]) {
  const levels = [0.5, 0, -0.5];
  if (tier === 0) {
    b.sprite(g, T.ok, [0, 0, -0.1], 2.5, SPRITE.halo, 0, 0.45);
    for (const y of levels) b.panel(g, T.ok, { pos: [0, y, 0], u: [0.64, 0, 0], v: [0, 0, 0.64], shape: SHAPE.disc, role: ROLE.body, alpha: 0.9 });
    for (const x of [-0.64, 0.64]) b.link(g, T.ok, [x, 0.5, 0], [x, -0.5, 0], LINK.line, 0.011, 0.75);
  }
  const per = tier === 0 ? 14 : 12;
  levels.forEach((y, l) => {
    for (let k = 0; k < per; k++) {
      const r = 0.5 * Math.sqrt(0.08 + 0.92 * rand());
      const a = rand() * Math.PI * 2;
      const p: Pt = [r * Math.cos(a), y + 0.03 + (rand() - 0.5) * 0.06, r * Math.sin(a)];
      const match = tier === 0 && ((l === 0 && k === 3) || (l === 1 && (k === 5 || k === 10)) || (l === 2 && k === 6));
      const rank = match ? matches.length : -1;
      if (match) matches.push(p);
      b.sprite(g, T.ai, p, match ? 0.11 : 0.07 + rand() * 0.035, SPRITE.embed, rank, 1, match ? 0.2 : rand() * 0.45);
    }
  });
  if (tier === 0) {
    const q: Pt = [0, 0.56, 0.1];
    b.sprite(g, T.accent, q, 0.2, SPRITE.embed, -2);
    matches.forEach((m, k) => b.link(g, T.accent, q, m, LINK.query, 0.012, 1, k));
  }
}

/** Agent / tools: a planner on a hex plate calling four tool modules in turn. */
function buildAgent(b: Builder, g: number) {
  const y0 = -0.16;
  b.sprite(g, T.ai, [0, 0, -0.1], 2.6, SPRITE.halo, 0, 0.45);
  b.panel(g, T.ai, { pos: [0, y0, 0], u: [0.82, 0, 0], v: [0, 0, 0.82], shape: SHAPE.ring, alpha: 0.5 });
  b.panel(g, T.ai, { pos: [0, y0, 0], u: [0.42, 0, 0], v: [0, 0, 0.42], shape: SHAPE.hex, role: ROLE.body });
  const core: Pt = [0, 0.12, 0];
  const h = 0.15;
  for (let i = 0; i < 4; i++) {
    const a = (45 + 90 * i) * DEG;
    const c: Pt = [0.82 * Math.cos(a), y0 + h, 0.82 * Math.sin(a)];
    b.link(g, T.ai, core, c, LINK.spoke, 0.013, 0.7, i);
    const tool = { shape: SHAPE.face, role: ROLE.tool, p: [i, 0] };
    b.panel(g, T.ai, { pos: [c[0] + h, c[1], c[2]], u: [0, 0, -h], v: [0, h, 0], ...tool, alpha: 0.8 }, 0.45);
    b.panel(g, T.ai, { pos: [c[0], c[1], c[2] + h], u: [h, 0, 0], v: [0, h, 0], ...tool, alpha: 0.9 }, 0.6);
    b.panel(g, T.fg, { pos: [c[0], c[1] + h, c[2]], u: [h, 0, 0], v: [0, 0, h], ...tool });
  }
  b.sprite(g, T.ai, core, 0.46, SPRITE.orb);
}

/** LLM: a dense neural core, one orbit ring per model provider. */
function buildCore(b: Builder, g: number, tier: number, net: { pts: Pt[]; tier: number[] }) {
  if (tier === 0) {
    b.sprite(g, T.ai, [0, 0, -0.15], 3.7, SPRITE.halo, 0, 0.55);
    b.sprite(g, T.ai, [0, 0, 0], 0.95, SPRITE.halo, 0, 0.7);
    for (let r = 0; r < MAX_RINGS; r++) {
      const [U, V] = ringBasis(r);
      b.panel(g, T.ai, { pos: [0, 0, 0], u: U, v: V, shape: SHAPE.ring, role: ROLE.ring, p: [r, 0], alpha: 0.7 });
      b.sprite(g, T.fg, [0, 0, 0], 0.22, SPRITE.ringNode, r);
    }
  }
  const rand = rng(41 + tier);
  net.pts.forEach((p, i) => {
    if (net.tier[i] === tier) b.sprite(g, T.ai, p, 0.075 + rand() * 0.045, SPRITE.neuron, i, 1, rand() * 0.4);
  });
  // Synapses: each neuron to its two nearest (detail tier unless both ends are in the core tier).
  const n = net.pts.length;
  const seen = new Set<number>();
  const d2 = (i: number, j: number) => (net.pts[i][0] - net.pts[j][0]) ** 2 + (net.pts[i][1] - net.pts[j][1]) ** 2 + (net.pts[i][2] - net.pts[j][2]) ** 2;
  for (let i = 0; i < n; i++) {
    let b0 = -1;
    let b1 = -1;
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      if (b0 < 0 || d2(i, j) < d2(i, b0)) {
        b1 = b0;
        b0 = j;
      } else if (b1 < 0 || d2(i, j) < d2(i, b1)) b1 = j;
    }
    for (const j of [b0, b1]) {
      const key = Math.min(i, j) * n + Math.max(i, j);
      if (j < 0 || seen.has(key)) continue;
      if ((net.tier[i] === 0 && net.tier[j] === 0 ? 0 : 1) !== tier) continue;
      seen.add(key);
      b.link(g, T.ai, net.pts[i], net.pts[j], LINK.synapse, 0.011, 0.9, rand(), 0.25);
    }
  }
}

function neuralNet(): { pts: Pt[]; tier: number[] } {
  const rand = rng(17);
  const pts: Pt[] = [];
  const tier: number[] = [];
  const shell = 120;
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < shell; i++) {
    const y = 1 - (2 * (i + 0.5)) / shell;
    const r = Math.sqrt(1 - y * y);
    const a = i * golden;
    const k = 0.96 + rand() * 0.1;
    pts.push([Math.cos(a) * r * k, y * k, Math.sin(a) * r * k]);
    tier.push(i % 2);
  }
  for (let i = 0; i < 44; i++) {
    const r = 0.25 + 0.5 * Math.cbrt(rand());
    const u = rand() * 2 - 1;
    const a = rand() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    pts.push([Math.cos(a) * s * r, u * r, Math.sin(a) * s * r]);
    tier.push(i % 2);
  }
  return { pts, tier };
}

/** Output: an answer card whose lines assemble as the tokens arrive, then a "done" mark. */
function buildOutput(b: Builder, g: number) {
  b.sprite(g, T.accent, [0, 0, -0.1], 2.5, SPRITE.halo, 0, 0.45);
  b.panel(g, T.accent, { pos: [0, 0, 0], u: [0.64, 0, 0], v: [0, 0.84, 0], shape: SHAPE.card, role: ROLE.body });
  b.panel(g, T.accent, { pos: [-0.3, 0.68, 0.01], u: [0.18, 0, 0], v: [0, 0.042, 0], shape: SHAPE.pill, alpha: 0.9 });
  const lens = [1.0, 0.86, 0.96, 0.6, 0.9, 0.48];
  lens.forEach((len, i) =>
    b.panel(g, T.fg, {
      pos: [-0.47 + len / 2, 0.36 - i * 0.16, 0.01],
      u: [len / 2, 0, 0],
      v: [0, 0.04, 0],
      shape: SHAPE.pill,
      role: ROLE.text,
      p: [0.04 + i * 0.145, 0.17],
    }),
  );
  b.sprite(g, T.ok, [0.44, 0.68, 0.02], 0.22, SPRITE.orb, 1);
}

function buildGeneric(b: Builder, g: number) {
  b.sprite(g, T.ai, [0, 0, -0.1], 1.8, SPRITE.halo, 0, 0.45);
  b.panel(g, T.ai, { pos: [0, 0, 0], u: [0.4, 0, 0], v: [0, 0.12, 0.38], shape: SHAPE.ring, role: ROLE.body });
  b.sprite(g, T.ai, [0, 0, 0], 0.5, SPRITE.orb);
}

// ---------- the rig ----------

export type AiFrame = {
  /** Index into model.plans of the project to show. */
  project: number;
  weight: number;
  /** 0..1 room left for the system (phones: its opening scrolled away fades it; the clock runs on). */
  room: number;
  /** Vertical spread (≥ 1) so the system fills a free area taller than its own shape. */
  stretch: number;
  pointer: { x: number; y: number };
  /** Where the system's centre goes (world, z = 0) and world units per layout unit. */
  x: number;
  y: number;
  scale: number;
};
export type AiRegistry = { root: Group | null; inner: Group | null };

type Cond = { a: number; b: number; alpha: number; on: boolean; tone: number; len: number; c: Float32Array };

export class AiRig {
  readonly gl: Gl;
  readonly model: AiModel;
  private readonly tp: Tones;
  private readonly tl: Tones;
  private readonly ts: Tones;
  private readonly tg: Tones;
  private readonly counts: { low: [number, number, number]; high: [number, number, number] };
  /** Live per slot: centre and presence (0..1). */
  readonly lp = new Float32Array(MAX_SLOTS * 3);
  readonly presence = new Float32Array(MAX_SLOTS);
  private readonly lyaw = new Float32Array(MAX_SLOTS);
  private readonly wait = new Float32Array(MAX_SLOTS);
  private readonly lvar = new Float32Array(MAX_SLOTS * 4);
  private readonly cond: Cond[] = Array.from({ length: MAX_COND }, () => ({ a: -1, b: -1, alpha: 0, on: false, tone: 0, len: 1, c: new Float32Array(12) }));
  /** Live box of the system (centre, half extents). */
  readonly box = new Float32Array(4);
  private readonly follow = new Float32Array(2);
  /** Shown project (-1 before the first frame) and the lit stage (index in plan.order, -1 none). */
  cur = -1;
  lit = -1;
  private clock = 0;
  private pitch = PITCH;
  private yaw = YAW;
  private readonly tones: Color[] = [0, 1, 2, 3, 4].map(() => new Color());
  private readonly fit = { x: 0, y: 0, s: 1, first: true };
  private readonly tmp = new Float32Array(3);
  private stretch = 0;

  constructor(model: AiModel) {
    this.model = model;
    const gl = (this.gl = createGl({ panels: 64 * MAX_SLOTS, links: MAX_COND * SEG + 420, sprites: MAX_TOK + 520, glows: 4 * MAX_SLOTS }));
    this.tp = new Tones(gl.panels.capacity);
    this.tl = new Tones(gl.links.capacity);
    this.ts = new Tones(gl.sprites.capacity);
    this.tg = new Tones(gl.glows.capacity);
    const b = new Builder(gl.panels, gl.links, gl.sprites, gl.glows, this.tp, this.tl, this.ts, this.tg);
    // Per-frame regions first: conduit segments and tokens.
    gl.links.reserve(MAX_COND * SEG);
    for (let c = 0; c < MAX_COND; c++)
      for (let s = 0; s < SEG; s++) {
        const i = c * SEG + s;
        gl.links.arr.aGroup[i] = -1;
        gl.links.arr.aW[i] = 0.02;
        gl.links.arr.aK.set([LINK.conduit, c, 0], i * 3);
        gl.links.arr.aT.set([s / SEG, (s + 1) / SEG], i * 2);
      }
    gl.sprites.reserve(MAX_TOK);
    for (let i = 0; i < MAX_TOK; i++) {
      gl.sprites.arr.aGroup[i] = -1;
      gl.sprites.arr.aK[i * 3] = SPRITE.token;
    }
    // Static objects: the core tier first (low quality draws only these), then the detail tier.
    const net = neuralNet();
    const matches: Pt[] = [];
    const storeRand = rng(29);
    const build = (tier: number) =>
      model.slots.forEach((s, g) => {
        const k: StageKind = s.kind;
        b.tilt = k === "rag" ? 0.28 : k === "agent" ? 0.5 : 0;
        if (k === "rag") buildStore(b, g, tier, storeRand, matches);
        else if (k === "llm") buildCore(b, g, tier, net);
        else if (tier !== 0) return;
        else if (k === "input") buildInput(b, g);
        else if (k === "agent") buildAgent(b, g);
        else if (k === "output") buildOutput(b, g);
        else if (k === "stt") buildSpeech(b, g, T.ai);
        else if (k === "tts") buildSpeech(b, g, T.accent);
        else buildGeneric(b, g);
      });
    build(0);
    const low: [number, number, number] = [gl.panels.count, gl.links.count, gl.sprites.count];
    build(1);
    this.counts = { low, high: [gl.panels.count, gl.links.count, gl.sprites.count] };
    gl.glows.geometry.instanceCount = gl.glows.count;
    for (const set of [gl.panels, gl.links, gl.sprites, gl.glows]) set.uploadAll();
    for (let r = 0; r < MAX_RINGS; r++) {
      const [U, V] = ringBasis(r);
      gl.U.uRingU.value[r].fromArray(U);
      gl.U.uRingV.value[r].fromArray(V);
    }
    this.setQuality("high");
  }

  setQuality(q: "high" | "low") {
    const [p, l, s] = this.counts[q];
    this.gl.panels.geometry.instanceCount = p;
    this.gl.links.geometry.instanceCount = l;
    this.gl.sprites.geometry.instanceCount = s;
  }

  setPalette(p: ScenePalette) {
    const light = isLight(p.bg);
    const { gl } = this;
    gl.setLight(light);
    [p.fg, p.ai, p.accent, p.ok, p.muted].forEach((h, k) => this.tones[k].set(h));
    const U = gl.U;
    U.uBg.value.set(p.bg);
    U.uFg.value.set(p.fg);
    U.uAi.value.set(p.ai);
    U.uAccent.value.set(p.accent);
    U.uOk.value.set(p.ok);
    // The model's "hot" colour: the AI glow pushed toward white (toward ink on paper).
    U.uHot.value.set(p.ai).lerp(U.uFg.value, light ? 0.35 : 0.6);
    this.paint(gl.panels.arr.aColor, gl.panels.count, this.tp, 0);
    this.paint(gl.links.arr.aColor, gl.links.count, this.tl, MAX_COND * SEG);
    this.paint(gl.sprites.arr.aColor, gl.sprites.count, this.ts, MAX_TOK);
    this.paint(gl.glows.arr.aColor, gl.glows.count, this.tg, 0);
    for (const a of [gl.panels.attr.aColor, gl.links.attr.aColor, gl.sprites.attr.aColor, gl.glows.attr.aColor]) {
      a.clearUpdateRanges();
      a.needsUpdate = true;
    }
    // Conduits: the request in AI blue up to the model, the answer orange after it.
    for (let c = 0; c < MAX_COND; c++) this.paintCond(c);
  }

  private paint(col: Float32Array, count: number, tones: Tones, from: number) {
    const fg = this.tones[T.fg];
    for (let i = from; i < count; i++) {
      const c = this.tones[tones.tone[i]];
      const m = tones.mix[i];
      col[i * 3] = c.r + (fg.r - c.r) * m;
      col[i * 3 + 1] = c.g + (fg.g - c.g) * m;
      col[i * 3 + 2] = c.b + (fg.b - c.b) * m;
    }
  }

  private paintCond(c: number) {
    const col = this.gl.links.arr.aColor;
    const base = this.tones[this.cond[c].tone > 0.5 ? T.accent : T.ai];
    const muted = this.tones[T.muted];
    for (let s = 0; s < SEG; s++) {
      const i = (c * SEG + s) * 3;
      col[i] = base.r * 0.7 + muted.r * 0.3;
      col[i + 1] = base.g * 0.7 + muted.g * 0.3;
      col[i + 2] = base.b * 0.7 + muted.b * 0.3;
    }
    const a = this.gl.links.attr.aColor;
    a.clearUpdateRanges();
    a.needsUpdate = true;
  }

  /** Switch to project j: new targets, conduits, and a fresh request after the morph. */
  private show(j: number) {
    const plan = this.model.plans[j];
    if (!plan) return;
    const first = this.cur < 0;
    this.cur = j;
    for (let g = 0; g < MAX_SLOTS; g++) {
      if (plan.on[g] && this.presence[g] < 0.02) {
        // Appears: grows in place, staggered in flow order.
        this.lp.set(plan.pos.subarray(g * 3, g * 3 + 3), g * 3);
        this.lp[g * 3 + 1] = plan.box[1] + (plan.pos[g * 3 + 1] - plan.box[1]) * Math.max(1, this.stretch);
        this.lyaw[g] = plan.yaw[g];
        this.wait[g] = (first ? 0.15 : 0.12) + plan.order.indexOf(g) * (first ? 0.12 : 0.08);
      }
    }
    if (first) {
      this.box.set(plan.box);
      this.box[3] *= Math.max(1, this.stretch);
    }
    // Conduits: keep the ones this project shares, fade the rest, open the new ones.
    for (const c of this.cond) c.on = false;
    plan.links.forEach(([a, b], k) => {
      let c = this.condOf(a, b, false);
      if (c < 0) c = this.cond.findIndex((x) => x.alpha < 0.01 && !x.on);
      if (c < 0) return;
      const e = this.cond[c];
      const tone = plan.llmAt >= 0 && k >= plan.llmAt ? 1 : 0;
      if (e.a !== a || e.b !== b || e.tone !== tone) {
        e.a = a;
        e.b = b;
        e.tone = tone;
        this.paintCond(c);
      }
      e.on = true;
    });
    this.clock = first ? -0.9 : -0.55;
    this.lit = -1;
  }

  /** Pool index of the conduit a → b (-1 none). */
  private condOf(a: number, b: number, on: boolean): number {
    for (let c = 0; c < MAX_COND; c++) {
      const e = this.cond[c];
      if (e.a === a && e.b === b && (!on || e.on)) return c;
    }
    return -1;
  }

  /** The current plan's step that is lit at the clock (-1 none). */
  private litStep(plan: Plan): number {
    const t = this.clock;
    const steps = plan.steps;
    if (t < steps[0].start || t > plan.cycle - CLEAR) return -1;
    for (let k = steps.length - 1; k >= 0; k--) if (t >= steps[k].start) return k;
    return -1;
  }

  /** Cubic Bézier point of conduit e at u into out (x, y, z). */
  private bez(e: Cond, u: number, out: Float32Array) {
    const p = e.c;
    const v = 1 - u;
    const a = v * v * v;
    const b = 3 * v * v * u;
    const d = 3 * v * u * u;
    const w = u * u * u;
    out[0] = a * p[0] + b * p[3] + d * p[6] + w * p[9];
    out[1] = a * p[1] + b * p[4] + d * p[7] + w * p[10];
    out[2] = a * p[2] + b * p[5] + d * p[8] + w * p[11];
  }

  frame(state: RootState, delta: number, f: AiFrame, r: AiRegistry) {
    const { root, inner } = r;
    if (!root || !inner || f.weight <= 0) {
      this.gl.U.uOpacity.value = 0;
      return;
    }
    const dt = Math.min(delta, 0.1);
    const time = state.clock.elapsedTime;
    const model = this.model;
    if (f.project !== this.cur) this.show(f.project);
    const plan = model.plans[this.cur];
    if (!plan) return;
    const { gl } = this;
    const U = gl.U;

    // Clock: one request after another (a fresh one starts after each morph).
    this.clock += dt;
    if (this.clock > plan.cycle) this.clock -= plan.cycle;
    const t = this.clock;
    const clear = t < 0 ? 1 : smooth(plan.cycle - CLEAR, plan.cycle, t);
    U.uClear.value = clear;
    U.uTime.value = time;
    U.uOpacity.value = f.weight * f.room;
    inner.visible = f.room > 0.002;
    this.lit = this.litStep(plan);

    // Slots: ease toward the plan (spread vertically to the free area's shape); activity
    // and phase from the request's steps.
    this.stretch = this.cur >= 0 && this.stretch > 0 ? damp(this.stretch, f.stretch, 4, dt) : f.stretch;
    const cy = plan.box[1];
    const slot = U.uSlot.value;
    const slotB = U.uSlotB.value;
    const vars = U.uVar.value;
    const lv = this.lvar;
    for (let g = 0; g < MAX_SLOTS; g++) {
      const on = plan.on[g] === 1;
      if (on && this.wait[g] > 0) this.wait[g] -= dt;
      const target = on && this.wait[g] <= 0 ? 1 : 0;
      this.presence[g] = damp(this.presence[g], target, target > this.presence[g] ? 5 : 6.5, dt);
      if (this.presence[g] < 0.002 && !on) this.presence[g] = 0;
      if (on) {
        this.lp[g * 3] = damp(this.lp[g * 3], plan.pos[g * 3], 4.2, dt);
        this.lp[g * 3 + 1] = damp(this.lp[g * 3 + 1], cy + (plan.pos[g * 3 + 1] - cy) * this.stretch, 4.2, dt);
        this.lp[g * 3 + 2] = damp(this.lp[g * 3 + 2], plan.pos[g * 3 + 2], 4.2, dt);
        this.lyaw[g] = damp(this.lyaw[g], plan.yaw[g], 4.2, dt);
      }
      const pr = this.presence[g];
      const grow = smooth(0, 1, pr);
      slot[g * 4] = this.lp[g * 3];
      slot[g * 4 + 1] = this.lp[g * 3 + 1] - (1 - grow) * 0.25;
      slot[g * 4 + 2] = this.lp[g * 3 + 2];
      slot[g * 4 + 3] = Math.max(1e-3, 0.35 + 0.65 * grow);
      slotB[g * 4] = this.lyaw[g];
      slotB[g * 4 + 1] = pr;
      slotB[g * 4 + 2] = 0;
      slotB[g * 4 + 3] = 0;
      // Input kind and model rings.
      lv[g * 4] = damp(lv[g * 4], plan.input === "chat" ? 1 : 0, 5, dt);
      lv[g * 4 + 1] = damp(lv[g * 4 + 1], plan.input === "code" ? 1 : 0, 5, dt);
      lv[g * 4 + 2] = damp(lv[g * 4 + 2], plan.input === "voice" ? 1 : 0, 5, dt);
      lv[g * 4 + 3] = damp(lv[g * 4 + 3], plan.rings, 3.5, dt);
      for (let k = 0; k < 4; k++) vars[g * 4 + k] = lv[g * 4 + k];
    }
    const steps = plan.steps;
    const last = steps.length - 1;
    for (let k = 0; k <= last; k++) {
      const s = steps[k];
      const g = s.slot;
      const rise = smooth(s.start - 0.15, s.start + 0.25, t);
      const act = k === last ? rise * (1 - clear) : rise * (1 - smooth(s.leave, s.leave + 0.9, t));
      slotB[g * 4 + 2] = t < 0 ? 0 : act;
      slotB[g * 4 + 3] = t < 0 ? 0 : clamp01((t - s.start) / s.dwell);
    }

    // Conduits between the live stages.
    const cond = U.uCond.value;
    const L = gl.links.arr;
    for (let c = 0; c < MAX_COND; c++) {
      const e = this.cond[c];
      e.alpha = damp(e.alpha, e.on ? 1 : 0, e.on ? 3.5 : 6, dt);
      const alpha = e.a < 0 ? 0 : e.alpha * Math.min(this.presence[e.a], this.presence[e.b]);
      cond[c * 4] = -1;
      cond[c * 4 + 1] = 0;
      cond[c * 4 + 2] = e.tone;
      if (alpha < 0.003) {
        for (let s = 0; s < SEG; s++) L.aAlpha[c * SEG + s] = 0;
        continue;
      }
      this.shapeCond(e);
      cond[c * 4 + 3] = e.len;
      let x0 = e.c[0];
      let y0 = e.c[1];
      let z0 = e.c[2];
      for (let s = 0; s < SEG; s++) {
        const i = c * SEG + s;
        this.bez(e, (s + 1) / SEG, this.tmp);
        L.aA[i * 3] = x0;
        L.aA[i * 3 + 1] = y0;
        L.aA[i * 3 + 2] = z0;
        x0 = L.aB[i * 3] = this.tmp[0];
        y0 = L.aB[i * 3 + 1] = this.tmp[1];
        z0 = L.aB[i * 3 + 2] = this.tmp[2];
        L.aAlpha[i] = alpha;
      }
    }
    gl.links.touch("aA", 0, MAX_COND * SEG);
    gl.links.touch("aB", 0, MAX_COND * SEG);
    gl.links.touch("aAlpha", 0, MAX_COND * SEG);

    // Tokens: the request packet travelling between stages, then the model's answer stream.
    const Sp = gl.sprites.arr;
    let n = 0;
    let fx = NaN;
    let fy = 0;
    for (let k = 0; k < last && t >= 0; k++) {
      const a = steps[k];
      const b = steps[k + 1];
      const c = this.condOf(a.slot, b.slot, true);
      if (c < 0) continue;
      const e = this.cond[c];
      const tone = this.tones[e.tone ? T.accent : T.ai];
      if (k === plan.llmAt) {
        const from = a.leave - 0.25;
        const to = b.start + b.dwell * 0.78 - TRAVEL;
        if (t < from || t > to + TRAVEL) continue;
        cond[c * 4 + 1] = t <= to ? 1 : 0;
        const j0 = Math.max(0, Math.ceil((t - TRAVEL - from) * STREAM_RATE));
        const j1 = Math.floor((Math.min(t, to) - from) * STREAM_RATE);
        for (let j = j0; j <= j1 && n < MAX_TOK; j++) {
          const u = clamp01((t - (from + j / STREAM_RATE)) / TRAVEL);
          this.bez(e, u, this.tmp);
          this.token(n++, this.tmp, 0.2 + 0.04 * ((j * 7) % 3), tone, Math.min(1, u * 6, (1 - u) * 6));
          if (Number.isNaN(fx)) {
            fx = this.tmp[0];
            fy = this.tmp[1];
          }
        }
        continue;
      }
      if (t < a.leave || t > b.start) continue;
      const u = smooth(0, 1, (t - a.leave) / TRAVEL);
      cond[c * 4] = u;
      for (let j = 0; j < TOKEN_SIZE.length && n < MAX_TOK; j++) {
        const uj = u - j * 0.045;
        if (uj < 0) break;
        this.bez(e, uj, this.tmp);
        this.token(n++, this.tmp, TOKEN_SIZE[j], tone, 1 - j * 0.18);
      }
      this.bez(e, u, this.tmp);
      fx = this.tmp[0];
      fy = this.tmp[1];
    }
    for (let i = n; i < MAX_TOK; i++) Sp.aAlpha[i] = 0;
    gl.sprites.touch("aPos", 0, MAX_TOK);
    gl.sprites.touch("aSize", 0, MAX_TOK);
    gl.sprites.touch("aAlpha", 0, MAX_TOK);
    gl.sprites.touch("aColor", 0, MAX_TOK);

    // Follow: drift a little toward the request (the packet in flight, else the stage working).
    if (Number.isNaN(fx) && this.lit >= 0) {
      const g = steps[this.lit].slot;
      fx = this.lp[g * 3];
      fy = this.lp[g * 3 + 1];
    }
    const box = this.box;
    for (let k = 0; k < 4; k++) box[k] = damp(box[k], k === 3 ? plan.box[3] * this.stretch : plan.box[k], 3.2, dt);
    this.follow[0] = damp(this.follow[0], Number.isNaN(fx) ? 0 : (fx - box[0]) * 0.07, 1.6, dt);
    this.follow[1] = damp(this.follow[1], Number.isNaN(fx) ? 0 : (fy - box[1]) * 0.07, 1.6, dt);

    // Fit, tilt and pointer parallax (the tilt pivots on the system's centre).
    const fit = this.fit;
    if (fit.first) {
      fit.x = f.x;
      fit.y = f.y;
      fit.s = f.scale;
      fit.first = false;
    }
    fit.x = damp(fit.x, f.x, 14, dt);
    fit.y = damp(fit.y, f.y, 14, dt);
    fit.s = damp(fit.s, f.scale, 5, dt);
    const s = fit.s * (0.92 + 0.08 * f.weight);
    root.position.set(fit.x, fit.y, 0);
    root.scale.setScalar(s);
    this.yaw = damp(this.yaw, YAW + f.pointer.x * 0.2 + Math.sin(time * 0.15) * 0.03, 2.4, dt);
    this.pitch = damp(this.pitch, PITCH - f.pointer.y * 0.1, 2.4, dt);
    root.rotation.set(this.pitch, this.yaw, 0);
    inner.position.set(-box[0] - this.follow[0], -box[1] - this.follow[1], 0);
    U.uScale.value = s;
    state.invalidate();
  }

  private token(i: number, p: Float32Array, size: number, c: Color, alpha: number) {
    const S = this.gl.sprites.arr;
    S.aPos[i * 3] = p[0];
    S.aPos[i * 3 + 1] = p[1];
    S.aPos[i * 3 + 2] = p[2] + 0.05;
    S.aSize[i] = size;
    S.aAlpha[i] = alpha;
    S.aColor[i * 3] = c.r;
    S.aColor[i * 3 + 1] = c.g;
    S.aColor[i * 3 + 2] = c.b;
  }

  /** Control points of a conduit from the live stage positions: leaves a's edge, bows outward, enters b's. */
  private shapeCond(e: Cond) {
    const { lp } = this;
    const slots = this.model.slots;
    const ax = lp[e.a * 3];
    const ay = lp[e.a * 3 + 1];
    const az = lp[e.a * 3 + 2];
    const bx = lp[e.b * 3];
    const by = lp[e.b * 3 + 1];
    const bz = lp[e.b * 3 + 2];
    let dx = bx - ax;
    let dy = by - ay;
    const d = Math.hypot(dx, dy) || 1;
    dx /= d;
    dy /= d;
    const pa = Math.min(PORT[slots[e.a].kind], d * 0.35);
    const pb = Math.min(PORT[slots[e.b].kind], d * 0.35);
    const x0 = ax + dx * pa;
    const y0 = ay + dy * pa;
    const x3 = bx - dx * pb;
    const y3 = by - dy * pb;
    const len = Math.hypot(x3 - x0, y3 - y0);
    // Bow away from the system's centre.
    let nx = -dy;
    let ny = dx;
    if (nx * ((x0 + x3) / 2 - this.box[0]) + ny * ((y0 + y3) / 2 - this.box[1]) < 0) {
      nx = -nx;
      ny = -ny;
    }
    const bow = 0.16 * len;
    const c = e.c;
    c[0] = x0;
    c[1] = y0;
    c[2] = az;
    c[3] = x0 + (x3 - x0) * 0.3 + nx * bow;
    c[4] = y0 + (y3 - y0) * 0.3 + ny * bow;
    c[5] = az + (bz - az) * 0.3 + 0.25;
    c[6] = x0 + (x3 - x0) * 0.7 + nx * bow;
    c[7] = y0 + (y3 - y0) * 0.7 + ny * bow;
    c[8] = az + (bz - az) * 0.7 + 0.25;
    c[9] = x3;
    c[10] = y3;
    c[11] = bz;
    e.len = len * 1.1;
  }

  /** Live label anchor of slot g (layout units), above (+1) or below (-1) its object. */
  labelAt(g: number, side: number, out: Float32Array) {
    const kind = this.model.slots[g].kind;
    const ey = kind === "llm" ? 1.45 : EXT[kind][1];
    const grow = smooth(0, 1, this.presence[g]);
    out[0] = this.lp[g * 3];
    out[1] = this.lp[g * 3 + 1] + side * (ey * (0.35 + 0.65 * grow) + 0.1);
    out[2] = this.lp[g * 3 + 2];
  }

  dispose() {
    this.gl.dispose();
  }
}
