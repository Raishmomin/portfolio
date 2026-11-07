// The FAQ scene's visuals (lazy 3D chunk). Each one writes targets into the shared pools
// (gl.ts) around the visual's centre, in local CSS px (y up, z toward the camera), and
// declares its aria-hidden labels. Only real data: the career from data.experience and
// facts.years, the stack from data.skills/links (and the skills the answer names), the
// availability statement, live local time from facts.utcOffsetMin, and the figures quoted
// verbatim in the answer (server-extracted, components/ui/faq-meta.ts). Nothing allocates per
// frame: strings and colours are prepared when an item or the palette is set.
import type { Color } from "three";
import type { NeuralData } from "../../types";
import { yearsLabel } from "../experience/path";
import { arc, dashes, dot, seg, type FaqGL } from "./gl";

export type Kind = "field" | "career" | "stack" | "beacon" | "clock" | "figures" | "verdict" | "bloom";
export type Figure = { t: string; k: "money" | "time" | "percent" | "count"; lo: number; hi: number; plus?: 1; lt?: 1 };
export type LabelKind = "tag" | "chip" | "fig" | "big" | "note";

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
  id: string;
  topic: string;
  index: string;
  figures: Figure[];
  verdict: string | null;
  /** Indices into data.skills of the skills its answer names (most used first). */
  named: number[];
  kind: Kind;
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
  low: boolean;
  item: Item | null;
  /** +1: the rail is on the visual's left (content left of the window); -1: on its right. */
  side: number;
  /** First free slot per pool (visuals start here). */
  D: number;
  A: number;
  S: number;
  label: (text: string, kind: LabelKind, x: number, y: number, z: number, ax: number, ay: number, alpha: number, color?: Color) => void;
  /** Precomputed per-data strings. */
  pre: Pre;
};

/** Data-derived strings and layouts, prepared once per data/palette (no per-frame strings). */
export type Pre = {
  roles: { label: string; start: number; end: number; current: boolean }[];
  /** First role start, as a month count (year * 12 + month). */
  t0: number;
  yearsText: string;
  statement: string;
  skillOrder: number[];
  clock: { text: string; minute: number };
  ticks: { time: string[]; money: string[] };
};

export type Used = { d: number; a: number; s: number };

const TAU = Math.PI * 2;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

// ---------------------------------------------------------------- shared helpers

const rot = { x: 0, y: 0, z: 0 };
/** Rotates (x, y, z) by Euler XYZ (Rx·Ry·Rz, as the arc shader) into `rot`. */
function rotate(x: number, y: number, z: number, ex: number, ey: number, ez: number) {
  const cz = Math.cos(ez);
  const sz = Math.sin(ez);
  const x1 = cz * x - sz * y;
  const y1 = sz * x + cz * y;
  const cy = Math.cos(ey);
  const sy = Math.sin(ey);
  const x2 = cy * x1 + sy * z;
  const z2 = -sy * x1 + cy * z;
  const cx = Math.cos(ex);
  const sx = Math.sin(ex);
  rot.x = x2;
  rot.y = cx * y1 - sx * z2;
  rot.z = sx * y1 + cx * z2;
}

/** Point on a (rotated) circle at turn t from 12 o'clock clockwise → `rot` (+ centre). */
function onRing(cx: number, cy: number, cz: number, r: number, t: number, ex: number, ey: number, ez: number) {
  rotate(r * Math.sin(t * TAU), r * Math.cos(t * TAU), 0, ex, ey, ez);
  rot.x += cx;
  rot.y += cy;
  rot.z += cz;
}

/** Frame ring: the faint dial that every visual keeps around itself (slot A). */
function frame(c: Ctx, r: number, alpha: number) {
  arc(c.gl, c.A, c.vx, c.vy, -2, 0, 0, c.t * 0.02, r, 1, 0, 1, c.col.line, alpha, dashes(72, 0.3), 0, 0);
}

// ---------------------------------------------------------------- idle: the answer core

/** The answer core the question threads converge on (idle): a slow gyroscope. */
export function field(c: Ctx, cx: number, cy: number, hot: number): Used {
  const { gl, col, t, R } = c;
  frame(c, R * 1.02, 0.45);
  const g = R * 0.3 * (1 + 0.1 * hot);
  const hc = hot > 0 ? col.accent : col.ai;
  let d = c.D;
  // Three rings turning on their own axes, each carrying a spark.
  for (let k = 0; k < 3; k++) {
    const ex = k === 0 ? t * 0.42 : k === 1 ? 1.1 + t * 0.23 : -0.5;
    const ey = k === 0 ? t * 0.31 : k === 1 ? 0.6 : 1.3 + t * 0.37;
    const ez = k === 1 ? t * 0.4 : t * 0.2;
    const r = g * (1 - 0.2 * k);
    arc(gl, c.A + 1 + k, cx, cy, 0, ex, ey, ez, r, k === 0 ? 1.8 : 1.3, 0, 1, k === 1 ? col.fg : hc, k === 1 ? 0.45 : 0.75, 0, 0, 0.5);
    onRing(cx, cy, 0, r, (t * (0.18 + 0.07 * k) + k / 3) % 1, ex, ey, ez);
    dot(gl, d++, rot.x, rot.y, rot.z, k === 1 ? col.fg : hc, 11, 0.95);
  }
  // A slow dashed halo.
  arc(gl, c.A + 4, cx, cy, 0, 0, 0, -t * 0.08, g * 1.32, 1, 0, 1, col.muted, 0.4, dashes(36, 0.35), 0, 0);
  const pulse = 0.5 + 0.5 * Math.sin(t * 2.1);
  dot(gl, d++, cx, cy, 0, hc, 34 + 8 * pulse + 10 * hot, 0.95);
  return { d, a: c.A + 5, s: c.S };
}

// ---------------------------------------------------------------- career (experience)

const ROLE_MAX = 8;

export function career(c: Ctx): Used {
  const { gl, col, t, pre } = c;
  const roles = pre.roles;
  if (!roles.length) return bloom(c);
  const nr = Math.min(ROLE_MAX, roles.length);
  // The rings sit above a legend of the roles (one row each).
  const legend = nr * 27 + 14;
  const R = Math.min(c.R, (c.R * 2 + 30 - legend) / 2);
  const vx = c.vx;
  const vy = c.vy + legend / 2;
  arc(gl, c.A, vx, vy, -2, 0, 0, t * 0.02, R * 1.08, 1, 0, 1, col.line, 0.3, dashes(72, 0.3), 0, 0);
  const now = monthNow();
  const total = Math.max(1, now - pre.t0);
  const rings = Math.min(9, Math.max(1, Math.ceil(total / 12)));
  const r0 = R * 0.36;
  const step = (R * 0.94 - r0) / rings;
  const thick = Math.max(4, step * 0.3);
  const ex = -0.3;
  const ey = 0.18 * Math.sin(t * 0.22);
  let a = c.A + 1;
  let d = c.D;
  // One ring per year since the first role (month ticks); the outermost, partial, is this year.
  for (let k = 0; k < rings; k++) {
    arc(gl, a++, vx, vy, 0, ex, ey, 0, r0 + step * (k + 0.5), 1, 0, 1, col.muted, 0.4, dashes(12, 0.08), 0, 0);
  }
  // Each role lit along the months it covers (month m: ring m/12, turn (m%12)/12).
  const tint = TINT;
  tint[0] = col.fg;
  tint[1] = col.ai;
  tint[2] = col.accent;
  for (let i = 0; i < nr; i++) {
    const role = roles[i];
    const m0 = role.start - pre.t0;
    const m1 = Math.min(role.end, now) - pre.t0;
    const color = role.current ? col.ok : tint[i % 3];
    for (let k = Math.floor(m0 / 12); k < rings && k * 12 < m1; k++) {
      const s0 = Math.max(m0, k * 12) / 12 - k;
      const e0 = Math.min(m1, k * 12 + 12) / 12 - k;
      if (e0 - s0 < 0.004 || a >= gl.arcs.count - 2) continue;
      arc(gl, a++, vx, vy, 1, ex, ey, 0, r0 + step * (k + 0.5), thick, s0, e0, color, 0.95, 0, 0.2, 0.45);
    }
    // Where the role starts on its ring, and its row in the legend.
    const k0 = Math.floor(m0 / 12);
    onRing(vx, vy, 2, r0 + step * (k0 + 0.5), m0 / 12 - k0, ex, ey, 0);
    dot(gl, d++, rot.x, rot.y, rot.z, color, 14, 1);
    const ly = vy - R * 0.98 - 20 - i * 27;
    dot(gl, d++, vx - 8, ly, 0, color, 0, 0);
    c.label(role.label, "chip", vx, ly, 0, -0.5, -0.5, 1, color);
  }
  // Now: the head of the outermost ring, pulsing in the status colour.
  const kN = Math.min(rings - 1, Math.floor(total / 12));
  onRing(vx, vy, 3, r0 + step * (kN + 0.5), total / 12 - kN, ex, ey, 0);
  const p = (t * 0.6) % 1;
  dot(gl, d++, rot.x, rot.y, rot.z, col.ok, 22 + 5 * Math.sin(t * 3), 1);
  arc(gl, a++, rot.x, rot.y, rot.z, 0, 0, 0, 9 + 24 * p, 1.5, 0, 1, col.ok, 0.85 * (1 - p) * (1 - p), 0, 0, 0.4);
  // Centre: the years, inside the first ring.
  c.label(pre.yearsText, "big", vx, vy, 0, -0.5, -0.5, 1);
  return { d, a, s: c.S };
}

const TINT: Color[] = [];

/** Current month as year * 12 + month (0-based month). */
export function monthNow() {
  const n = new Date();
  return n.getFullYear() * 12 + n.getMonth();
}

// ---------------------------------------------------------------- stack (skills constellation)

const sel: number[] = [];
let selFor: Item | null = null;
let selLow = false;
let selData: NeuralData | null = null;
const px = new Float32Array(16);
const py = new Float32Array(16);
const pz = new Float32Array(16);

export function stack(c: Ctx, onlyNamed: boolean): Used {
  const { gl, col, t, R, vx, vy, data, item, low } = c;
  frame(c, R * 1.02, 0.3);
  const skills = data.skills;
  // Which skills: those the answer names, then (stack questions) the most used; most used
  // first: it sits at the centre, the next ones on the inner orbit, the rest outside.
  if (selFor !== item || selLow !== low || selData !== data) {
    selFor = item;
    selLow = low;
    selData = data;
    const max = low ? 8 : 10;
    sel.length = 0;
    for (const i of item?.named ?? []) if (sel.length < max) sel.push(i);
    if (!onlyNamed || sel.length < 2)
      for (const i of c.pre.skillOrder) {
        if (sel.length >= max) break;
        if (!sel.includes(i)) sel.push(i);
      }
    sel.sort((a, b) => skills[b].uses - skills[a].uses || a - b);
  }
  const n = sel.length;
  if (!n) return bloom(c);
  let maxUses = 1;
  for (const s of skills) maxUses = Math.max(maxUses, s.uses);
  const named = item?.named ?? [];
  let namedShown = 0;
  for (const i of sel) if (named.includes(i)) namedShown++;
  const highlight = namedShown > 0 && namedShown < n * 0.75;
  const ex = 1.0;
  const nIn = Math.min(4, n - 1);
  const nOut = n - 1 - nIn;
  const rIn = R * 0.46;
  const rOut = R * 0.86;
  let d = c.D;
  let a = c.A + 1;
  arc(gl, a++, vx, vy, -1, ex, 0, t * 0.05, rIn, 1, 0, 1, col.muted, 0.35, dashes(40, 0.4), 0, 0);
  if (nOut > 0) arc(gl, a++, vx, vy, -1, ex, 0, -t * 0.03, rOut, 1, 0, 1, col.muted, 0.3, dashes(64, 0.4), 0, 0);
  for (let k = 0; k < n; k++) {
    if (k === 0) {
      px[0] = vx;
      py[0] = vy;
      pz[0] = 0;
    } else if (k <= nIn) {
      onRing(vx, vy, 0, rIn, (k - 1) / nIn + 0.125 + t * 0.012, ex, 0, 0);
      px[k] = rot.x;
      py[k] = rot.y;
      pz[k] = rot.z;
    } else {
      onRing(vx, vy, 0, rOut, (k - 1 - nIn) / Math.max(1, nOut) + 0.06 - t * 0.008, ex, 0, 0);
      px[k] = rot.x;
      py[k] = rot.y;
      pz[k] = rot.z;
    }
  }
  for (let k = 0; k < n; k++) {
    const s = skills[sel[k]];
    const depth = k === 0 ? 1 : 0.55 + 0.45 * clamp01((pz[k] / (k <= nIn ? rIn : rOut) + 1) / 2);
    const color = c.col.layer[s.layer] ?? col.fg;
    const lit = highlight && named.includes(sel[k]);
    const u = Math.sqrt(s.uses / maxUses);
    dot(gl, d++, px[k], py[k], pz[k], color, (k === 0 ? 34 : 15 + 16 * u) * (0.8 + 0.2 * depth), depth);
    arc(gl, a++, px[k], py[k], pz[k], 0, 0, t * 0.5 + k, (k === 0 ? 24 : 12 + 8 * u) , lit ? 2 : 1.2, 0, 1, lit ? col.accent : color, (lit ? 1 : 0.55) * depth, lit ? 0 : dashes(6, 0.6), 0, 0.4);
    const right = k === 0 || px[k] >= vx;
    c.label(s.name, "chip", px[k], py[k], pz[k], k === 0 ? -0.5 : right ? 0 : -1, k === 0 ? -1.6 : -0.5, 0.35 + 0.65 * depth, lit ? col.accent : color);
  }
  // Real co-usage links between the shown skills (brighter = more shared projects).
  let sIdx = c.S;
  for (const l of data.links) {
    if (sIdx >= gl.segs.count) break;
    const ia = sel.indexOf(skillIndex(data, l.a));
    const ib = sel.indexOf(skillIndex(data, l.b));
    if (ia < 0 || ib < 0) continue;
    const w = Math.min(1, l.weight / 4);
    seg(gl, sIdx++, px[ia], py[ia], pz[ia], px[ib], py[ib], pz[ib], col.ai, 0.2 + 0.5 * w, 1 + 1.4 * w, 1, 0.3 + 0.2 * w);
  }
  return { d, a, s: sIdx };
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
  const { gl, col, t, R, vx, vy, item, pre } = c;
  frame(c, R * 1.02, 0.3);
  const bx = vx;
  const by = vy - R * 0.22;
  const ex = 1.22;
  let a = c.A + 1;
  let d = c.D;
  let s = c.S;
  // Ground: a dashed ring turning, a radar sweep and three pulses running out.
  arc(gl, a++, bx, by, 0, ex, 0, t * 0.15, R * 0.7, 1.6, 0, 1, col.ok, 0.55, dashes(54, 0.45), 0, 0.3);
  arc(gl, a++, bx, by, 0, ex, 0, 0, R * 0.31, R * 0.62, (t * 0.22) % 1, ((t * 0.22) % 1) + 0.16, col.ok, 0.32, 0, 1, 0);
  for (let j = 0; j < 3; j++) {
    const p = (t * 0.42 + j / 3) % 1;
    arc(gl, a++, bx, by, 0, ex, 0, 0, R * (0.08 + 0.62 * p), 2, 0, 1, col.ok, 0.85 * (1 - p) * (1 - p), 0, 0, 0.6);
  }
  // The status light and its beam.
  const pulse = 0.5 + 0.5 * Math.sin(t * 3.2);
  dot(gl, d++, bx, by, 2, col.ok, 46 + 10 * pulse, 1);
  arc(gl, a++, bx, by, 2, 0, 0, 0, 20 + 4 * pulse, 2, 0, 1, col.ok, 0.8, 0, 0, 0.6);
  seg(gl, s++, bx, by, 2, bx, by + R * 0.78, 2, col.ok, 0.75, 3, 3, 0.7);
  dot(gl, d++, bx, by + R * 0.78, 2, col.ok, 18, 0.9);
  if (item?.verdict) c.label(item.verdict, "big", bx, by + R * 0.78, 2, -0.5, -1, 1, col.ok);
  // Small-number figures as slots on an orbit: filled = the low end, open = up to the high end.
  let f: Figure | null = null;
  for (const x of item?.figures ?? []) if (!f && (x.k === "count" || x.k === "time") && x.hi <= 12 * (x.k === "time" ? 10080 : 1)) f = x;
  if (f) {
    const unit = f.k === "time" ? (f.hi >= 10080 ? 10080 : f.hi >= 1440 ? 1440 : 60) : 1;
    const hi = Math.max(1, Math.min(12, Math.round(f.hi / unit)));
    const lo = Math.max(1, Math.min(hi, Math.round(f.lo / unit)));
    for (let k = 0; k < hi; k++) {
      onRing(bx, by, 0, R * 0.46, k / hi + t * 0.05, ex, 0, 0);
      const filled = k < lo;
      dot(gl, d++, rot.x, rot.y, rot.z, filled ? col.ok : col.fg, filled ? 24 : 16, filled ? 1 : 0.5);
      arc(gl, a++, rot.x, rot.y, rot.z, 0, 0, 0, filled ? 13 : 10, 1.4, 0, 1, filled ? col.ok : col.muted, filled ? 0.8 : 0.5, filled ? 0 : dashes(8, 0.5), 0, 0.3);
    }
    c.label(f.t, "fig", bx + 14, by + R * 0.36, 0, 0, -0.5, 1, col.ok);
  }
  if (pre.statement) c.label(pre.statement, "note", bx, by - R * 0.36, 0, -0.5, 0, 1, col.ok);
  return { d, a, s };
}

// ---------------------------------------------------------------- clock (time zone)

/** City coordinates (degrees) for the marker; any other city falls back to its UTC offset. */
const CITY: Record<string, [number, number]> = { ahmedabad: [23.02, 72.57] };
const GLOBE_N = 64;
const fib = (() => {
  const out = new Float32Array(GLOBE_N * 2);
  for (let k = 0; k < GLOBE_N; k++) {
    out[k * 2] = Math.asin(1 - (2 * (k + 0.5)) / GLOBE_N);
    out[k * 2 + 1] = ((k * 2.39996) % TAU) - Math.PI;
  }
  return out;
})();

export function clock(c: Ctx): Used {
  const { gl, col, t, R, vx, vy, data, low, pre } = c;
  frame(c, R * 1.02, 0.25);
  const off = data.facts.utcOffsetMin;
  const [cLat, cLon] = CITY[data.facts.city.toLowerCase()] ?? [20, off / 4];
  const G = R * 0.5;
  const tilt = 0.32;
  const yaw = (-cLon * Math.PI) / 180 + 0.28 * Math.sin(t * 0.18);
  let a = c.A + 1;
  let d = c.D;
  // Graticule: parallels every 30°, meridians every 30°.
  for (let lat = -60; lat <= 60; lat += 30) {
    const p = (lat * Math.PI) / 180;
    rotate(0, G * Math.sin(p), 0, tilt, 0, 0);
    arc(gl, a++, vx + rot.x, vy + rot.y, rot.z, tilt - Math.PI / 2, 0, 0, G * Math.cos(p), lat === 0 ? 1.6 : 1, 0, 1, lat === 0 ? col.ai : col.muted, lat === 0 ? 0.6 : 0.3, 0, 0, 0);
  }
  for (let k = 0; k < 6; k++) {
    arc(gl, a++, vx, vy, 0, tilt, (k * Math.PI) / 6 + yaw + Math.PI / 2, 0, G, 1, 0, 1, col.muted, 0.28, 0, 0, 0);
  }
  // Day and night right now: the sun's position from the UTC clock and the date.
  const now = new Date();
  const utcH = now.getUTCHours() + now.getUTCMinutes() / 60;
  const doy = (Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - Date.UTC(now.getUTCFullYear(), 0, 0)) / 864e5;
  const sLon = ((12 - utcH) * 15 * Math.PI) / 180;
  const sLat = ((-23.44 * Math.cos((TAU / 365) * (doy + 10))) * Math.PI) / 180;
  const sx = Math.cos(sLat) * Math.sin(sLon);
  const sy = Math.sin(sLat);
  const sz = Math.cos(sLat) * Math.cos(sLon);
  const n = low ? 36 : GLOBE_N;
  for (let k = 0; k < n; k++) {
    const kk = low ? k * 2 : k;
    const la = fib[kk * 2];
    const lo = fib[kk * 2 + 1];
    const x = Math.cos(la) * Math.sin(lo);
    const y = Math.sin(la);
    const z = Math.cos(la) * Math.cos(lo);
    const day = x * sx + y * sy + z * sz > 0;
    rotate(Math.cos(la) * Math.sin(lo + yaw) * G, y * G, Math.cos(la) * Math.cos(lo + yaw) * G, tilt, 0, 0);
    const front = clamp01(rot.z / G + 0.35);
    dot(gl, d++, vx + rot.x, vy + rot.y, rot.z, day ? col.accent : col.ai, day ? 9 : 7, (day ? 0.85 : 0.5) * (0.15 + 0.85 * front));
  }
  // The city, pulsing.
  const la = (cLat * Math.PI) / 180;
  const lo = (cLon * Math.PI) / 180 + yaw;
  rotate(Math.cos(la) * Math.sin(lo) * G, Math.sin(la) * G, Math.cos(la) * Math.cos(lo) * G, tilt, 0, 0);
  const cx = vx + rot.x;
  const cy = vy + rot.y;
  const cz = rot.z;
  const p = (t * 0.7) % 1;
  dot(gl, d++, cx, cy, cz + 2, col.accent, 24, 1);
  arc(gl, a++, cx, cy, cz + 2, 0, 0, 0, 8 + 22 * p, 1.6, 0, 1, col.accent, 0.9 * (1 - p), 0, 0, 0.4);
  // The 24-hour dial: midnight at the top, the local day so far lit, the hand at the time.
  const local = (((now.getTime() / 60000 + off) % 1440) + 1440) % 1440;
  const f = local / 1440;
  const D = R * 0.84;
  arc(gl, a++, vx, vy, 0, 0, 0, 0, D, 1.2, 0, 1, col.fg, 0.5, dashes(24, 0.1), 0, 0);
  arc(gl, a++, vx, vy, 0, 0, 0, 0, D, 3, 0, f, col.accent, 0.85, 0, 0.7, 0.7);
  onRing(vx, vy, 0, D, f, 0, 0, 0);
  dot(gl, d++, rot.x, rot.y, rot.z, col.accent, 20, 1);
  seg(gl, c.S, rot.x, rot.y, rot.z, cx, cy, cz + 2, col.accent, 0.5, 1.2, 2, 0.6);
  // The time (live), above the dial; the hour marks inside it; a quoted span below it.
  c.label(pre.clock.text, "fig", vx, vy + D + 8, 0, -0.5, -1, 1, col.accent);
  const hours = pre.ticks.time;
  c.label(hours[0], "tag", vx, vy + D - 22, 0, -0.5, -0.5, 0.85);
  c.label(hours[1], "tag", vx + D - 26, vy, 0, -0.5, -0.5, 0.85);
  c.label(hours[2], "tag", vx, vy - D + 22, 0, -0.5, -0.5, 0.85);
  c.label(hours[3], "tag", vx - D + 26, vy, 0, -0.5, -0.5, 0.85);
  const figs = c.item?.figures ?? [];
  for (const fig of figs)
    if (fig.k === "time") {
      c.label(fig.t, "fig", vx, vy - D - 8, 0, -0.5, 0, 1, col.ai);
      break;
    }
  return { d, a, s: c.S + 1 };
}

// ---------------------------------------------------------------- figures (numbers quoted in the answer)

const YEAR_MIN = 525600;
/** Where a figure sits on its gauge (0..1). Fixed scales, so equal values match on every page. */
function scaleOf(f: Figure, v: number): number {
  if (f.k === "percent") return clamp01(v / 100);
  if (f.k === "time") return clamp01(Math.log10(Math.max(1, v)) / Math.log10(YEAR_MIN));
  if (f.k === "money") return clamp01((Math.log10(Math.max(1, v)) - 2) / 3);
  return clamp01(Math.log10(Math.max(1, v)) / 6);
}
/** Gauges are instruments: a 270° dial from 7:30, clockwise to 4:30 (open at the bottom). */
const G0 = 0.625;
const GS = 0.75;
const TIME_TICKS = [60, 1440, 10080, 43200];
const MONEY_TICKS = [1000, 10000];

export function figures(c: Ctx): Used {
  const { gl, col, t, R, vx, vy, item } = c;
  const figs = item?.figures ?? [];
  if (!figs.length) return verdict(c);
  frame(c, R * 1.02, 0.2);
  // A window left of its cards mirrors the dials (they run anticlockwise), so their ends,
  // where the labels sit, always face away from the rail.
  const ex = -0.22;
  const ey = 0.2 * Math.sin(t * 0.25) + (c.side < 0 ? Math.PI : 0);
  const n = figs.length;
  let a = c.A + 1;
  let d = c.D;
  for (let i = 0; i < n; i++) {
    const f = figs[i];
    const r = R * (0.9 - (n > 2 ? 0.17 : 0.2) * i);
    const color = f.k === "money" ? col.accent : f.k === "time" ? col.ai : f.k === "percent" ? col.ok : col.fg;
    const thick = Math.max(5, R * 0.042);
    // The dial: a thin track with fine ticks.
    arc(gl, a++, vx, vy, 0, ex, ey, 0, r, 1, G0, G0 + GS, col.muted, 0.38, 0, 0, 0);
    arc(gl, a++, vx, vy, 0, ex, ey, 0, r + thick * 0.5 + 4, 3, G0, G0 + GS, col.muted, 0.28, dashes(40, 0.06), 0, 0);
    let s0: number;
    let e0: number;
    if (f.k === "count" && f.hi <= 12) {
      // Small counts: the dial split into `hi` slots, the first `lo` lit.
      const slots = Math.max(1, Math.round(f.hi));
      s0 = 0;
      e0 = Math.max(1, Math.round(f.lo)) / slots;
      arc(gl, a++, vx, vy, 1, ex, ey, 0, r, thick, G0, G0 + GS * e0, color, 0.95, dashes(slots / GS, 0.9), 0, 0.5);
      if (e0 < 1) arc(gl, a++, vx, vy, 1, ex, ey, 0, r, thick * 0.6, G0 + GS * e0, G0 + GS, color, 0.35, dashes(slots / GS, 0.9), 0, 0);
    } else {
      s0 = f.lo !== f.hi ? scaleOf(f, f.lo) : 0;
      e0 = Math.max(scaleOf(f, f.hi), s0 + 0.012);
      if (s0 > 0) arc(gl, a++, vx, vy, 0.5, ex, ey, 0, r, 2, G0, G0 + GS * s0, color, 0.4, 0, 0, 0);
      arc(gl, a++, vx, vy, 1, ex, ey, 0, r, thick, G0 + GS * s0, G0 + GS * e0, color, 0.95, 0, f.lo !== f.hi ? 0 : 0.45, 0.5);
      if (f.plus) arc(gl, a++, vx, vy, 1, ex, ey, 0, r, 2, G0 + GS * e0, G0 + GS * Math.min(1, e0 + 0.12), color, 0.7, dashes(90, 0.5), 1, 0);
    }
    if (f.lo !== f.hi && f.k !== "count") {
      onRing(vx, vy, 2, r, G0 + GS * s0, ex, ey, 0);
      dot(gl, d++, rot.x, rot.y, rot.z, color, 12, 0.9);
    }
    onRing(vx, vy, 2, r, G0 + GS * e0, ex, ey, 0);
    dot(gl, d++, rot.x, rot.y, rot.z, color, 20 + 4 * Math.sin(t * 2.4 + i), 1);
    // One figure: it is the answer, in the centre; several: each names its dial at the
    // dial's end, on the side away from the rail (they stack with the dials).
    if (n === 1) c.label(f.t, "big", vx, vy, 0, -0.5, -0.5, 1, color);
    else {
      onRing(vx, vy, 2, r, G0 + GS, ex, ey, 0);
      c.label(f.t, "fig", rot.x, rot.y, rot.z, c.side > 0 ? 0 : -1, -0.5, 1, color);
    }
    // The scale, along the outermost dial.
    const ticks = f.k === "time" ? TIME_TICKS : f.k === "money" ? MONEY_TICKS : null;
    if (ticks && i === 0) {
      const names = f.k === "time" ? c.pre.ticks.time : c.pre.ticks.money;
      for (let j = 0; j < ticks.length; j++) {
        const u = G0 + GS * scaleOf(f, ticks[j]);
        onRing(vx, vy, 1, r + thick + 12, u, ex, ey, 0);
        dot(gl, d++, rot.x, rot.y, rot.z, col.muted, 6, 0.8);
        onRing(vx, vy, 1, r + thick + 24, u, ex, ey, 0);
        c.label(names[(f.k === "time" ? 4 : 0) + j], "tag", rot.x, rot.y, rot.z, -0.5, -0.5, 0.8);
      }
    }
  }
  // Centre: the answer's verdict when it opens with one.
  if (item?.verdict) c.label(item.verdict, n === 1 ? "tag" : "big", vx, vy + (n === 1 ? 30 : 0), 0, -0.5, -0.5, n === 1 ? 0.9 : 1);
  return { d, a, s: c.S };
}

// ---------------------------------------------------------------- verdict ("Yes", "Both", ...)

const YES = /^(yes|often|usually|almost always yes)$/i;
const NO = /^(no|probably not|not usually)$/i;

export function verdict(c: Ctx): Used {
  const { gl, col, t, R, vx, vy, item } = c;
  const v = item?.verdict;
  if (!v) return bloom(c);
  frame(c, R * 1.02, 0.3);
  let a = c.A + 1;
  let d = c.D;
  let s = c.S;
  const r = R * 0.5;
  const ey = 0.3 * Math.sin(t * 0.3);
  if (/^both$/i.test(v)) {
    // Two overlapping circles: both.
    arc(gl, a++, vx - r * 0.42, vy, 0, 0, ey, 0, r * 0.78, 3, 0, 1, col.ai, 0.9, 0, 0, 0.8);
    arc(gl, a++, vx + r * 0.42, vy, 0, 0, ey, 0, r * 0.78, 3, 0, 1, col.accent, 0.9, 0, 0, 0.8);
    dot(gl, d++, vx - r * 0.42, vy, 0, col.ai, 22, 0.9);
    dot(gl, d++, vx + r * 0.42, vy, 0, col.accent, 22, 0.9);
  } else {
    const yes = YES.test(v);
    const no = NO.test(v);
    const color = yes ? col.ok : no ? col.accent : col.ai;
    arc(gl, a++, vx, vy, 0, 0, ey, 0, r, 3, 0, 1, color, 0.9, 0, 0, 0.8);
    arc(gl, a++, vx, vy, 0, 0, ey, t * 0.3, r * 1.18, 1, 0, 1, color, 0.4, dashes(36, 0.4), 0, 0);
    if (yes) {
      seg(gl, s++, vx - r * 0.42, vy + r * 0.02, 1, vx - r * 0.1, vy - r * 0.3, 1, color, 1, 7);
      seg(gl, s++, vx - r * 0.1, vy - r * 0.3, 1, vx + r * 0.46, vy + r * 0.34, 1, color, 1, 7);
    } else if (no) {
      seg(gl, s++, vx - r * 0.34, vy - r * 0.34, 1, vx + r * 0.34, vy + r * 0.34, 1, color, 1, 6);
      seg(gl, s++, vx - r * 0.34, vy + r * 0.34, 1, vx + r * 0.34, vy - r * 0.34, 1, color, 1, 6);
    } else {
      // Neither: half lit.
      arc(gl, a++, vx, vy, 1, 0, ey, 0, r * 0.62, 6, 0, 0.5, color, 0.95, 0, 0, 0.6);
    }
  }
  for (let k = 0; k < 6; k++) {
    onRing(vx, vy, 0, R * 0.82, k / 6 + t * 0.04, 1.2, 0, 0);
    dot(gl, d++, rot.x, rot.y, rot.z, col.muted, 7, 0.55);
  }
  c.label(v, "big", vx, vy - r - 14, 0, -0.5, 0, 1);
  return { d, a, s };
}

// ---------------------------------------------------------------- bloom (no data to draw)

/** An answer without figures, named skills or a verdict: the question node blooms open. */
export function bloom(c: Ctx): Used {
  const { gl, col, t, R, vx, vy } = c;
  frame(c, R * 1.02, 0.3);
  let a = c.A + 1;
  let d = c.D;
  let s = c.S;
  for (let j = 0; j < 3; j++) {
    const p = (t * 0.25 + j / 3) % 1;
    arc(gl, a++, vx, vy, 0, 0.9, t * 0.2 + j, 0, R * (0.2 + 0.6 * p), 1.5, 0, 1, col.ai, 0.7 * Math.sin(p * Math.PI), 0, 0, 0.5);
  }
  for (let k = 0; k < 8; k++) {
    const ang = (k / 8) * TAU + t * 0.1;
    const x = vx + Math.cos(ang) * R * 0.62;
    const y = vy + Math.sin(ang) * R * 0.62;
    seg(gl, s++, vx, vy, 0, x, y, 0, col.ai, 0.35, 1.2, 1, 0.5);
    dot(gl, d++, x, y, 0, col.ai, 10, 0.7);
  }
  dot(gl, d++, vx, vy, 0, col.accent, 32 + 6 * Math.sin(t * 2), 1);
  return { d, a, s };
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
  for (const e of data.experience) {
    const [s, en] = parsePeriod(e.period);
    const start: number = s ?? cursor ?? now - e.months;
    const end: number = e.current ? now : (en ?? start + e.months);
    roles.push({ label: `${e.company} · ${yearsLabel(e.period)}`, start, end, current: e.current });
    cursor = end;
  }
  const t0 = roles.length ? Math.min(...roles.map((r) => r.start)) : now;
  const off = data.facts.utcOffsetMin;
  const sign = off < 0 ? "−" : "+";
  const abs = Math.abs(off);
  const utc = `UTC${sign}${Math.floor(abs / 60)}${abs % 60 ? `:${pad2(abs % 60)}` : ""}`;
  return {
    roles,
    t0,
    yearsText: data.facts.years > 0 ? `${data.facts.years}+ years` : "",
    statement: data.facts.availability ? `Open to ${data.facts.availability}` : "",
    skillOrder: data.skills.map((s, i) => [s.uses, i] as const).sort((x, y) => y[0] - x[0] || x[1] - y[1]).map(([, i]) => i),
    clock: { text: "", minute: -1, utc } as Pre["clock"] & { utc: string },
    ticks: { time: ["00:00", "06:00", "12:00", "18:00", "1 hour", "1 day", "1 week", "1 month"], money: ["$1k", "$10k"] },
  };
}

/** Refresh the live clock label once a minute ("Ahmedabad · 14:32 · UTC+5:30"). */
export function tickClock(pre: Pre, data: NeuralData) {
  const off = data.facts.utcOffsetMin;
  const local = Math.floor((((Date.now() / 60000 + off) % 1440) + 1440) % 1440);
  if (local === pre.clock.minute) return;
  pre.clock.minute = local;
  const utc = (pre.clock as Pre["clock"] & { utc: string }).utc;
  pre.clock.text = `${data.facts.city || "Local"} · ${pad2(Math.floor(local / 60))}:${pad2(local % 60)} · ${utc}`;
}
