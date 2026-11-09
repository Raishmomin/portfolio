// The AI scene's mutable side. Builds every stage object once (instances in slot-local
// space), then each frame: eases the slots toward the active project's plan (a project
// switch glides shared stages to their new place, grows new ones and dissolves the rest),
// runs one request through the system on a clock (each stage's activity and phase drive
// its animation in the shaders), writes the conduits between stages and the travelling
// tokens, and fits, tilts and gently follows the request. No allocation per frame.
import type { RootState } from "@react-three/fiber";
import { Color, type Group } from "three";
import type { ScenePalette } from "../../types";
import { createGl, DYN, Instances, LINK, LINK_SPEC, MAX_COND, MAX_TOK, PANEL_SPEC, PORTS, PULSE, ROLE, SEG, SHAPE, SPRITE, SPRITE_SPEC, VAR, type Gl } from "./gl";
import { CLEAR, EXT, MAX_RINGS, MAX_SLOTS, PORT, TRAVEL, type AiModel, type Plan } from "./layout";
import { clamp01, damp, isLight, rng, smooth } from "./shared";
import type { StageKind } from "./system";

/** Colour roles (resolved from the palette): foreground, AI accent, answer orange, data green, muted. */
const T = { fg: 0, ai: 1, accent: 2, ok: 3, muted: 4 } as const;
type Tone = (typeof T)[keyof typeof T];
const DEG = Math.PI / 180;
const STREAM_RATE = 7; // tokens per second while the model answers
/** The request packet: a comet (head, then a fading tail along the conduit). */
const COMET = [0.62, 0.46, 0.39, 0.33, 0.28, 0.24, 0.2, 0.17, 0.14, 0.12];
const COMET_GAP = 0.026;
/** Seconds an arrival pulse spreads from the stage the request reaches. */
const PULSE_T = 0.75;
/** Base tilt of the whole system (looking a little down onto it) and its pointer parallax. */
const PITCH = 0.2;
const YAW = -0.1;

/** Ring r of the model core: one per model provider, close round the core and open to the view. */
export function ringBasis(r: number): [number[], number[]] {
  const R = 1.1 + 0.08 * r;
  const a = [180, 120, 240][r] * DEG;
  const b = 62 * DEG;
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
    v: { pos: number[]; u: number[]; v: number[]; shape: number; role?: number; variant?: number; p?: readonly number[]; alpha?: number },
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
  sprite(g: number, tone: Tone, pos: number[], size: number, kind: number, k1 = 0, alpha = 1, mix = 0, variant = 0) {
    // Halos go to their own draw, under the glass.
    const [set, tones] = kind === SPRITE.halo ? [this.G, this.tg] : [this.S, this.ts];
    const i = set.push({ aPos: tiltX(pos, this.tilt), aGroup: g, aSize: size, aAlpha: alpha, aK: [kind, k1, variant] });
    tones.tone[i] = tone;
    tones.mix[i] = mix;
  }
}

// ---------- the stage objects (slot-local space, about ±1 unit) ----------

/** Text lines [x0, y, length, start, tone], typed / assembled left to right in turn. */
function bars(b: Builder, g: number, rows: [number, number, number, number, Tone][], variant: number, h = 0.034) {
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

/** Three window dots and a title rule across the top of a window (half extents hx, hy). */
function titleBar(b: Builder, g: number, hx: number, hy: number, variant: number) {
  [T.muted, T.ai, T.ok].forEach((tone, k) =>
    b.panel(g, tone, { pos: [-hx + 0.14 + k * 0.11, hy - 0.13, 0.01], u: [0.034, 0, 0], v: [0, 0.034, 0], shape: SHAPE.pill, variant }),
  );
  b.panel(g, T.muted, { pos: [0, hy - 0.26, 0.01], u: [hx - 0.05, 0, 0], v: [0, 0.006, 0], shape: SHAPE.pill, variant, alpha: 0.6 });
}

/**
 * Input: a chat window whose prompt is typed, or (a system that reads source code) an
 * editor window whose code is typed in syntax colours beside its line numbers, or a live
 * voice waveform. All three are built; the project's input kind shows one.
 */
function buildInput(b: Builder, g: number) {
  b.sprite(g, T.ai, [0, 0, -0.1], 1.55, SPRITE.halo, 0, 0.45);
  b.panel(g, T.ai, { pos: [0, 0.06, 0], u: [0.76, 0, 0], v: [0, 0.5, 0], shape: SHAPE.bubble, role: ROLE.body, variant: VAR.notCode });
  b.panel(g, T.ai, { pos: [0, 0.02, 0], u: [0.8, 0, 0], v: [0, 0.58, 0], shape: SHAPE.card, role: ROLE.body, variant: VAR.code });
  bars(
    b,
    g,
    [
      [-0.56, 0.3, 1.02, 0.04, T.fg],
      [-0.56, 0.1, 1.12, 0.3, T.fg],
      [-0.56, -0.1, 0.62, 0.56, T.fg],
    ],
    VAR.chat,
  );
  // Editor: title bar, line-number gutter, indented code in syntax colours.
  titleBar(b, g, 0.8, 0.6, VAR.code);
  b.panel(g, T.muted, { pos: [-0.5, -0.12, 0.01], u: [0.005, 0, 0], v: [0, 0.38, 0], shape: SHAPE.pill, variant: VAR.code, alpha: 0.5 });
  for (let k = 0; k < 6; k++)
    b.panel(g, T.muted, { pos: [-0.62, 0.16 - k * 0.1, 0.01], u: [0.04, 0, 0], v: [0, 0.018, 0], shape: SHAPE.pill, variant: VAR.code, alpha: 0.75 });
  bars(
    b,
    g,
    [
      [-0.4, 0.16, 0.3, 0.04, T.ok],
      [-0.06, 0.16, 0.42, 0.12, T.fg],
      [-0.28, 0.06, 0.62, 0.22, T.ai],
      [-0.16, -0.04, 0.5, 0.36, T.ok],
      [-0.16, -0.14, 0.3, 0.48, T.fg],
      [-0.28, -0.24, 0.24, 0.6, T.ai],
      [-0.4, -0.34, 0.12, 0.72, T.muted],
    ],
    VAR.code,
    0.026,
  );
  waves(b, g, T.ai, VAR.voice, 0.06, 11, 1.0, 0.3);
  // Send: lights as the prompt leaves.
  b.sprite(g, T.ai, [0.58, -0.3, 0.03], 0.15, SPRITE.orb, 0, 1, 0.3, VAR.notCode);
  b.sprite(g, T.ai, [0.64, -0.44, 0.03], 0.15, SPRITE.orb, 0, 1, 0.3, VAR.code);
}

/** Speech-to-text / text-to-speech: a voice waveform. */
function buildSpeech(b: Builder, g: number, tone: Tone) {
  b.sprite(g, tone, [0, 0, -0.1], 1.5, SPRITE.halo, tone === T.accent ? 2 : 0, 0.45);
  b.panel(g, tone, { pos: [0, 0, 0], u: [0.72, 0, 0], v: [0, 0.46, 0], shape: SHAPE.card, role: ROLE.body, p: [tone === T.accent ? 1 : 0, 0] });
  waves(b, g, tone, 0, -0.04, 13, 1.06, 0.24);
}

/** Corners of a box (half extents x, y, z), and its 12 edges as corner index pairs. */
function box(x: number, y: number, z: number, at: Pt = [0, 0, 0]): Pt[] {
  return Array.from({ length: 8 }, (_, i): Pt => [at[0] + (i & 1 ? x : -x), at[1] + (i & 2 ? y : -y), at[2] + (i & 4 ? z : -z)]);
}
/** A glass frame: 1 px lit edges with a glow dot at every corner. */
function frame(b: Builder, g: number, tone: Tone, corners: Pt[], w: number, dot: number, alpha: number) {
  corners.forEach((p, i) => {
    b.sprite(g, tone, p, dot, SPRITE.orb, 0, alpha);
    for (const k of [1, 2, 4]) if (!(i & k)) b.link(g, tone, p, corners[i | k], LINK.line, w, alpha * 0.8);
  });
}

/** Clusters of the vector space (centres); the query lands by the first. */
const CLUSTERS: Pt[] = [
  [0.2, -0.1, 0.2],
  [-0.24, 0.26, -0.12],
  [-0.2, -0.3, -0.2],
  [0.28, 0.3, -0.22],
];
const QUERY: Pt = [0.26, 0.08, 0.26];

/**
 * Retrieval (RAG): a vector space, a glass cube of embedding points in semantic clusters
 * (green and blue). A query drops in and lines reach to its nearest matches, which light.
 */
function buildStore(b: Builder, g: number, tier: number, rand: () => number, matches: Pt[]) {
  const c = 0.56;
  const pts: Pt[] = [];
  const n = tier === 0 ? 110 : 80;
  for (let k = 0; k < n; k++) {
    const cl = CLUSTERS[k % 4];
    const r = k % 6 === 5 ? 0.6 : 0.2;
    const j = () => (rand() + rand() + rand() - 1.5) * r;
    pts.push([cl[0] + j(), cl[1] + j(), cl[2] + j()].map((v) => Math.max(-c * 0.92, Math.min(c * 0.92, v))) as Pt);
  }
  // The query's nearest matches (top-k).
  const d2 = (p: Pt) => (p[0] - QUERY[0]) ** 2 + (p[1] - QUERY[1]) ** 2 + (p[2] - QUERY[2]) ** 2;
  const top = tier === 0 ? pts.map((p, i) => [d2(p), i]).sort((x, y) => x[0] - y[0]).slice(0, 4).map((x) => x[1]) : [];
  if (tier === 0) {
    b.sprite(g, T.ok, [0, 0, -0.1], 1.55, SPRITE.halo, 0, 0.4);
    frame(b, g, T.ok, box(c, c, c), 0.01, 0.08, 0.9);
    // A faint glass floor gives the space its depth.
    b.panel(g, T.ok, { pos: [0, -c, 0], u: [c, 0, 0], v: [0, 0, c], shape: SHAPE.face, alpha: 0.45 });
  }
  pts.forEach((p, k) => {
    const rank = top.indexOf(k);
    if (rank >= 0) matches[rank] = p;
    const tone = k % 4 === 1 || k % 4 === 3 ? T.ai : T.ok;
    b.sprite(g, rank >= 0 ? T.ok : tone, p, rank >= 0 ? 0.12 : 0.07 + rand() * 0.04, SPRITE.embed, rank, 1, rank >= 0 ? 0.2 : rand() * 0.4);
  });
  if (tier === 0) {
    b.sprite(g, T.accent, QUERY, 0.18, SPRITE.embed, -2);
    matches.forEach((m, k) => b.link(g, T.accent, QUERY, m, LINK.query, 0.011, 1, k));
  }
}

/** Agent / tools: a planner on a hex plate calling four tool modules in turn. */
function buildAgent(b: Builder, g: number) {
  const y0 = -0.16;
  b.sprite(g, T.ai, [0, 0, -0.1], 1.65, SPRITE.halo, 0, 0.45);
  b.panel(g, T.ai, { pos: [0, y0, 0], u: [0.82, 0, 0], v: [0, 0, 0.82], shape: SHAPE.ring, alpha: 0.5 });
  b.panel(g, T.ai, { pos: [0, y0, 0], u: [0.42, 0, 0], v: [0, 0, 0.42], shape: SHAPE.hex, role: ROLE.body });
  const core: Pt = [0, 0.12, 0];
  const h = 0.15;
  for (let i = 0; i < 4; i++) {
    const a = (45 + 90 * i) * DEG;
    const c: Pt = [0.82 * Math.cos(a), y0 + h, 0.82 * Math.sin(a)];
    b.link(g, T.ai, core, c, LINK.spoke, 0.013, 0.7, i);
    // A glass tool box: three faces (lit orange while it is called) and glow dots on its corners.
    const tool = { shape: SHAPE.face, role: ROLE.tool, p: [i, 0] };
    b.panel(g, T.ai, { pos: [c[0] + h, c[1], c[2]], u: [0, 0, -h], v: [0, h, 0], ...tool, alpha: 0.85 });
    b.panel(g, T.ai, { pos: [c[0], c[1], c[2] + h], u: [h, 0, 0], v: [0, h, 0], ...tool }, 0.12);
    b.panel(g, T.ai, { pos: [c[0], c[1] + h, c[2]], u: [h, 0, 0], v: [0, 0, h], ...tool }, 0.3);
    box(h, h, h, c).forEach((p) => b.sprite(g, T.ai, p, 0.055, SPRITE.orb, 0, 0.7, 0.3));
  }
  b.sprite(g, T.ai, core, 0.46, SPRITE.orb);
}

/**
 * LLM: a dense neural core, one orbit ring per model provider. It is the hub of the
 * system, so every quality tier draws all of it (the low tier saves on the store's points).
 */
function buildCore(b: Builder, g: number, tier: number, net: { pts: Pt[] }) {
  if (tier !== 0) return;
  b.sprite(g, T.ai, [0, 0, -0.15], 2.5, SPRITE.halo, 0, 0.6);
  // The inner glow: the core's hot centre, breathing while idle (halo k1 = 1).
  b.sprite(g, T.ai, [0, 0, 0], 1.6, SPRITE.halo, 1, 1);
  for (let r = 0; r < MAX_RINGS; r++) {
    const [U, V] = ringBasis(r);
    b.panel(g, T.ai, { pos: [0, 0, 0], u: U, v: V, shape: SHAPE.ring, role: ROLE.ring, p: [r, 0], alpha: 0.38 });
    b.sprite(g, T.fg, [0, 0, 0], 0.2, SPRITE.ringNode, r);
  }
  const rand = rng(41);
  // Smaller, brighter neurons toward the centre.
  net.pts.forEach((p, i) => {
    const r = Math.hypot(p[0], p[1], p[2]);
    b.sprite(g, T.ai, p, (0.055 + rand() * 0.04) * (0.75 + 0.35 * r), SPRITE.neuron, i, 1, rand() * 0.35 * r);
  });
  // Synapses: each neuron to its two nearest.
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
      seen.add(key);
      b.link(g, T.ai, net.pts[i], net.pts[j], LINK.synapse, 0.011, 0.9, rand(), 0.25);
    }
  }
}

/** Neurons of the model core: a loose outer shell for its outline round a body that grows
 *  denser toward the centre (a mass of neurons, not a wireframe globe). */
function neuralNet(): { pts: Pt[] } {
  const rand = rng(17);
  const pts: Pt[] = [];
  const shell = 40;
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < shell; i++) {
    const y = 1 - (2 * (i + 0.5)) / shell;
    const r = Math.sqrt(1 - y * y);
    const a = i * golden;
    const k = 0.9 + rand() * 0.12;
    pts.push([Math.cos(a) * r * k, y * k, Math.sin(a) * r * k]);
  }
  for (let i = 0; i < 200; i++) {
    const r = 0.06 + 0.84 * rand() ** 0.8;
    const u = rand() * 2 - 1;
    const a = rand() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    pts.push([Math.cos(a) * s * r, u * r, Math.sin(a) * s * r]);
  }
  return { pts };
}

/** Output rows [x0, length, tone, marker tone (-1 none)]. */
type Row = [number, number, Tone, number];
const ANSWER: Row[] = [
  [-0.47, 1.0, T.fg, -1],
  [-0.47, 0.86, T.fg, -1],
  [-0.47, 0.96, T.fg, -1],
  [-0.47, 0.6, T.fg, -1],
  [-0.47, 0.9, T.fg, -1],
  [-0.47, 0.48, T.fg, -1],
];
/** A code system answers with an edit: changed lines marked removed (orange) / added (green). */
const EDIT: Row[] = [
  [-0.36, 0.5, T.fg, -1],
  [-0.24, 0.62, T.muted, T.accent],
  [-0.24, 0.7, T.ai, T.ok],
  [-0.24, 0.46, T.fg, T.ok],
  [-0.36, 0.3, T.fg, -1],
  [-0.36, 0.56, T.muted, -1],
];

/**
 * Output: a glass card (neutral until the answer arrives) whose lines assemble over faint
 * placeholder rows as the tokens arrive, then a "done" mark. An answer for the chat and
 * voice systems; for a code system, an edit with its changed lines marked.
 */
function buildOutput(b: Builder, g: number) {
  b.sprite(g, T.accent, [0, 0, -0.1], 1.55, SPRITE.halo, 2, 0.45);
  b.panel(g, T.accent, { pos: [0, 0, 0], u: [0.64, 0, 0], v: [0, 0.84, 0], shape: SHAPE.card, role: ROLE.body, p: [1, 0] });
  b.panel(g, T.accent, { pos: [-0.3, 0.68, 0.01], u: [0.18, 0, 0], v: [0, 0.034, 0], shape: SHAPE.pill, role: ROLE.body, p: [1, 0], alpha: 0.9 });
  const rows = (list: Row[], variant: number) =>
    list.forEach(([x0, len, tone, mark], i) => {
      const y = 0.36 - i * 0.16;
      const pos = [x0 + len / 2, y, 0.01];
      const shape = { u: [len / 2, 0, 0], v: [0, 0.032, 0], shape: SHAPE.pill, variant };
      // The placeholder row, then the row that assembles over it.
      b.panel(g, T.fg, { pos, ...shape, alpha: 0.12 });
      b.panel(g, tone, { pos, ...shape, role: ROLE.text, p: [0.04 + i * 0.145, 0.17] });
      if (mark >= 0) b.panel(g, mark as Tone, { pos: [-0.5, y, 0.01], u: [0.035, 0, 0], v: [0, 0.035, 0], shape: SHAPE.pill, role: ROLE.text, variant, p: [0.04 + i * 0.145, 0.05] });
    });
  rows(ANSWER, VAR.notCode);
  rows(EDIT, VAR.code);
  b.sprite(g, T.ok, [0.44, 0.68, 0.02], 0.22, SPRITE.orb, 1);
}

function buildGeneric(b: Builder, g: number) {
  b.sprite(g, T.ai, [0, 0, -0.1], 1.3, SPRITE.halo, 0, 0.45);
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
  /** True while the free area is cut by the section's edge: the fit follows it at once. */
  clip: boolean;
  /** Stage (index in the plan's order) whose chip is hovered: the request waits there (-1 none). */
  hold: number;
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
    const gl = (this.gl = createGl({ panels: 64 * MAX_SLOTS, links: MAX_COND * SEG + 440, sprites: DYN + 600, glows: 4 * MAX_SLOTS }));
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
        gl.links.arr.aW[i] = 0.05;
        gl.links.arr.aK.set([LINK.conduit, c, 0], i * 3);
        gl.links.arr.aT.set([s / SEG, (s + 1) / SEG], i * 2);
      }
    // Tokens, the arrival pulse, then a glow dot at each end of every conduit (its joints).
    gl.sprites.reserve(DYN);
    for (let i = 0; i < DYN; i++) {
      gl.sprites.arr.aGroup[i] = -1;
      gl.sprites.arr.aK[i * 3] = i === PULSE ? SPRITE.pulse : SPRITE.token;
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
    this.gl.U.uLow.value = q === "low" ? 1 : 0;
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
    this.paint(gl.sprites.arr.aColor, gl.sprites.count, this.ts, DYN);
    this.paint(gl.glows.arr.aColor, gl.glows.count, this.tg, 0);
    // Whole buffers as one range each, so the per-frame token range cannot narrow the upload.
    for (const set of [gl.panels, gl.links, gl.sprites, gl.glows]) set.touch("aColor", 0, set.count);
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
    // At rest every conduit is AI blue; the answer's run lights orange only while it streams.
    const base = this.tones[T.ai];
    const muted = this.tones[T.muted];
    for (let s = 0; s < SEG; s++) {
      const i = (c * SEG + s) * 3;
      col[i] = base.r * 0.7 + muted.r * 0.3;
      col[i + 1] = base.g * 0.7 + muted.g * 0.3;
      col[i + 2] = base.b * 0.7 + muted.b * 0.3;
    }
    this.gl.links.touch("aColor", c * SEG, SEG);
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
    const dt = Math.min(Math.max(delta, 0), 0.1);
    const time = state.clock.elapsedTime;
    const model = this.model;
    if (f.project !== this.cur) this.show(f.project);
    const plan = model.plans[this.cur];
    if (!plan) return;
    const { gl } = this;
    const U = gl.U;

    // Clock: one request after another (a fresh one starts after each morph). A hovered
    // stage chip holds the request in that stage: its work replays until the pointer leaves.
    this.clock += dt;
    const held = f.hold >= 0 && f.hold < plan.steps.length ? plan.steps[f.hold] : null;
    if (held) {
      if (this.clock < held.start - 0.35 || this.clock > held.leave + 0.1) this.clock = held.start - 0.15;
      else if (this.clock > held.leave - 0.05) this.clock = held.start + 0.1;
    }
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
      // The vector space turns slowly (its points shift in depth).
      slotB[g * 4] = this.lyaw[g] + (model.slots[g]?.kind === "rag" ? 0.62 + 0.35 * Math.sin(time * 0.25) : 0);
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
    const Sp = gl.sprites.arr;
    for (let c = 0; c < MAX_COND; c++) {
      const e = this.cond[c];
      e.alpha = damp(e.alpha, e.on ? 1 : 0, e.on ? 3.5 : 6, dt);
      const alpha = e.a < 0 ? 0 : e.alpha * Math.min(this.presence[e.a], this.presence[e.b]);
      cond[c * 4] = -1;
      cond[c * 4 + 1] = 0;
      cond[c * 4 + 2] = e.tone;
      if (alpha < 0.003) {
        for (let s = 0; s < SEG; s++) L.aAlpha[c * SEG + s] = 0;
        Sp.aAlpha[PORTS + 2 * c] = Sp.aAlpha[PORTS + 2 * c + 1] = 0;
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
      const tone = this.tones[T.ai];
      this.tmp.set(e.c.subarray(0, 3));
      this.token(PORTS + 2 * c, this.tmp, 0.12, tone, alpha * 0.9);
      this.tmp.set(e.c.subarray(9, 12));
      this.token(PORTS + 2 * c + 1, this.tmp, 0.12, tone, alpha * 0.9);
    }
    gl.links.touch("aA", 0, MAX_COND * SEG);
    gl.links.touch("aB", 0, MAX_COND * SEG);
    gl.links.touch("aAlpha", 0, MAX_COND * SEG);

    // Tokens: the request packet travelling between stages, then the model's answer stream.
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
          this.token(n++, this.tmp, 0.26 + 0.05 * ((j * 7) % 3), tone, Math.min(1, u * 6, (1 - u) * 6));
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
      // A comet: the head, then its tail fading back along the conduit.
      for (let j = 0; j < COMET.length && n < MAX_TOK; j++) {
        const uj = u - j * COMET_GAP;
        if (uj < 0) break;
        this.bez(e, uj, this.tmp);
        this.token(n++, this.tmp, COMET[j], tone, j === 0 ? 1 : 0.85 - j * 0.07);
      }
      this.bez(e, u, this.tmp);
      fx = this.tmp[0];
      fy = this.tmp[1];
    }
    for (let i = n; i < MAX_TOK; i++) Sp.aAlpha[i] = 0;
    // Arrival: a ring spreads from the stage the request (or the answer's first token) reaches.
    Sp.aAlpha[PULSE] = 0;
    for (let k = 1; k <= last && t >= 0; k++) {
      const s = steps[k];
      const at = k - 1 === plan.llmAt ? steps[k - 1].leave - 0.25 + TRAVEL : s.start;
      const q = (t - at) / PULSE_T;
      if (q < 0 || q > 1) continue;
      const g = s.slot;
      const ext = EXT[model.slots[g].kind];
      this.tmp[0] = this.lp[g * 3];
      this.tmp[1] = this.lp[g * 3 + 1];
      this.tmp[2] = this.lp[g * 3 + 2];
      this.token(PULSE, this.tmp, (0.9 + 1.5 * smooth(0, 1, q)) * Math.max(ext[0], ext[1]) * 1.3, this.tones[k - 1 >= plan.llmAt && plan.llmAt >= 0 ? T.accent : T.ai], (1 - q) * (1 - q) * 0.9);
      break;
    }
    gl.sprites.touch("aPos", 0, DYN);
    gl.sprites.touch("aSize", 0, DYN);
    gl.sprites.touch("aAlpha", 0, DYN);
    gl.sprites.touch("aColor", 0, DYN);

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
    if (f.clip) {
      // Cut by the section's edge: follow it exactly, so nothing is drawn past it.
      fit.x = f.x;
      fit.y = f.y;
      fit.s = Math.min(damp(fit.s, f.scale, 5, dt), f.scale);
    } else {
      fit.x = damp(fit.x, f.x, 14, dt);
      fit.y = damp(fit.y, f.y, 14, dt);
      fit.s = damp(fit.s, f.scale, 5, dt);
    }
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
    const ey = kind === "llm" ? 1.32 : EXT[kind][1];
    const grow = smooth(0, 1, this.presence[g]);
    out[0] = this.lp[g * 3];
    out[1] = this.lp[g * 3 + 1] + side * (ey * (0.35 + 0.65 * grow) + 0.1);
    out[2] = this.lp[g * 3 + 2];
  }

  dispose() {
    this.gl.dispose();
  }
}
