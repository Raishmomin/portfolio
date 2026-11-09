// The FAQ scene's visuals (lazy 3D chunk). Each one writes targets into the shared pools
// (gl.ts) inside the visual's box, in local CSS px (y up, z toward the camera), and declares
// its aria-hidden labels. The site's vocabulary: glowing point sprites, 1-2 px glowing
// edges, translucent glass. Only real data: the career from data.experience and
// facts.years, the stack from data.skills/links (and the skills the answer names), the
// availability statement, Ahmedabad's live time (and its daylight) from facts.utcOffsetMin,
// and what the answer itself states, server-extracted verbatim (components/ui/faq-meta.ts):
// its figures (each drawn on its own unit, never a shared scale), verdict, list, steps and
// the alternatives it weighs. Nothing allocates per frame.
import type { Color } from "three";
import type { NeuralData } from "../../types";
import { yearsLabel } from "../experience/path";
import { arc, dashes, dot, seg, type FaqGL } from "./gl";

export type Kind = "field" | "career" | "stack" | "beacon" | "clock" | "figures" | "versus" | "verdict" | "list" | "path";
export type Figure = {
  t: string;
  v: string;
  k: "money" | "time" | "percent" | "count";
  lo: number;
  hi: number;
  n0: number;
  n1: number;
  u: string;
  per?: string;
  plus?: 1;
  lt?: 1;
  gt?: 1;
};
export type Step = { t: string; x?: 1 };
export type Option = { t: string; s: string; i?: string[]; lead?: 1 };
/** The answer as the card's data-faq carries it (components/ui/faq-list.tsx). */
export type Said = { f: Figure[]; v: string | null; s: Step[]; l: "enum" | "say"; h: string | null; o: Option[] };
export type LabelKind = "tag" | "name" | "sub" | "plate" | "fig" | "big" | "cap";

export type Colors = {
  fg: Color;
  muted: Color;
  accent: Color;
  ok: Color;
  ai: Color;
  line: Color;
  layer: Record<string, Color>;
};

/** One FAQ item as the scene sees it (built from its DOM element). */
export type Item = {
  el: HTMLDetailsElement;
  sum: HTMLElement;
  pic: HTMLElement | null;
  id: string;
  topic: string;
  index: string;
  said: Said;
  /** Indices into data.skills of the skills its answer names in a positive clause (most used first). */
  named: number[];
  kind: Kind;
  /** 1: the same kind as the previous question, so it takes its other layout. */
  variant: number;
};

/** Per-frame context a visual draws with. */
export type Ctx = {
  gl: FaqGL;
  data: NeuralData;
  col: Colors;
  t: number;
  /** Visual radius (px) and centre (local px). */
  R: number;
  vx: number;
  vy: number;
  /** The visual's box (local px). */
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  low: boolean;
  item: Item | null;
  /** +1: the rail is on the visual's left (content left of the window); -1: on its right. */
  side: number;
  /** First free slot per pool (visuals start here) and the last dot slot they may use. */
  D: number;
  A: number;
  S: number;
  Dmax: number;
  /** Out: where the beam from the rail meets the visual. */
  inX: number;
  inY: number;
  label: (text: string, kind: LabelKind, x: number, y: number, ax: number, ay: number, color: Color | null, maxW: number, alpha: number, z: number) => void;
  pre: Pre;
};

/** Data-derived strings and layouts, prepared once per rig (no per-frame strings). */
export type Pre = {
  roles: { label: string; role: string; start: number; end: number; current: boolean }[];
  /** First role start, as a month count (year * 12 + month). */
  t0: number;
  yearsText: string;
  statement: string;
  skillOrder: number[];
  clock: { text: string; minute: number; utc: string };
  /** Sunrise and sunset at the city, local hours (from its latitude and today's declination). */
  sun: [number, number];
  /** The stack visual's selection, cached for its item (cleared on dispose). */
  sel: number[];
  selFor: Item | null;
};

export type Used = { d: number; a: number; s: number };

const TAU = Math.PI * 2;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

// ---------------------------------------------------------------- pen (slot cursors)

const P = { c: null as unknown as Ctx, d: 0, a: 0, s: 0 };
function begin(c: Ctx) {
  P.c = c;
  P.d = c.D;
  P.a = c.A;
  P.s = c.S;
  c.inX = c.vx;
  c.inY = c.vy;
}
const done = (): Used => ({ d: P.d, a: P.a, s: P.s });
function pt(x: number, y: number, z: number, c: Color, size: number, alpha: number) {
  if (P.d < P.c.Dmax) dot(P.c.gl, P.d++, x, y, z, c, size, alpha);
}
function ln(x0: number, y0: number, x1: number, y1: number, c: Color, alpha: number, width = 1.2, flow = 0, speed = 0.5) {
  if (P.s < P.c.gl.segs.count) seg(P.c.gl, P.s++, x0, y0, 0, x1, y1, 0, c, alpha, width, flow, speed);
}
/** Translucent glass band (a wide, faint segment). */
// The output is sRGB-encoded, so a linear alpha of 0.02 already reads as ~15% glass.
const glass = (x0: number, y0: number, x1: number, y1: number, c: Color, width: number, alpha = 0.022) => ln(x0, y0, x1, y1, c, alpha, width);
function ring(x: number, y: number, r: number, c: Color, alpha: number, thick = 1.2, s0 = 0, s1 = 1, dash = 0, glow = 0.5, ex = 0, ez = 0) {
  if (P.a < P.c.gl.arcs.count) arc(P.c.gl, P.a++, x, y, 0, ex, 0, ez, r, thick, s0, s1, c, alpha, dash, 0, glow);
}
function lb(text: string, kind: LabelKind, x: number, y: number, ax: number, ay: number, color: Color | null = null, maxW = 0, alpha = 1, z = 0) {
  if (text) P.c.label(text, kind, x, y, ax, ay, color, maxW, alpha, z);
}
/** Rail-relative x: u px from the box edge that faces the rail. */
const X = (u: number) => (P.c.side > 0 ? P.c.x0 + u : P.c.x1 - u);
/** Label anchor fraction for text that runs away from the rail. */
const away = () => (P.c.side > 0 ? 0 : -1);

const bz = [0, 0];
/** Cubic Bézier point at u → bz. */
export function bez(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, u: number, out: number[] = bz) {
  const m = 1 - u;
  const a = m * m * m;
  const b = 3 * m * m * u;
  const c = 3 * m * u * u;
  const e = u * u * u;
  out[0] = a * x0 + b * x1 + c * x2 + e * x3;
  out[1] = a * y0 + b * y1 + c * y2 + e * y3;
  return out;
}
/** A glowing curve from (x0,y0) to (x3,y3) leaving horizontally (a glass band under it when `band`). */
function curve(x0: number, y0: number, x3: number, y3: number, c: Color, alpha: number, width: number, flow: number, band = 0) {
  const n = 8;
  const mx = (x0 + x3) / 2;
  let px = x0;
  let py = y0;
  for (let k = 1; k <= n; k++) {
    bez(x0, y0, mx, y0, mx, y3, x3, y3, k / n);
    if (band > 0) glass(px, py, bz[0], bz[1], c, band, 0.01);
    ln(px, py, bz[0], bz[1], c, alpha, width, flow, 0.45);
    px = bz[0];
    py = bz[1];
  }
}
/** Point on a (tilted) circle at turn t from 12 o'clock clockwise → rot. */
const rot = { x: 0, y: 0, z: 0 };
function onRing(cx: number, cy: number, r: number, t: number, ex = 0) {
  const x = r * Math.sin(t * TAU);
  const y = r * Math.cos(t * TAU);
  rot.x = cx + x;
  rot.y = cy + y * Math.cos(ex);
  rot.z = y * Math.sin(ex);
}
/** A small node: a glowing sprite in a 1 px ring; a "no" gets a cross instead. */
function node(x: number, y: number, c: Color, r = 9, no = false) {
  const col = P.c.col;
  ring(x, y, r, no ? col.accent : c, 0.8, 1.2, 0, 1, 0, 0.5);
  if (no) {
    const k = r * 0.45;
    ln(x - k, y - k, x + k, y + k, col.accent, 0.95, 1.6);
    ln(x - k, y + k, x + k, y - k, col.accent, 0.95, 1.6);
  } else pt(x, y, 0, c, r * 1.3, 1);
}
/** Glass disc with a glowing rim and a dotted outer ring (hubs, orbs, the verdict). */
function orb(x: number, y: number, r: number, c: Color, lit: boolean) {
  const col = P.c.col;
  ring(x, y, r * 0.5, c, lit ? 0.008 : 0.005, r, 0, 1, 0, 0);
  ring(x, y, r, c, lit ? 0.95 : 0.7, lit ? 2 : 1.4, 0, 1, 0, lit ? 0.7 : 0.45);
  ring(x, y, r * 1.22, lit ? c : col.muted, 0.5, 1, 0, 1, dashes(Math.max(24, r * 0.6), 0.35), 0, 0, P.c.t * 0.08);
}
const YES = /^(yes|often|usually|almost always yes)$/i;
const NO = /^(no|probably not|not usually)$/i;
/** "Yes" / "Probably not" mark: a small ring and its glyph, the word beside it (away from the rail). */
function badge(v: string, x: number, y: number) {
  const col = P.c.col;
  const yes = YES.test(v);
  const no = NO.test(v);
  const c = yes ? col.ok : no ? col.accent : col.ai;
  ring(x, y, 9, c, 0.9, 1.4, 0, 1, 0, 0.6);
  if (yes) {
    ln(x - 4, y, x - 1, y - 3.5, c, 1, 1.6);
    ln(x - 1, y - 3.5, x + 4.5, y + 3.5, c, 1, 1.6);
  } else pt(x, y, 0, c, 9, 1);
  lb(v, "name", x + P.c.side * 16, y, away(), -0.5, c);
}

// ---------------------------------------------------------------- idle: the answer core

/**
 * The answer core the question threads converge on (idle): a glass lens with three thin
 * rings turning, and one spark per question on its rim (the hovered one lit).
 */
export function field(c: Ctx, cx: number, cy: number, hot: number, n: number, hover: number): Used {
  begin(c);
  const { col, t, R } = c;
  const g = R * 0.42 * (1 + 0.06 * hot);
  const hc = hot > 0 ? col.accent : col.ai;
  ring(c.vx, c.vy, R * 1.02, col.line, 0.4, 1, 0, 1, dashes(72, 0.3), 0, 0, t * 0.02);
  ring(cx, cy, g * 0.5, col.ai, 0.004, g, 0, 1, 0, 0);
  for (let k = 0; k < 3; k++) {
    const ex = k === 0 ? 1.1 + 0.3 * Math.sin(t * 0.3) : k === 1 ? -0.9 : 0.4 + t * 0.21;
    const ez = t * (0.12 + 0.07 * k) + k;
    const r = g * (0.78 - 0.16 * k);
    ring(cx, cy, r, k === 1 ? col.fg : hc, k === 1 ? 0.5 : 0.8, 1.4, 0, 1, 0, 0.6, ex, ez);
    onRing(cx, cy, r, (t * (0.16 + 0.05 * k) + k / 3) % 1, ex);
    pt(rot.x, rot.y, rot.z, k === 1 ? col.fg : hc, 10, 0.95);
  }
  ring(cx, cy, g, col.muted, 0.55, 1, 0, 1, dashes(48, 0.3), 0, 0, -t * 0.05);
  for (let i = 0; i < n; i++) {
    onRing(cx, cy, g * 1.16, i / n + t * 0.015);
    const lit = i === hover;
    pt(rot.x, rot.y, 0, lit ? col.accent : col.fg, lit ? 16 : 8, lit ? 1 : 0.6);
  }
  pt(cx, cy, 0, hc, 30 + 6 * Math.sin(t * 2.1) + 8 * hot, 0.95);
  return done();
}

// ---------------------------------------------------------------- career (experience)

const ROLE_MAX = 6;

/** One ring per year since the first role; each role lit along the months it covers. */
export function career(c: Ctx): Used {
  begin(c);
  const { col, t, pre } = c;
  const roles = pre.roles;
  const nr = Math.min(ROLE_MAX, roles.length);
  const legend = nr * 34 + 10;
  const R = Math.max(50, Math.min(c.R, (c.y1 - c.y0 - legend - 30) / 2));
  const vx = c.vx;
  const vy = c.y1 - 10 - R;
  const now = monthNow();
  const total = Math.max(1, now - pre.t0);
  const rings = Math.min(9, Math.max(1, Math.ceil(total / 12)));
  const r0 = R * 0.34;
  const step = (R * 0.96 - r0) / rings;
  const ex = 0.25 * Math.sin(t * 0.2);
  const lx = c.x0 + (c.x1 - c.x0) * 0.2;
  ring(vx, vy, r0 * 0.5, col.ai, 0.005, r0, 0, 1, 0, 0);
  for (let k = 0; k < rings; k++) ring(vx, vy, r0 + step * (k + 0.5), col.muted, 0.4, 1, 0, 1, dashes(48, 0.12), 0, ex);
  for (let i = 0; i < nr; i++) {
    const role = roles[i];
    const m0 = role.start - pre.t0;
    const m1 = Math.min(role.end, now) - pre.t0;
    const color = role.current ? col.ok : col.accent;
    for (let k = Math.floor(m0 / 12); k < rings && k * 12 < m1; k++) {
      const s0 = Math.max(m0, k * 12) / 12 - k;
      const e0 = Math.min(m1, k * 12 + 12) / 12 - k;
      if (e0 - s0 > 0.004) ring(vx, vy, r0 + step * (k + 0.5), color, 0.95, 1.5, s0, e0, 0, 0.3, ex);
    }
    const k0 = Math.floor(m0 / 12);
    onRing(vx, vy, r0 + step * (k0 + 0.5), m0 / 12 - k0, ex);
    pt(rot.x, rot.y, rot.z + 1, color, 13, 1);
    // Legend row: "Company · years" and the role, in the experience path's label style.
    const ly = c.y1 - 2 * R - 34 - i * 34;
    pt(lx, ly, 0, color, 11, 1);
    lb(role.label, "name", lx + 2, ly, 0, -0.5, role.current ? col.ok : col.fg);
    lb(role.role, "sub", lx + 2, ly - 15, 0, -0.5);
  }
  const kN = Math.min(rings - 1, Math.floor(total / 12));
  onRing(vx, vy, r0 + step * (kN + 0.5), total / 12 - kN, ex);
  const p = (t * 0.6) % 1;
  pt(rot.x, rot.y, rot.z + 2, col.ok, 20 + 4 * Math.sin(t * 3), 1);
  ring(rot.x, rot.y, 8 + 20 * p, col.ok, 0.8 * (1 - p) * (1 - p), 1.4, 0, 1, 0, 0.4);
  lb(pre.yearsText, "big", vx, vy, -0.5, -0.5);
  c.inX = vx - c.side * R;
  c.inY = vy;
  return done();
}

/** Current month as year * 12 + month (0-based month). */
export function monthNow() {
  const n = new Date();
  return n.getFullYear() * 12 + n.getMonth();
}

// ---------------------------------------------------------------- stack (skills constellation)

const px = new Float32Array(16);
const py = new Float32Array(16);
const pz = new Float32Array(16);

/** The most-used skills (or those the answer names, with their co-used neighbours), sized by uses. */
export function stack(c: Ctx): Used {
  begin(c);
  const { col, t, R, vx, vy, data, item, low, pre } = c;
  const skills = data.skills;
  if (pre.selFor !== item) {
    pre.selFor = item;
    const max = low ? 8 : 10;
    const sel = pre.sel;
    sel.length = 0;
    for (const i of item?.named ?? []) if (sel.length < max) sel.push(i);
    if (item && item.topic !== "stack")
      for (const l of data.links) {
        if (sel.length >= Math.min(max, item.named.length + 4)) break;
        const ia = skillIndex(data, l.a);
        const ib = skillIndex(data, l.b);
        if (sel.includes(ia) && ib >= 0 && !sel.includes(ib)) sel.push(ib);
        else if (sel.includes(ib) && ia >= 0 && !sel.includes(ia)) sel.push(ia);
      }
    for (const i of pre.skillOrder) {
      if (sel.length >= max) break;
      if (!sel.includes(i)) sel.push(i);
    }
    sel.sort((a, b) => skills[b].uses - skills[a].uses || a - b);
  }
  const sel = pre.sel;
  const n = sel.length;
  let maxUses = 1;
  for (const s of skills) maxUses = Math.max(maxUses, s.uses);
  const named = item?.named ?? [];
  const ex = 1.0;
  const nIn = Math.min(4, n - 1);
  const nOut = n - 1 - nIn;
  const rIn = R * 0.46;
  const rOut = R * 0.88;
  ring(vx, vy, rIn, col.muted, 0.4, 1, 0, 1, dashes(40, 0.4), 0, ex, t * 0.05);
  if (nOut > 0) ring(vx, vy, rOut, col.muted, 0.35, 1, 0, 1, dashes(64, 0.4), 0, ex, -t * 0.03);
  for (let k = 0; k < n; k++) {
    if (k === 0) {
      px[0] = vx;
      py[0] = vy;
      pz[0] = 0;
    } else {
      const inner = k <= nIn;
      onRing(vx, vy, inner ? rIn : rOut, inner ? (k - 1) / nIn + 0.125 + t * 0.012 : (k - 1 - nIn) / Math.max(1, nOut) + 0.06 - t * 0.008, ex);
      px[k] = rot.x;
      py[k] = rot.y;
      pz[k] = rot.z;
    }
  }
  // Real co-usage links between the shown skills (brighter = more shared projects).
  for (const l of data.links) {
    const ia = sel.indexOf(skillIndex(data, l.a));
    const ib = sel.indexOf(skillIndex(data, l.b));
    if (ia < 0 || ib < 0 || P.s >= c.gl.segs.count) continue;
    const w = Math.min(1, l.weight / 4);
    seg(c.gl, P.s++, px[ia], py[ia], pz[ia], px[ib], py[ib], pz[ib], col.ai, 0.18 + 0.4 * w, 1 + 0.6 * w, 1, 0.3 + 0.2 * w);
  }
  for (let k = 0; k < n; k++) {
    const s = skills[sel[k]];
    const depth = k === 0 ? 1 : 0.55 + 0.45 * clamp01((pz[k] / (k <= nIn ? rIn : rOut) + 1) / 2);
    const color = col.layer[s.layer] ?? col.fg;
    const lit = named.includes(sel[k]) && named.length < n;
    const r = 5 + 11 * (s.uses / maxUses); // node radius 5-16 px by uses
    if (P.d < c.Dmax) dot(c.gl, P.d++, px[k], py[k], pz[k], color, r * 2.2 * (0.8 + 0.2 * depth), depth);
    if (P.a < c.gl.arcs.count) arc(c.gl, P.a++, px[k], py[k], pz[k], 0, 0, t * 0.5 + k, r + 5, lit ? 1.6 : 1, 0, 1, lit ? col.accent : color, (lit ? 1 : 0.55) * depth, lit ? 0 : dashes(8, 0.6), 0, 0.5);
    // Label radially outside its ring; named skills always at full strength.
    const dx = px[k] - vx;
    const dy = py[k] - vy;
    const dl = Math.max(1, Math.hypot(dx, dy));
    const off = r + 9;
    const lx = k === 0 ? px[k] : px[k] + (dx / dl) * off;
    const ly = k === 0 ? py[k] - off - 4 : py[k] + (dy / dl) * off;
    lb(s.name, "name", lx, ly, k === 0 ? -0.5 : dx >= 0 ? 0 : -1, k === 0 ? 0 : dy >= 0 ? -1 : 0, lit ? col.accent : color, 0, lit || !named.length ? 1 : 0.55 + 0.45 * depth, pz[k]);
  }
  c.inX = vx - c.side * rOut;
  return done();
}

const idCache = new WeakMap<NeuralData, Map<string, number>>();
function skillIndex(data: NeuralData, id: string): number {
  let m = idCache.get(data);
  if (!m) {
    m = new Map(data.skills.map((s, i) => [s.id, i]));
    idCache.set(data, m);
  }
  return m.get(id) ?? -1;
}

// ---------------------------------------------------------------- beacon (availability)

export function beacon(c: Ctx): Used {
  begin(c);
  const { col, t, R, vx, item, pre } = c;
  const bx = vx;
  const by = c.vy - R * 0.2;
  const ex = 1.22;
  ring(bx, by, R * 0.72, col.ok, 0.55, 1.2, 0, 1, dashes(54, 0.45), 0.3, ex, t * 0.15);
  ring(bx, by, R * 0.36, col.ok, 0.01, R * 0.72, (t * 0.22) % 1, ((t * 0.22) % 1) + 0.14, 0, 0, ex);
  for (let j = 0; j < 3; j++) {
    const p = (t * 0.42 + j / 3) % 1;
    ring(bx, by, R * (0.08 + 0.64 * p), col.ok, 0.85 * (1 - p) * (1 - p), 1.4, 0, 1, 0, 0.6, ex);
  }
  const pulse = 0.5 + 0.5 * Math.sin(t * 3.2);
  pt(bx, by, 2, col.ok, 44 + 10 * pulse, 1);
  ring(bx, by, 18 + 4 * pulse, col.ok, 0.8, 1.6, 0, 1, 0, 0.6);
  ln(bx, by, bx, by + R * 0.78, col.ok, 0.75, 1.5, 3, 0.7);
  pt(bx, by + R * 0.78, 2, col.ok, 16, 0.9);
  const said = item?.said;
  if (said?.v) lb(said.v, "big", bx, by + R * 0.78 + 12, -0.5, -1, col.ok);
  // A small count or span the answer quotes: slots on the ground, filled to the low end.
  let f: Figure | null = null;
  for (const x of said?.f ?? []) if (!f && (x.k === "count" || x.k === "time") && x.n1 <= 12 && !x.per) f = x;
  if (f) {
    const hi = Math.max(1, Math.round(f.n1));
    const lo = Math.max(1, Math.min(hi, Math.round(f.n0)));
    for (let k = 0; k < hi; k++) {
      onRing(bx, by, R * 0.5, k / hi + t * 0.05, ex);
      const filled = k < lo;
      pt(rot.x, rot.y, rot.z, filled ? col.ok : col.fg, filled ? 20 : 12, filled ? 1 : 0.55);
      if (P.a < c.gl.arcs.count) arc(c.gl, P.a++, rot.x, rot.y, rot.z, 0, 0, 0, filled ? 11 : 8, 1.2, 0, 1, filled ? col.ok : col.muted, filled ? 0.8 : 0.5, filled ? 0 : dashes(8, 0.5), 0, 0.3);
    }
    lb(f.t, "plate", bx + c.side * R * 0.66, by - R * 0.12, away(), -0.5, col.ok);
  }
  if (pre.statement) lb(pre.statement, "cap", bx, by - R * 0.5, -0.5, 0, col.ok, Math.min(360, c.x1 - c.x0 - 40));
  c.inX = bx - c.side * R * 0.72;
  c.inY = by;
  return done();
}

// ---------------------------------------------------------------- clock (time zone)

/** City coordinates (degrees) for its daylight; any other city falls back to its UTC offset. */
const CITY: Record<string, [number, number]> = { ahmedabad: [23.02, 72.57] };

/**
 * A 24-hour dial of point sprites (midnight at the top): the hours the sun is up at the
 * city lit, the local day so far traced, the hand at the live local time. Below it what the
 * answer states: the span it quotes ("4+ hours") and the regions it lists.
 */
export function clock(c: Ctx): Used {
  begin(c);
  const { col, t, R, vx, pre, data, item } = c;
  const H = c.y1 - c.y0;
  const said = item?.said;
  const rows = (said?.f.length ?? 0) + (said?.l === "enum" ? 1 : 0);
  const Rd = Math.max(46, Math.min(R * 0.6, (H - 80 - rows * 76) / 2));
  const cy = c.y1 - 34 - Rd;
  const off = data.facts.utcOffsetMin;
  const local = ((((Date.now() / 60000 + off) % 1440) + 1440) % 1440) / 60;
  const [rise, set] = pre.sun;
  ring(vx, cy, Rd * 0.5, col.ai, 0.005, Rd, 0, 1, 0, 0);
  ring(vx, cy, Rd * 1.14, col.muted, 0.4, 1, 0, 1, dashes(96, 0.25), 0);
  for (let h = 0; h < 24; h++) {
    onRing(vx, cy, Rd, h / 24);
    const day = h + 0.5 > rise && h + 0.5 < set;
    pt(rot.x, rot.y, 0, day ? col.accent : col.ai, h % 6 === 0 ? 13 : day ? 10 : 7, day ? 0.95 : 0.55);
  }
  ring(vx, cy, Rd * 0.86, col.accent, 0.85, 1.6, 0, local / 24, 0, 0.7);
  onRing(vx, cy, Rd * 0.86, local / 24);
  ln(vx, cy, rot.x, rot.y, col.accent, 0.9, 1.5);
  pt(rot.x, rot.y, 0, col.accent, 18 + 3 * Math.sin(t * 3), 1);
  pt(vx, cy, 0, col.fg, 12, 0.9);
  lb(pre.clock.text, "plate", vx, cy + Rd * 1.14 + 10, -0.5, -1, col.accent);
  let y = cy - Rd * 1.14 - 46;
  for (const f of said?.f ?? []) {
    if (y < c.y0 + 30) break;
    mini(f, y);
    y -= 76;
  }
  if (said?.l === "enum" && y > c.y0 + 20) {
    const items = said.s;
    const w = c.x1 - c.x0;
    lb(said.h ?? "", "cap", c.x0 + 30, y + 12, 0, -1, null, w - 60);
    for (let k = 0; k < items.length; k++) {
      const x = c.x0 + 36 + (k * (w - 72)) / Math.max(1, items.length);
      pt(x, y - 10, 0, col.ok, 11, 1);
      lb(items[k].t, "name", x + 2, y - 10, 0, -0.5);
    }
  }
  c.inX = vx - c.side * Rd * 1.14;
  c.inY = cy;
  return done();
}

// ---------------------------------------------------------------- figures (each on its own unit)

const SUB: Record<string, number> = { week: 7, day: 24, "business day": 24, month: 4, year: 12, hour: 12 };
const STEPS = [1, 2, 5, 10, 20, 50, 100, 200, 500];

/**
 * A figure on its own unit as a row of glass cells from xa to xb, read left to right (time,
 * count or rate; percent in tenths): certain units lit with a glowing edge and a point, a
 * range's uncertain part pulsing, an upper bound capped, an open end ("4+") fading. `hh`:
 * half the cells' height.
 */
function row(f: Figure, xa: number, xb: number, y: number, color: Color, hh = 10, nAll = 0) {
  const { col, t } = P.c;
  let N: number;
  let solid: number;
  let band: number;
  if (f.k === "percent") {
    N = 10;
    solid = f.n0 / 10;
    band = f.n1 / 10;
  } else if (f.n1 <= 1 && f.n0 === f.n1) {
    N = SUB[f.u] ?? 1;
    solid = band = N;
  } else {
    const top = Math.max(f.n1, nAll);
    const step = STEPS.find((s) => top / s <= 12) ?? 1000;
    N = Math.ceil(top / step) + (f.plus ? 2 : 0);
    solid = f.n0 / step;
    band = f.n1 / step;
  }
  const dx = (xb - xa) / N;
  const xs = xa + solid * dx;
  const xe = xa + Math.max(solid, band) * dx;
  const fine = N > 12;
  const gap = fine ? 0 : Math.min(6, dx * 0.16);
  if (fine) {
    glass(xa, y, xs, y, color, hh * 2, 0.03);
    ln(xa, y + hh, xs, y + hh, color, 0.9, 1.2);
  }
  for (let k = 0; k < N; k++) {
    const a = xa + k * dx + gap / 2;
    const b = xa + (k + 1) * dx - gap / 2;
    const m = k + 0.5;
    const on = m < solid;
    const maybe = !on && m < band;
    const pulse = 0.45 + 0.3 * Math.sin(t * 2.2 + k);
    if (!fine) {
      if (on || maybe) glass(a, y, b, y, color, hh * 2, on ? 0.02 : 0.008);
      ln(a, y + hh, b, y + hh, on || maybe ? color : col.muted, on ? 0.9 : maybe ? pulse : f.plus ? 0.5 * (1 - (k - solid) / 3) : 0.3, 1.2);
    }
    pt((a + b) / 2, y, 0, on || maybe ? color : col.muted, on ? (fine ? 6 : 9) : maybe ? 7 : 4, on ? 1 : maybe ? pulse : 0.3);
  }
  for (let k = 0; k <= N; k += fine ? 6 : 1) pt(xa + k * dx, y - hh - 7, 0, col.muted, 4, 0.6);
  if (xs > xa) pt(xa + ((t * 0.25) % 1) * (xs - xa), y + hh, 0, color, 11, 0.9);
  if (f.lt) {
    ln(xe, y - hh - 9, xe, y + hh + 9, color, 0.9, 1.4);
    pt(xe, y + hh + 9, 0, color, 7, 1);
  }
}

const tint = (f: Figure) => {
  const col = P.c.col;
  return f.k === "money" ? col.accent : f.k === "percent" ? col.ok : f.k === "time" ? col.ai : col.fg;
};

/** A price tag (pointed toward the rail, a hole at its tip) centred at (x, y). */
function tag(x: number, y: number, w: number, h: number, c: Color) {
  const s = P.c.side;
  const l = x - s * (w / 2);
  const r = x + s * (w / 2);
  const tip = l - s * h * 0.5;
  glass(l, y, r, y, c, h - 4, 0.012);
  ln(l, y + h / 2, r, y + h / 2, c, 0.85, 1.4);
  ln(r, y + h / 2, r, y - h / 2, c, 0.85, 1.4);
  ln(r, y - h / 2, l, y - h / 2, c, 0.85, 1.4);
  ln(l, y - h / 2, tip, y, c, 0.85, 1.4);
  ln(tip, y, l, y + h / 2, c, 0.85, 1.4);
  ring(tip + s * h * 0.36, y, 4, c, 0.9, 1.2, 0, 1, 0, 0.5);
}

/** A secondary figure under the main one: its words, then its row (left to right) or tag, and its value. */
function mini(f: Figure, y: number) {
  const c = P.c;
  const color = tint(f);
  const w = c.x1 - c.x0;
  const xa = c.x0 + 30;
  lb(f.t, "cap", xa, y + 12, 0, -1, null, w - 60);
  if (f.k === "money") {
    tag(xa + 70, y - 18, 110, 34, color);
    lb(f.v, "fig", xa + 70, y - 18, -0.5, -0.5, color);
    return;
  }
  const units = f.k === "percent" ? 10 : f.n1 <= 1 ? (SUB[f.u] ?? 1) : 8;
  const xb = xa + Math.min(w - 170, 26 * Math.max(5, units));
  row(f, xa, xb, y - 14, color, 7);
  lb(f.v, "plate", xb + 14, y - 14, 0, -0.5, color);
}

/**
 * The figures an answer quotes, each on its own unit: two shares of one whole as a fork,
 * several amounts as columns (per-week rates apart from fixed prices), one share as a dial
 * of points (a row when the previous answer had one), one price as a tag, one span or count
 * as a row of units (a reply time as a round trip), several spans as lanes. The answer's
 * words only: each figure with the phrase that says what it counts; the verdict apart.
 */
export function figures(c: Ctx): Used {
  begin(c);
  const said = c.item?.said;
  const figs = said?.f ?? [];
  const { col } = c;
  const W = c.x1 - c.x0;
  const H = c.y1 - c.y0;
  const cx = (c.x0 + c.x1) / 2;
  const cy = (c.y0 + c.y1) / 2;
  if (said?.v) badge(said.v, X(26), c.y1 - 16);
  const pct = figs.filter((f) => f.k === "percent");
  const money = figs.filter((f) => f.k === "money");
  const rest = (skip: Figure[]) => figs.filter((f) => !skip.includes(f));
  const xa = c.x0 + 36;
  const xb = c.x1 - 36;
  let more: Figure[] = [];
  let yMore = cy - H * 0.26;
  if (pct.length === 2 && Math.abs(pct[0].n1 + pct[1].n1 - 100) < 0.5) {
    // Fork: one source splits into two shares of the whole.
    const src = figs.find((f) => f.k !== "percent") ?? null;
    const sx = X(70);
    const ex = X(W - 150);
    orb(sx, cy, 26, col.ai, true);
    if (src) {
      lb(src.v, "plate", sx, cy + 44, -0.5, -1, tint(src));
      lb(src.t, "cap", sx, cy - 44, -0.5, 0, null, 150);
    }
    const big = pct[0].n1 >= pct[1].n1 ? 0 : 1;
    for (let k = 0; k < 2; k++) {
      const f = pct[k];
      const share = f.n1 / 100;
      const ey = cy + (k === big ? 1 : -1) * H * 0.22;
      const color = k === big ? col.ok : col.accent;
      curve(sx + c.side * 26, cy, ex, ey, color, 0.95, 1.2 + share, 2, 6 + 44 * share);
      pt(ex, ey, 0, color, 12 + 16 * share, 1);
      lb(f.v, "big", ex + c.side * 18, ey + 4, away(), 0, color);
      lb(f.t, "cap", ex + c.side * 18, ey - 26, away(), 0, null, 140);
    }
    c.inX = sx - c.side * 26;
    c.inY = cy;
  } else if (money.length >= 2 || pct.length >= 2) {
    // Columns: amounts of one kind on one scale (rates per unit apart from fixed prices).
    const cols = money.length >= 2 ? money.filter((f) => f.per) : pct;
    const fixed = money.length >= 2 ? money.filter((f) => !f.per) : [];
    const k = cols.length + fixed.length;
    const slot = (W - 40) / Math.max(2, k);
    const base = cy - H * 0.16;
    const top = c.y1 - 70;
    const max = cols.reduce((m, f) => Math.max(m, f.k === "percent" ? 100 : f.n1), 1);
    let i = 0;
    for (const f of cols) {
      const x = X(20 + slot * (i++ + 0.5));
      const color = tint(f);
      const ys = base + ((top - base) * f.n0) / max;
      const ye = base + ((top - base) * f.n1) / max;
      if (f.k === "percent") ln(x, base, x, top, col.muted, 0.25, 1);
      glass(x, base, x, ys, color, 30, 0.018);
      ln(x, base, x, ys, color, 0.9, 1.5, 2, 0.3);
      if (ye > ys) {
        glass(x, ys, x, ye, color, 30, 0.014);
        for (let j = 1; j <= 3; j++) pt(x, ys + ((ye - ys) * j) / 3, 0, color, 7, 0.6);
      }
      pt(x, ye, 0, color, 15, 1);
      lb(f.v, "plate", x, ye + 12, -0.5, -1, color);
      lb(f.t, "cap", x, base - 12, -0.5, 0, null, slot - 14);
    }
    if (fixed.length && cols.length) ln(X(20 + slot * cols.length), base - 8, X(20 + slot * cols.length), top, col.muted, 0.3, 1);
    for (const f of fixed) {
      const x = X(20 + slot * (i++ + 0.5));
      tag(x, (base + top) / 2, Math.min(slot - 30, 130), 40, tint(f));
      lb(f.v, "fig", x, (base + top) / 2, -0.5, -0.5, tint(f));
      lb(f.t, "cap", x, base - 12, -0.5, 0, null, slot - 14);
    }
    more = money.length >= 2 ? rest(money) : rest(pct);
    yMore = base - 84;
    c.inX = X(20);
    c.inY = (base + top) / 2;
  } else if (pct.length === 1) {
    // One share of a whole: 20 points round a dial (a row of them after another dial).
    const f = pct[0];
    const y = cy + H * 0.12;
    if (c.item?.variant) {
      lb(f.v, "big", cx, y + 30, -0.5, -1, col.ok);
      row(f, xa, xb, y, col.ok, 13);
      lb(f.t, "cap", cx, y - 32, -0.5, 0, null, W - 80);
      c.inX = X(36);
      c.inY = y;
    } else {
      const r = Math.min(c.R * 0.6, H * 0.24);
      ring(cx, y, r * 1.2, col.muted, 0.35, 1, 0, 1, dashes(72, 0.3), 0, 0, c.t * 0.02);
      ring(cx, y, r, col.ok, 0.014, 22, 0, f.n0 / 100, 0, 0);
      ring(cx, y, r, col.ok, 0.9, 1.6, 0, f.n0 / 100, 0, 0.7);
      for (let k = 0; k < 20; k++) {
        onRing(cx, y, r, (k + 0.5) / 20);
        const m = (k + 0.5) * 5;
        if (m < f.n0) pt(rot.x, rot.y, 0, col.ok, 11, 1);
        else if (m < f.n1) pt(rot.x, rot.y, 0, col.ok, 9, 0.4 + 0.35 * Math.sin(c.t * 2.2 + k));
        else pt(rot.x, rot.y, 0, col.muted, 6, 0.4);
      }
      lb(f.v, "big", cx, y, -0.5, -0.5, col.ok);
      lb(f.t, "cap", cx, y - r * 1.2 - 12, -0.5, 0, null, W - 80);
      c.inX = cx - c.side * r * 1.2;
      c.inY = y;
    }
    more = rest(pct);
  } else if (money.length === 1) {
    const f = money[0];
    const y = cy + H * 0.14;
    const tw = Math.min(W * 0.5, 240);
    tag(cx, y, tw, 80, col.accent);
    lb(f.v, "big", cx, y, -0.5, -0.5, col.accent);
    if (f.t !== f.v) lb(f.t, "cap", cx, y - 54, -0.5, 0, null, W - 80);
    more = rest(money);
    c.inX = cx - c.side * (tw / 2 + 40);
    c.inY = y;
  } else {
    const spans = figs.filter((f) => f.k === "time" && !f.per);
    if (spans.length >= 2 && spans.every((f) => f.u === spans[0].u)) {
      // Lanes: spans on one unit, one row each.
      const nAll = spans.reduce((m, f) => Math.max(m, f.n1), 0);
      let y = cy + H * 0.2;
      for (const f of spans) {
        lb(f.t, "cap", xa, y + 18, 0, -1, null, W - 72);
        row(f, xa, xb, y, col.ai, 9, nAll);
        y -= 92;
      }
      more = rest(spans);
      c.inX = X(36);
      c.inY = cy + H * 0.2;
    } else if (c.item?.topic === "response" && spans.length) {
      // A reply time: the message's round trip, its span as the arc's units.
      const f = spans[0];
      const y = cy - H * 0.02;
      const ax = X(60);
      const bx = X(W - 60);
      const lift = H * 0.3;
      const n = Math.min(24, SUB[f.u] ?? Math.max(4, Math.round(f.n1)));
      const u = (c.t * 0.22) % 1;
      let qx = ax;
      let qy = y;
      for (let k = 1; k <= 10; k++) {
        bez(ax, y, ax, y + lift, bx, y + lift, bx, y, k / 10);
        ln(qx, qy, bz[0], bz[1], col.ai, 0.85, 1.4);
        qx = bz[0];
        qy = bz[1];
      }
      for (let k = 0; k < n; k++) {
        const v = (k + 0.5) / n;
        bez(ax, y, ax, y + lift, bx, y + lift, bx, y, v);
        pt(bz[0], bz[1], 0, v < u ? col.ai : col.muted, v < u ? 9 : 6, v < u ? 1 : 0.45);
      }
      bez(ax, y, ax, y + lift, bx, y + lift, bx, y, u);
      pt(bz[0], bz[1], 0, col.accent, 20, Math.sin(u * Math.PI));
      for (let k = 0; k < 8; k++) {
        bez(bx, y, bx, y - lift * 0.5, ax, y - lift * 0.5, ax, y, (k + 0.5) / 8);
        pt(bz[0], bz[1], 0, col.ok, 6, 0.5);
      }
      orb(ax, y, 16, col.ai, true);
      orb(bx, y, 16, col.ok, true);
      lb(f.v, "big", cx, y + lift * 0.75 + 16, -0.5, -1, col.ai);
      lb(f.t, "cap", cx, y - lift * 0.4 - 18, -0.5, 0, null, W - 80);
      const next = said?.s.find((s) => s.t !== f.t && !s.t.includes(f.v));
      if (next) lb(next.t, "sub", cx, y - lift * 0.4 - 62, -0.5, 0, null, W - 80);
      c.inX = ax - c.side * 16;
      c.inY = y;
    } else {
      // One span, rate or count as a row of its own units.
      const f = spans[0] ?? figs.find((x) => x.k === "time") ?? figs[0];
      const y = cy + H * 0.14;
      lb(f.v, "big", cx, y + 30, -0.5, -1, tint(f));
      row(f, xa, xb, y, tint(f), 13);
      lb(f.t, "cap", cx, y - 32, -0.5, 0, null, W - 80);
      more = rest([f]);
      c.inX = X(36);
      c.inY = y;
    }
  }
  let y = yMore;
  for (const f of more) {
    if (y < c.y0 + 40) break;
    mini(f, y);
    y -= 80;
  }
  return done();
}

// ---------------------------------------------------------------- versus ("X vs Y", "X or Y")

/** Rough rendered lines of a 12.5 px caption in a box `w` px wide. */
const lines = (s: string, w: number) => Math.max(1, Math.ceil((s.length * 6.6) / Math.max(60, w)));

/**
 * The alternatives a question weighs as glass orbs side by side, the answer's default lit
 * and larger; under each, the clause that says when it fits and the items listed for it.
 * "Both": the orbs overlap.
 */
export function versus(c: Ctx): Used {
  begin(c);
  const said = c.item?.said;
  const opts = said?.o ?? [];
  const { col, t } = c;
  const W = c.x1 - c.x0;
  const H = c.y1 - c.y0;
  const both = !!said?.v && /^both$/i.test(said.v);
  const k = opts.length;
  const slot = (W - 20) / k;
  const mid = (c.x0 + c.x1) / 2;
  const r0 = Math.min(slot * 0.28, H * 0.13, 64);
  const y = c.y1 - 30 - r0 * 1.3;
  for (let i = 0; i < k; i++) {
    const o = opts[i];
    const x = both ? mid + (i === 0 ? -1 : 1) * c.side * r0 * 0.62 : X(10 + slot * (i + 0.5));
    const lead = !!o.lead;
    const r = r0 * (lead ? 1.15 : both ? 1 : 0.9);
    const color = lead ? col.accent : i % 2 ? col.ok : col.ai;
    orb(x, y, r, color, lead || both);
    for (let j = 0; j < 3; j++) {
      onRing(x, y, r * 1.22, j / 3 + t * (0.04 + 0.01 * i), 0.9);
      pt(rot.x, rot.y, rot.z, color, 8, 0.8);
    }
    if (both) lb(o.t, "name", x + (i === 0 ? -1 : 1) * c.side * r * 0.5, y + r * 1.22 + 8, -0.5, -1, color);
    else lb(o.t, "name", x, y, -0.5, -0.5, lead ? col.accent : col.fg);
    const lx = both ? mid + (i === 0 ? -1 : 1) * c.side * (W / 4) : x;
    const capW = both ? W / 2 - 24 : slot - 18;
    let ly = y - r * 1.22 - 16;
    lb(o.s, "cap", lx, ly, -0.5, 0, null, capW);
    ly -= lines(o.s, capW) * 17 + 14;
    for (const it of o.i ?? []) {
      if (ly < c.y0 + 10) break;
      pt(lx - capW / 2 + 6, ly - 7, 0, color, 8, 0.9);
      lb(it, "sub", lx - capW / 2 + 16, ly, 0, 0, null, capW - 20);
      ly -= lines(it, capW - 20) * 14 + 6;
    }
    if (i > 0 && !both) ln(X(10 + slot * (i - 0.5)) + c.side * r0 * 1.3, y, x - c.side * r * 1.3, y, col.muted, 0.45, 1, 2, 0.3);
  }
  if (both) lb(said?.v ?? "", "plate", mid, y, -0.5, -0.5, col.fg);
  c.inX = both ? mid - c.side * r0 * 1.8 : X(10 + slot * 0.5) - c.side * r0 * 1.2;
  c.inY = y;
  return done();
}

// ---------------------------------------------------------------- verdict ("Yes", "Both", ...) and its qualifiers

/**
 * The verdict in a glass ring (a check, a cross, two circles for "Both", half lit for
 * "Sometimes") with the answer's own qualifiers branching off it, so two "Yes" answers
 * never look alike. Variant 1: the ring above, the qualifiers in a row under it.
 */
export function verdict(c: Ctx): Used {
  begin(c);
  const said = c.item?.said;
  const v = said?.v ?? "";
  const { col } = c;
  const W = c.x1 - c.x0;
  const H = c.y1 - c.y0;
  const steps = (said?.s ?? []).slice(0, 3);
  const yes = YES.test(v);
  const no = NO.test(v);
  const color = yes ? col.ok : no ? col.accent : col.ai;
  const alt = !!c.item?.variant;
  const r = Math.min(c.R * 0.36, alt ? H * 0.15 : W * 0.15, 66);
  const ox = alt ? (c.x0 + c.x1) / 2 : X(r * 1.3 + 30);
  const oy = alt ? c.y1 - 40 - r * 1.3 : (c.y0 + c.y1) / 2 + 20;
  if (/^both$/i.test(v)) {
    orb(ox - r * 0.42, oy, r * 0.78, col.ai, true);
    orb(ox + r * 0.42, oy, r * 0.78, col.accent, true);
  } else {
    orb(ox, oy, r, color, true);
    const g = r * 0.42;
    if (yes) {
      ln(ox - g, oy + g * 0.05, ox - g * 0.25, oy - g * 0.7, color, 1, 2);
      ln(ox - g * 0.25, oy - g * 0.7, ox + g * 1.1, oy + g * 0.75, color, 1, 2);
    } else if (no) {
      ln(ox - g * 0.8, oy - g * 0.8, ox + g * 0.8, oy + g * 0.8, color, 1, 2);
      ln(ox - g * 0.8, oy + g * 0.8, ox + g * 0.8, oy - g * 0.8, color, 1, 2);
    } else ring(ox, oy, r * 0.62, color, 0.95, 2, 0, 0.5, 0, 0.6);
  }
  if (alt) lb(v, "big", ox, oy + r * 1.22 + 8, -0.5, -1, color);
  else lb(v, "big", ox, oy - r * 1.22 - 10, -0.5, 0, color);
  const n = steps.length;
  for (let k = 0; k < n; k++) {
    const s = steps[k];
    if (alt) {
      const sx = X(30 + ((W - 60) * (k + 0.5)) / n);
      const sy = oy - r * 1.22 - 64;
      for (let j = 0; j < 6; j++) {
        bez(ox, oy - r * 1.22, ox, sy + 30, sx, oy - r * 1.22 - 20, sx, sy + 10, j / 6);
        const ax = bz[0];
        const ay = bz[1];
        bez(ox, oy - r * 1.22, ox, sy + 30, sx, oy - r * 1.22 - 20, sx, sy + 10, (j + 1) / 6);
        ln(ax, ay, bz[0], bz[1], s.x ? col.accent : col.muted, 0.55, 1, 1);
      }
      node(sx, sy, color, 8, !!s.x);
      lb(s.t, "cap", sx, sy - 16, -0.5, 0, null, (W - 60) / n - 12);
    } else {
      const sx = X(r * 2.6 + 90);
      const sy = oy + (n === 1 ? 0 : (0.5 - k / (n - 1)) * Math.min(H * 0.5, 190));
      curve(ox + c.side * r * 1.22, oy, sx - c.side * 10, sy, s.x ? col.accent : col.muted, 0.6, 1, 1);
      node(sx, sy, color, 8, !!s.x);
      lb(s.t, "cap", sx + c.side * 16, sy, away(), -0.5, null, W - (r * 2.6 + 90) - 40);
    }
  }
  c.inX = ox - c.side * r * 1.22;
  c.inY = oy;
  return done();
}

// ---------------------------------------------------------------- list (an enumeration) and path (its sentences)

/**
 * A list the answer enumerates: its title on a glass hub, one node per item fanned out
 * (a "no" crossed). Variant 1 (or a tiered list): stacked glass layers.
 */
export function list(c: Ctx): Used {
  begin(c);
  const said = c.item?.said;
  const items = (said?.s ?? []).slice(0, 5);
  const { col } = c;
  const W = c.x1 - c.x0;
  const H = c.y1 - c.y0;
  const n = items.length;
  const cy = (c.y0 + c.y1) / 2;
  if (c.item?.variant) {
    const gap = Math.min(70, (H - 90) / Math.max(1, n));
    const yTop = cy + ((n - 1) * gap) / 2;
    lb(said?.h ?? "", "big", X(40), yTop + gap * 0.5 + 18, away(), -1, col.ai);
    ln(X(40), yTop + 16, X(40), yTop - (n - 1) * gap - 16, col.ai, 0.6, 1, 2, 0.3);
    for (let k = 0; k < n; k++) {
      const y = yTop - k * gap;
      const w = (W - 90) * (1 - 0.1 * k);
      const tone = items[k].x ? col.accent : col.ai;
      glass(X(54), y, X(54 + w), y, tone, gap * 0.62, 0.007);
      ln(X(54), y + gap * 0.31, X(54 + w), y + gap * 0.31, tone, 0.5, 1);
      node(X(40), y, col.ai, 7, !!items[k].x);
      lb(items[k].t, "cap", X(68), y, away(), -0.5, null, w - 30);
    }
    c.inX = X(40);
    c.inY = yTop;
    return done();
  }
  const hx = X(78);
  const rr = Math.min(W * 0.36, H * 0.36);
  orb(hx, cy, 30, col.ai, true);
  pt(hx, cy, 0, col.ai, 20, 1);
  if (said?.h) lb(said.h, "cap", hx, cy + 50, -0.5, -1, null, 180);
  for (let k = 0; k < n; k++) {
    const a = n === 1 ? 0 : (-0.5 + k / (n - 1)) * Math.PI * 0.62;
    const x = hx + c.side * rr * Math.cos(a);
    const y = cy - rr * Math.sin(a) * 1.1;
    const no = !!items[k].x;
    curve(hx + c.side * 30, cy, x - c.side * 10, y, no ? col.accent : col.ai, 0.6, 1, 2);
    node(x, y, no ? col.accent : col.ok, 9, no);
    lb(items[k].t, "cap", x + c.side * 18, y, away(), -0.5, null, Math.max(120, c.side > 0 ? c.x1 - x - 34 : x - c.x0 - 34));
  }
  c.inX = hx - c.side * 30;
  c.inY = cy;
  return done();
}

/**
 * The answer's sentences as a path, one glowing node per step (a "no" crossed), a pulse
 * travelling it. Variant 1: a horizontal line with the steps above and below it.
 */
export function path(c: Ctx): Used {
  begin(c);
  const said = c.item?.said;
  const steps = (said?.s ?? []).slice(0, 4);
  const { col } = c;
  const W = c.x1 - c.x0;
  const H = c.y1 - c.y0;
  const n = Math.max(1, steps.length);
  const cy = (c.y0 + c.y1) / 2;
  const alt = !!c.item?.variant;
  const zig = Math.min(W * 0.2, 110);
  const span = Math.min(H * 0.7, 120 * (n - 1));
  let lx = 0;
  let ly = 0;
  for (let k = 0; k < steps.length; k++) {
    const s = steps[k];
    const x = alt ? X(50 + ((W - 100) * k) / Math.max(1, n - 1)) : X(60 + (k % 2) * zig);
    const y = alt ? cy : cy + (n === 1 ? 0 : (0.5 - k / (n - 1)) * span);
    if (k > 0) {
      if (alt) ln(lx, ly, x, y, col.ai, 0.75, 1.4, 2, 0.4);
      else
        for (let j = 0; j < 6; j++) {
          bez(lx, ly, lx, (ly + y) / 2, x, (ly + y) / 2, x, y, j / 6);
          const ax = bz[0];
          const ay = bz[1];
          bez(lx, ly, lx, (ly + y) / 2, x, (ly + y) / 2, x, y, (j + 1) / 6);
          ln(ax, ay, bz[0], bz[1], col.ai, 0.75, 1.4, 1, 0.4);
        }
    }
    node(x, y, k === 0 ? col.accent : col.ai, 9, !!s.x);
    if (alt) lb(s.t, "cap", x, y + (k % 2 ? -18 : 18), -0.5, k % 2 ? 0 : -1, null, Math.min(200, (W - 40) / Math.max(1, n - 1) + 30));
    else lb(s.t, "cap", x + c.side * 18, y, away(), -0.5, null, W - 60 - zig - 50);
    lx = x;
    ly = y;
  }
  c.inX = X(50);
  c.inY = alt || n === 1 ? cy : cy + span / 2;
  return done();
}

// ---------------------------------------------------------------- data → strings (once)

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
/** "Sept 2021 - Dec 2022" → [start, end] as year * 12 + month (end null = present). */
function parsePeriod(period: string): [number | null, number | null] {
  const ms = [...period.matchAll(/([a-z]{3})[a-z]*\.?\s+(\d{4})/gi)].map((m) => {
    const mi = MONTHS.indexOf(m[1].toLowerCase());
    return mi < 0 ? null : Number(m[2]) * 12 + mi;
  });
  const years = [...period.matchAll(/\b(19|20)\d{2}\b/g)].map((m) => Number(m[0]) * 12);
  const start = ms[0] ?? years[0] ?? null;
  const end = /present|now|current/i.test(period) ? null : (ms[1] ?? years[1] ?? null);
  return [start, end];
}

const pad2 = (n: number) => String(n).padStart(2, "0");

export function prepare(data: NeuralData): Pre {
  const now = monthNow();
  const roles: Pre["roles"] = [];
  let cursor: number | null = null;
  // data.experience is oldest first (types.ts), so `cursor` is the previous, older role's end.
  for (const e of data.experience) {
    const [s, en] = parsePeriod(e.period);
    const start: number = s ?? cursor ?? now - e.months;
    const end: number = e.current ? now : (en ?? start + e.months);
    roles.push({ label: `${e.company} · ${yearsLabel(e.period)}`, role: e.role, start, end, current: e.current });
    cursor = end;
  }
  roles.sort((a, b) => a.start - b.start);
  const t0 = roles.length ? roles[0].start : now;
  const off = data.facts.utcOffsetMin;
  const sign = off < 0 ? "−" : "+";
  const abs = Math.abs(off);
  const utc = `UTC${sign}${Math.floor(abs / 60)}${abs % 60 ? `:${pad2(abs % 60)}` : ""}`;
  // Daylight at the city today: the sun's declination and the hour angle of sunrise.
  const [lat, lon] = CITY[data.facts.city.toLowerCase()] ?? [20, off / 4];
  const d = new Date();
  const doy = (Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 0)) / 864e5;
  const dec = (-23.44 * Math.cos((TAU / 365) * (doy + 10)) * Math.PI) / 180;
  const h0 = (Math.acos(Math.max(-1, Math.min(1, -Math.tan((lat * Math.PI) / 180) * Math.tan(dec)))) * 12) / Math.PI;
  const noon = 12 + off / 60 - lon / 15;
  return {
    roles,
    t0,
    yearsText: data.facts.years > 0 ? `${data.facts.years}+ years` : "",
    statement: data.facts.availability ? `Open to ${data.facts.availability}` : "",
    skillOrder: data.skills.map((s, i) => [s.uses, i] as const).sort((x, y) => y[0] - x[0] || x[1] - y[1]).map(([, i]) => i),
    clock: { text: "", minute: -1, utc },
    sun: [noon - h0, noon + h0],
    sel: [],
    selFor: null,
  };
}

/** Refresh the live clock label once a minute ("Ahmedabad · 14:32 · UTC+5:30"). */
export function tickClock(pre: Pre, data: NeuralData) {
  const off = data.facts.utcOffsetMin;
  const local = Math.floor((((Date.now() / 60000 + off) % 1440) + 1440) % 1440);
  if (local === pre.clock.minute) return;
  pre.clock.minute = local;
  pre.clock.text = `${data.facts.city || "Local"} · ${pad2(Math.floor(local / 60))}:${pad2(local % 60)} · ${pre.clock.utc}`;
}
