// The services scene's four machines, one per engagement in NeuralData.services (matched by
// slug; an unknown service gets a plain hub of its own technologies). Each machine is a
// static blueprint (glass panels, solids, links, sprites, label anchors) plus a program
// that animates it every frame (packets, filling blocks, containers in flight, a token
// bucket). Coordinates are layout units: x right, y up, z toward the viewer, the machine
// inside about x ±4, y ±2.6. Labels are the service's real technology names, exactly as
// the DOM lists them; a name the data does not have is simply not drawn.
import type { NeuralData } from "../../types";

/** Palette slots: fg, accent (orange), ok (green), muted, ai (blue). */
export const T = { fg: 0, accent: 1, ok: 2, muted: 3, ai: 4 } as const;
export type Tint = (typeof T)[keyof typeof T];

/** Slab styles: glass panel, content block (fills left to right), browser window. */
export const SLAB = { glass: 0, block: 1, window: 2 } as const;
/** Sprite kinds. */
export const SPRITE = { orb: 0, ring: 1, packet: 2, dot: 3 } as const;
/** Link kinds: plain, flow (comets along it), dashed, two lanes (requests / responses). */
export const LINK = { plain: 0, flow: 1, dash: 2, lanes: 3 } as const;

export type SlabDef = { x: number; y: number; z: number; w: number; h: number; tint: Tint; style: number; flat: number; fill: number };
export type SolidDef = { x: number; y: number; z: number; sx: number; sy: number; sz: number; tint: Tint; rx: number; ry: number; sides: number };
export type SpriteDef = { x: number; y: number; z: number; size: number; tint: Tint; kind: number };
export type LinkDef = {
  ax: number;
  ay: number;
  az: number;
  bx: number;
  by: number;
  bz: number;
  w: number;
  tint: Tint;
  kind: number;
  speed: number;
  seed: number;
  alpha: number;
};
export type Side = "l" | "r" | "t" | "b";
export type LabelDef = { text: string; x: number; y: number; z: number; side: Side };

/** What a program may write each frame (no allocation: preallocated by the rig). */
export interface Live {
  /** Seconds since this machine was built; programs start once it has assembled. */
  t: number;
  dt: number;
  low: boolean;
  /** Override a static slab's fill (0..1). */
  fill(i: number, v: number): void;
  /** Light up a static solid (boxes: kind 0, cylinders: kind 1) or sprite (kind 2), 0..1 (max of the frame's calls). */
  glow(kind: 0 | 1 | 2, i: number, v: number): void;
  /** Move a static link's ends (live graphs). */
  line(i: number, ax: number, ay: number, az: number, bx: number, by: number, bz: number): void;
  /** Emit a moving packet (a sprite with a short trail of `trail` ghosts along dx/dy/dz). */
  packet(x: number, y: number, z: number, size: number, tint: Tint, alpha: number, tx?: number, ty?: number, tz?: number): void;
  /** Emit a moving solid box. */
  box(x: number, y: number, z: number, size: number, tint: Tint, alpha: number, glow: number, ry: number): void;
}

export type Design = {
  slug: string;
  slabs: SlabDef[];
  boxes: SolidDef[];
  cyls: SolidDef[];
  sprites: SpriteDef[];
  links: LinkDef[];
  labels: LabelDef[];
  /** Anchor of the machine's title label. */
  title: [number, number, number];
  /** Half extents of the machine (layout units), for fitting it into its frame. */
  hw: number;
  hh: number;
  animate(live: Live): void;
};

// ---------- helpers ----------

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (v: number) => {
  const t = clamp01(v);
  return t * t * (3 - 2 * t);
};
const easeInOut = (v: number) => {
  const t = clamp01(v);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

/** A polyline the programs move things along (arc-length parametrised, no allocation). */
export class Path {
  readonly p: Float32Array;
  readonly cum: Float32Array;
  readonly n: number;
  readonly total: number;
  constructor(points: number[][]) {
    this.n = points.length;
    this.p = new Float32Array(points.flat());
    this.cum = new Float32Array(this.n);
    let sum = 0;
    for (let i = 1; i < this.n; i++) {
      const o = i * 3;
      sum += Math.hypot(this.p[o] - this.p[o - 3], this.p[o + 1] - this.p[o - 2], this.p[o + 2] - this.p[o - 1]);
      this.cum[i] = sum;
    }
    this.total = sum;
  }
  /** Point at fraction u (0..1) of the length into out[0..2]. */
  at(u: number, out: Float32Array | number[]) {
    const s = clamp01(u) * this.total;
    let i = 1;
    while (i < this.n - 1 && this.cum[i] < s) i++;
    const s0 = this.cum[i - 1];
    const seg = this.cum[i] - s0 || 1;
    const k = (s - s0) / seg;
    const o = i * 3;
    out[0] = this.p[o - 3] + (this.p[o] - this.p[o - 3]) * k;
    out[1] = this.p[o - 2] + (this.p[o + 1] - this.p[o - 2]) * k;
    out[2] = this.p[o - 1] + (this.p[o + 2] - this.p[o - 1]) * k;
    return out;
  }
}

/** Blueprint authoring: every add returns its index (programs address static parts by it). */
class Builder {
  readonly slabs: SlabDef[] = [];
  readonly boxes: SolidDef[] = [];
  readonly cyls: SolidDef[] = [];
  readonly sprites: SpriteDef[] = [];
  readonly links: LinkDef[] = [];
  readonly labels: LabelDef[] = [];
  constructor(private readonly tech: string[]) {}

  slab(x: number, y: number, z: number, w: number, h: number, tint: Tint, style: number = SLAB.glass, fill = 1, flat = 0) {
    return this.slabs.push({ x, y, z, w, h, tint, style, flat, fill }) - 1;
  }
  box(x: number, y: number, z: number, sx: number, sy: number, sz: number, tint: Tint, ry = 0) {
    return this.boxes.push({ x, y, z, sx, sy, sz, tint, rx: 0, ry, sides: 0 }) - 1;
  }
  /** A disc (axis up) of radius r and height h. */
  disc(x: number, y: number, z: number, r: number, h: number, tint: Tint) {
    return this.cyls.push({ x, y, z, sx: r * 2, sy: h, sz: r * 2, tint, rx: 0, ry: 0, sides: 0 }) - 1;
  }
  /** A hexagonal prism facing the viewer (axis toward +z), corner radius r, depth h. */
  hex(x: number, y: number, z: number, r: number, h: number, tint: Tint) {
    return this.cyls.push({ x, y, z, sx: r * 2, sy: h, sz: r * 2, tint, rx: Math.PI / 2, ry: 0, sides: 6 }) - 1;
  }
  sprite(x: number, y: number, z: number, size: number, tint: Tint, kind: number = SPRITE.orb) {
    return this.sprites.push({ x, y, z, size, tint, kind }) - 1;
  }
  link(a: number[], b: number[], w: number, tint: Tint, kind: number = LINK.plain, speed = 0.8, seed = 0, alpha = 1) {
    return (
      this.links.push({ ax: a[0], ay: a[1], az: a[2] ?? 0, bx: b[0], by: b[1], bz: b[2] ?? 0, w, tint, kind, speed, seed, alpha }) - 1
    );
  }
  /** A polyline of links; flow comets run continuously across its segments. */
  path(points: number[][], w: number, tint: Tint | ((i: number) => Tint), kind: number = LINK.flow, speed = 0.8, alpha = 1) {
    let s = 0;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      this.link(a, b, w, typeof tint === "function" ? tint(i - 1) : tint, kind, speed, s, alpha);
      s += Math.hypot(b[0] - a[0], b[1] - a[1], (b[2] ?? 0) - (a[2] ?? 0));
    }
  }
  /** The 12 edges of a box (infrastructure outlines). */
  wire(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, tint: Tint, w = 0.024) {
    const c = [
      [x0, y0, z0],
      [x1, y0, z0],
      [x1, y1, z0],
      [x0, y1, z0],
      [x0, y0, z1],
      [x1, y0, z1],
      [x1, y1, z1],
      [x0, y1, z1],
    ];
    const e = [0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7];
    for (let i = 0; i < e.length; i += 2) this.link(c[e[i]], c[e[i + 1]], w, tint, LINK.dash, 1, i * 0.37, 0.85);
  }
  /** A label naming the service's technology that matches `re` (skipped when it has none). */
  label(re: RegExp, x: number, y: number, z: number, side: Side) {
    const text = this.tech.find((t) => re.test(t));
    if (text) this.labels.push({ text, x, y, z, side });
  }
}

/** Points on an ellipse (rotated by rot), with a little depth so it reads as an orbit. */
function ellipse(cx: number, cy: number, rx: number, ry: number, rot: number, segs: number, depth: number) {
  const pts: number[][] = [];
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const x = Math.cos(a) * rx;
    const y = Math.sin(a) * ry;
    pts.push([cx + x * c - y * s, cy + x * s + y * c, Math.sin(a) * depth]);
  }
  return pts;
}

const tmp = new Float32Array(3);
const tmp2 = new Float32Array(3);

// ---------- 1. Next.js: an App Router route tree streams server components into a page ----------

function nextjs(slug: string, tech: string[]): Design {
  const b = new Builder(tech);
  // app/ directory panel behind the route tree.
  b.slab(-2.5, -0.05, -0.4, 2.9, 3.8, T.muted);
  const X0 = -3.5;
  const root = [X0, 1.35, 0];
  const A = [-2.5, 0.5, 0];
  const B = [-2.5, -0.38, 0];
  const B1 = [-1.5, -0.38, 0];
  const C = [-2.5, -1.25, 0];
  // Tree: trunk and branches (file-tree elbows); data comets run down from the root.
  b.path(
    [
      root,
      [X0, 0.5, 0],
      [X0, -0.38, 0],
      [X0, -1.25, 0],
    ],
    0.05,
    T.fg,
    LINK.flow,
    0.7,
  );
  b.link([X0, 0.5, 0], A, 0.05, T.fg, LINK.flow, 0.7, 0.85);
  b.link([X0, -0.38, 0], B, 0.05, T.fg, LINK.flow, 0.7, 1.73);
  b.link(B, B1, 0.05, T.fg, LINK.flow, 0.7, 2.73);
  b.link([X0, -1.25, 0], C, 0.05, T.fg, LINK.flow, 0.7, 2.6);
  // Database under the tree, feeding it.
  const db = [-3.5, -2.2, 0.1];
  for (let k = 0; k < 3; k++) b.disc(db[0], db[1] + 0.27 - k * 0.27, db[2], 0.4, 0.18, T.ok);
  b.link([X0, -1.82, 0], [X0, -1.25, 0], 0.06, T.ok, LINK.flow, -0.8, 0);
  // Nodes: the root layout, route segments, and the server-component pages (orange).
  b.sprite(root[0], root[1], 0.05, 0.62, T.accent, SPRITE.orb);
  b.sprite(root[0], root[1], 0.05, 1.05, T.accent, SPRITE.ring);
  for (const p of [[X0, 0.5], [X0, -0.38], [X0, -1.25]]) b.sprite(p[0], p[1], 0.04, 0.14, T.fg, SPRITE.dot);
  const leafA = b.sprite(A[0], A[1], 0.05, 0.44, T.accent, SPRITE.orb);
  b.sprite(B[0], B[1], 0.05, 0.34, T.fg, SPRITE.orb);
  const leafB = b.sprite(B1[0], B1[1], 0.05, 0.44, T.accent, SPRITE.orb);
  const leafC = b.sprite(C[0], C[1], 0.05, 0.44, T.accent, SPRITE.orb);
  b.sprite(C[0], C[1], 0.05, 0.78, T.ai, SPRITE.ring); // an authenticated route

  // The browser window the page streams into.
  const WX = 1.55;
  const L = -0.52;
  b.slab(WX, 0.2, 0.15, 4.1, 3.7, T.fg, SLAB.window);
  b.sprite(-0.27, 1.88, 0.2, 0.13, T.accent, SPRITE.dot);
  b.sprite(-0.09, 1.88, 0.2, 0.13, T.muted, SPRITE.dot);
  b.sprite(0.09, 1.88, 0.2, 0.13, T.ok, SPRITE.dot);
  b.slab(1.85, 1.88, 0.2, 2.2, 0.16, T.muted, SLAB.block, 1);
  const nav = b.slab(WX, 1.36, 0.22, 3.7, 0.26, T.fg, SLAB.block, 0);
  const hero = b.slab(0.66, 0.6, 0.22, 1.9, 0.98, T.accent, SLAB.block, 0);
  const lines = [b.slab(2.6, 0.9, 0.22, 1.55, 0.18, T.fg, SLAB.block, 0), b.slab(2.43, 0.6, 0.22, 1.2, 0.13, T.muted, SLAB.block, 0), b.slab(2.53, 0.33, 0.22, 1.4, 0.13, T.muted, SLAB.block, 0)];
  const cards = [0.1, 1.55, 3.0].map((x) => b.slab(x, -0.5, 0.22, 1.24, 0.95, T.ai, SLAB.block, 0));
  const footer = b.slab(WX, -1.33, 0.22, 3.7, 0.2, T.muted, SLAB.block, 0);

  // Streams: each server component sends its part of the page.
  const streams = [
    new Path([[root[0] + 0.3, root[1], 0.05], [L, 1.36, 0.22]]),
    new Path([[A[0] + 0.22, A[1], 0.05], [L, 0.6, 0.22]]),
    new Path([[B1[0] + 0.22, B1[1], 0.05], [L, -0.45, 0.22]]),
    new Path([[C[0] + 0.22, C[1], 0.05], [L, -1.33, 0.22]]),
  ];
  for (const s of streams) b.link([s.p[0], s.p[1], s.p[2]], [s.p[3], s.p[4], s.p[5]], 0.035, T.accent, LINK.plain, 0, 0, 0.45);

  b.label(/^Next\.js/, root[0], root[1] + 0.42, 0, "t");
  b.label(/Server Components/, B1[0] + 0.1, B1[1] + 0.3, 0, "t");
  b.label(/NextAuth|Clerk/, C[0], C[1] - 0.4, 0, "b");
  b.label(/Mongo|Postgres|Prisma|Drizzle/, -3.05, db[1], 0.1, "r");
  b.label(/Tailwind|shadcn/, 3.55, 2.05, 0.15, "t");

  const P = 6.6;
  // [stream, depart, travel] and the blocks each one fills.
  const plan: [number, number, number, number[]][] = [
    [0, 0.15, 0.6, [nav]],
    [1, 0.55, 0.7, [hero, ...lines]],
    [2, 1.05, 0.6, cards],
    [3, 1.6, 0.6, [footer]],
  ];
  const leaves = [-1, leafA, leafB, leafC];
  return {
    slug,
    ...b,
    title: [0, 2.55, 0],
    hw: 4.25,
    hh: 2.95,
    animate(live) {
      const t = live.t % P;
      const reset = smooth((t - 5.7) / 0.6);
      for (let si = 0; si < plan.length; si++) {
        const [, dep, travel, blocks] = plan[si];
        const u = (t - dep) / travel;
        if (u > 0 && u < 1) {
          streams[si].at(easeInOut(u), tmp);
          live.packet(tmp[0], tmp[1], tmp[2] + 0.05, 0.3, T.accent, 1, -0.16, 0, 0);
        }
        if (leaves[si] >= 0) live.glow(2, leaves[si], u > -0.25 && u < 0.2 ? 1 - Math.abs(u + 0.02) * 4 : 0);
        const arrive = dep + travel;
        for (let k = 0; k < blocks.length; k++) live.fill(blocks[k], smooth((t - arrive - k * 0.16) / 0.38) * (1 - reset));
      }
    },
  };
}

/** How lit a module at loop fraction u0 is by the n packets going round (0..1). */
function pass(t: number, n: number, u0: number) {
  let g = 0;
  for (let i = 0; i < n; i++) {
    const d = Math.abs(((((t * 0.085 + i / n - u0) % 1) + 1.5) % 1) - 0.5);
    g = Math.max(g, 1 - d * 16);
  }
  return clamp01(g);
}

// ---------- 2. MERN: MongoDB, Express, React and Node pass data round one loop ----------

function mern(slug: string, tech: string[], low: boolean): Design {
  const b = new Builder(tech);
  const R = [-2.45, 1.05, 0];
  const E = [2.45, 1.05, 0];
  const N = [2.45, -1.3, 0];
  const M = [-2.45, -1.3, 0];
  // React: an atom (nucleus + three orbits).
  const segs = low ? 12 : 20;
  const orbits = [0, Math.PI / 3, (2 * Math.PI) / 3].map((rot) => ellipse(R[0], R[1], 1.05, 0.38, rot, segs, 0.3));
  for (const o of orbits) b.path(o, 0.032, T.ai, LINK.plain);
  const nucleus = b.sprite(R[0], R[1], 0.1, 0.5, T.ai, SPRITE.orb);
  // Express: a two-unit server rack with status lights.
  const rack = [b.box(E[0], E[1] + 0.27, 0, 1.6, 0.42, 0.9, T.fg), b.box(E[0], E[1] - 0.24, 0, 1.6, 0.42, 0.9, T.fg)];
  const leds = [0, 1].flatMap((k) => [0, 1, 2].map((j) => b.sprite(E[0] - 0.62 + j * 0.16, E[1] + 0.27 - k * 0.51, 0.47, 0.1, T.ok, SPRITE.dot)));
  // Node.js: a hexagon.
  const hexId = b.hex(N[0], N[1], 0, 0.72, 0.36, T.accent);
  b.sprite(N[0], N[1], 0.3, 0.55, T.accent, SPRITE.ring);
  // MongoDB: a database (three discs).
  const discs = [0, 1, 2].map((k) => b.disc(M[0], M[1] + 0.3 - k * 0.3, 0, 0.62, 0.22, T.ok));
  // The loop: requests (orange) clockwise across the top and down, data (green) back.
  const loop = [
    [R[0] + 1.15, R[1], 0],
    [E[0] - 0.9, E[1], 0],
  ];
  b.link(loop[0], loop[1], 0.07, T.accent, LINK.flow, 0.9, 0);
  b.link([E[0], E[1] - 0.55, 0], [N[0], N[1] + 0.8, 0], 0.07, T.accent, LINK.flow, 0.9, 0.4);
  b.link([N[0] - 0.8, N[1], 0], [M[0] + 0.72, M[1], 0], 0.07, T.ok, LINK.flow, 0.9, 0.2);
  b.link([M[0], M[1] + 0.55, 0], [R[0], R[1] - 0.48, 0], 0.07, T.ok, LINK.flow, 0.9, 0.6);
  // Socket.IO: a live two-way channel between the browser and the server.
  b.link([R[0] + 0.62, R[1] - 0.42, 0.05], [N[0] - 0.66, N[1] + 0.46, 0.05], 0.1, T.muted, LINK.lanes, 2.2, 0.1);
  // Docker around the server side.
  b.wire(1.35, -2.18, -0.75, 3.55, 1.72, 0.75, T.muted);

  b.label(/React/, R[0], R[1] + 0.98, 0, "t");
  b.label(/Express|Fastify/, E[0], E[1] + 0.52, 0.45, "t");
  b.label(/^Node/, N[0] - 0.85, N[1] - 0.45, 0, "l");
  b.label(/Mongo/, M[0], M[1] - 0.5, 0, "b");
  b.label(/Socket/, 0, -0.18, 0.05, "t");
  b.label(/^Docker/, 3.55, -2.18, 0.75, "b");

  const ring = new Path([R, E, N, M, R].map((p) => [p[0], p[1], 0.12]));
  const orbitPaths = orbits.map((o) => new Path(o));
  return {
    slug,
    ...b,
    title: [0, 2.55, 0],
    hw: 4.0,
    hh: 2.95,
    animate(live) {
      const t = live.t;
      // Electrons.
      for (let k = 0; k < orbitPaths.length; k++) {
        orbitPaths[k].at((t * 0.42 + k / 3) % 1, tmp);
        live.packet(tmp[0], tmp[1], tmp[2] + 0.08, 0.2, T.ai, 1);
      }
      // Packets round the loop: orange on the way in, green on the way back.
      const n = live.low ? 4 : 7;
      for (let i = 0; i < n; i++) {
        const u = (t * 0.085 + i / n) % 1;
        ring.at(u, tmp);
        ring.at(u - 0.012, tmp2);
        live.packet(tmp[0], tmp[1], tmp[2], 0.26, u < 0.5 ? T.accent : T.ok, 1, tmp2[0] - tmp[0], tmp2[1] - tmp[1], 0);
      }
      // A module lights up as packets pass through it.
      live.glow(2, nucleus, pass(t, n, 0));
      for (let k = 0; k < rack.length; k++) live.glow(0, rack[k], pass(t, n, 0.25) * 0.8);
      live.glow(1, hexId, pass(t, n, 0.5));
      for (let k = 0; k < discs.length; k++) live.glow(1, discs[k], pass(t, n, 0.75) * 0.8);
      for (let k = 0; k < leds.length; k++) live.glow(2, leds[k], Math.sin(t * 7 + k * 2.1) > 0.2 ? 1 : 0);
    },
  };
}

/** The monitoring graph's value at point k (a slow, smooth, made-up signal; no numbers shown). */
const graphY = (k: number, t: number, base: number) => base - 0.25 + 0.38 * (0.5 + 0.5 * Math.sin((k + t * 1.6) * 0.9) * Math.cos((k + t) * 0.37));

// ---------- 3. DevOps & AWS: a CI/CD loop builds containers and ships them to a cluster ----------

function devops(slug: string, tech: string[], low: boolean): Design {
  const b = new Builder(tech);
  const CX = -1.95;
  const CY = 0.35;
  const A = 1.72;
  const lem = (t: number) => {
    const s = Math.sin(t);
    const c = Math.cos(t);
    const d = 1 + s * s;
    return [CX + (A * c) / d, CY + (A * s * c * 1.45) / d, Math.sin(t) * 0.25];
  };
  const segs = low ? 28 : 44;
  const loop: number[][] = [];
  for (let i = 0; i <= segs; i++) loop.push(lem((i / segs) * Math.PI * 2));
  // Dev side (left lobe) blue, ops side (right lobe) green.
  b.path(loop, 0.08, (i) => (Math.cos(((i + 0.5) / segs) * Math.PI * 2) < 0 ? T.ai : T.ok), LINK.flow, 0.85);
  for (let k = 0; k < 6; k++) {
    const p = lem((k * Math.PI) / 3);
    b.sprite(p[0], p[1], p[2], 0.42, Math.cos((k * Math.PI) / 3) < -0.01 ? T.ai : T.ok, SPRITE.ring);
  }
  const buildAt = lem(Math.PI);
  const build = b.sprite(buildAt[0], buildAt[1], buildAt[2] + 0.02, 0.4, T.ai, SPRITE.orb);

  // The cluster: a floor with 3 × 3 pods, inside an infrastructure-as-code outline.
  const FY = -1.2;
  b.slab(2.15, FY, 0, 3.0, 2.3, T.ok, SLAB.glass, 1, 1);
  const pods: number[] = [];
  for (const z of [-0.65, 0, 0.65]) for (const x of [1.35, 2.15, 2.95]) pods.push(b.box(x, FY + 0.25, z, 0.46, 0.46, 0.46, T.ok, 0.2));
  b.wire(0.5, FY - 0.02, -1.3, 3.8, 0.2, 1.3, T.muted);
  // Monitoring: a dashboard panel with a live graph.
  const MX = 2.15;
  const MY = 1.45;
  b.slab(MX, MY, -0.4, 2.6, 1.05, T.ai);
  const GN = low ? 8 : 12;
  const graph0 = b.links.length;
  for (let i = 0; i < GN; i++) b.link([0, 0, 0], [0, 0, 0], 0.035, T.ai, LINK.plain);
  // Deploy: from the loop's release point to the cluster.
  const rel = lem(0);
  const ship = new Path([rel, [0.45, 0.45, 0.4], [1.35, -0.2, 0.5], [2.15, FY + 0.75, 0.2]]);
  b.path([rel, [0.45, 0.45, 0.4], [1.35, -0.2, 0.5], [2.15, FY + 0.65, 0.2]], 0.045, T.accent, LINK.flow, 0.9, 0.7);

  b.label(/GitHub|GitLab/, CX, CY + 1.12, 0, "t");
  b.label(/^Docker/, buildAt[0], buildAt[1] - 0.32, 0, "b");
  b.label(/Argo|Flux/, 0.95, 0.5, 0.45, "t");
  b.label(/Kubernetes|EKS|Helm/, 2.15, FY - 0.1, 1.15, "b");
  // Infrastructure as code names the outline at its far (right) top corner, clear of the
  // delivery arrow's Argo CD label.
  b.label(/Terraform|OpenTofu/, 3.8, 0.2, -1.3, "t");
  b.label(/^AWS/, 0.5, FY - 0.02, 1.3, "l");
  b.label(/Grafana|Prometheus/, MX, MY + 0.58, -0.4, "t");

  // A container's journey: built at the left tip, round the loop to release, then shipped.
  const ride: number[][] = [];
  for (let i = 0; i <= 24; i++) ride.push(lem(Math.PI + (i / 24) * Math.PI));
  const loopPath = new Path(ride);
  const EVERY = low ? 2.4 : 1.7;
  const RIDE = 2.3;
  const FLY = 1.0;
  return {
    slug,
    ...b,
    title: [0.2, 2.6, 0],
    hw: 4.15,
    hh: 2.95,
    animate(live) {
      const t = live.t;
      // Live graph points (written into the static graph links each frame).
      for (let i = 0; i < GN; i++) {
        const x0 = MX - 1.1 + (i / GN) * 2.2;
        const x1 = MX - 1.1 + ((i + 1) / GN) * 2.2;
        live.line(graph0 + i, x0, graphY(i, t, MY), -0.32, x1, graphY(i + 1, t, MY), -0.32);
      }
      const n = Math.ceil((RIDE + FLY + 0.6) / EVERY) + 1;
      const k0 = Math.floor(t / EVERY);
      let landed = -1;
      let landGlow = 0;
      for (let j = 0; j < n; j++) {
        const k = k0 - j;
        if (k < 0) break;
        const age = t - k * EVERY;
        const pod = pods[(k * 4) % pods.length];
        if (age < RIDE) {
          loopPath.at(easeInOut(age / RIDE), tmp);
          const grow = smooth(age / 0.35);
          live.box(tmp[0], tmp[1], tmp[2] + 0.05, 0.34 * (0.4 + 0.6 * grow), T.accent, grow, 1 - grow, age * 1.8);
          if (age < 0.4) live.glow(2, build, 1 - age / 0.4);
        } else if (age < RIDE + FLY) {
          const u = (age - RIDE) / FLY;
          ship.at(easeInOut(u), tmp);
          live.box(tmp[0], tmp[1], tmp[2], 0.34, T.accent, 1, 0, RIDE * 1.8 + u * 2);
        } else if (age < RIDE + FLY + 0.6) {
          const u = (age - RIDE - FLY) / 0.6;
          const p = b.boxes[pod];
          live.box(p.x, p.y + 0.5 * (1 - u), p.z, 0.34 * (1 - u * 0.4), T.accent, 1 - u, u, 0.2);
          landed = pod;
          landGlow = 1 - u;
        }
      }
      if (landed >= 0) live.glow(0, landed, landGlow);
    },
  };
}

// ---------- 4. API & Backend: a gateway checks auth and rate limits, the backend answers ----------

type Req = { on: boolean; t0: number; client: number; ok: boolean; phase: number; traced: boolean };

function api(slug: string, tech: string[]): Design {
  const b = new Builder(tech);
  // Phase lengths: in, gateway → node, node → db, db → node, node → gateway, gateway → client.
  const D = [0.55, 0.42, 0.4, 0.4, 0.42, 0.55];
  const clients = [1.15, 0, -1.15].map((y) => [-3.6, y, 0.1]);
  for (const c of clients) {
    b.sprite(c[0], c[1], c[2], 0.44, T.fg, SPRITE.orb);
    b.sprite(c[0], c[1], c[2], 0.78, T.muted, SPRITE.ring);
  }
  const GX = -1.3;
  const gate = [GX, 0.72, 0.12];
  b.slab(GX, 0.05, 0, 1.05, 3.65, T.accent);
  // Validation ring: pulses as each request is checked.
  const shield = b.sprite(gate[0], gate[1], gate[2], 1.05, T.ai, SPRITE.ring);
  const check = b.sprite(gate[0], gate[1], gate[2], 0.3, T.ai, SPRITE.orb);
  // Rate-limit meter: five bars that fill from the bottom as a burst uses up the bucket.
  const meter = [0, 1, 2, 3, 4].map((k) => b.slab(GX, -1.5 + k * 0.27, 0.1, 0.62, 0.17, k === 4 ? T.fg : T.accent, SLAB.block, 0));
  for (const c of clients) b.link([c[0] + 0.3, c[1], c[2]], [gate[0] - 0.38, gate[1], gate[2]], 0.035, T.muted, LINK.plain, 0, 0, 0.7);
  // Backend: Node.js handler, database, job queue and its worker.
  const NX = 0.85;
  const NY = 0.72;
  const node = b.hex(NX, NY, 0, 0.6, 0.32, T.accent);
  const DBX = 3.0;
  const discs = [0, 1, 2].map((k) => b.disc(DBX, NY + 0.28 - k * 0.28, 0, 0.55, 0.2, T.ok));
  b.link([gate[0] + 0.4, gate[1], 0.05], [NX - 0.62, NY, 0.05], 0.1, T.muted, LINK.lanes, 1.6, 0);
  b.link([NX + 0.62, NY, 0.05], [DBX - 0.62, NY, 0.05], 0.1, T.muted, LINK.lanes, 1.6, 0.3);
  const QY = -1.12;
  const jobs = [0, 1, 2, 3, 4].map((k) => b.box(0.3 + k * 0.5, QY, 0, 0.34, 0.34, 0.34, T.ai, 0.25));
  const worker = b.sprite(3.0, QY, 0.05, 0.56, T.ai, SPRITE.orb);
  b.sprite(3.0, QY, 0.05, 0.95, T.ai, SPRITE.ring);
  b.link([NX, NY - 0.6, 0], [NX - 0.55, QY + 0.25, 0], 0.04, T.ai, LINK.flow, 0.9, 0);
  b.link([2.62, QY, 0], [2.72, QY, 0], 0.04, T.ai, LINK.plain);
  // Traces: one sampled request per burst drawn as a waterfall on a time axis: the gateway
  // span, the handler inside it, the query inside that. Each bar grows left to right in step
  // with the request it measures.
  const TX = -2.0;
  const TW = 4.4;
  const total = D[1] + D[2] + D[3] + D[4];
  const TS = TW / total;
  const SY = -1.95;
  const spanT: [number, number][] = [
    [0, total],
    [D[1], D[1] + D[2] + D[3]],
    [D[1] + D[2] * 0.85, D[1] + D[2] + D[3] * 0.15],
  ];
  const spans = spanT.map(([s0, s1], k) =>
    b.slab(TX + ((s0 + s1) / 2) * TS, SY - k * 0.22, 0, (s1 - s0) * TS, 0.15, k === 0 ? T.ai : k === 1 ? T.accent : T.ok, SLAB.block, 0),
  );
  const AY = SY - 0.62;
  b.link([TX, AY, 0], [TX + TW, AY, 0], 0.022, T.muted, LINK.plain, 0, 0, 0.9);
  for (let k = 0; k <= 4; k++) b.link([TX + (k / 4) * TW, AY + 0.07, 0], [TX + (k / 4) * TW, AY - 0.07, 0], 0.02, T.muted, LINK.plain, 0, 0, 0.9);
  b.link([TX, SY + 0.14, 0], [TX, AY, 0], 0.02, T.muted, LINK.dash, 0.5, 0, 0.8);

  b.label(/Express|Fastify|Hono/, GX, 1.95, 0, "t");
  b.label(/Zod|OpenAPI/, gate[0], gate[1] - 0.42, gate[2], "b");
  b.label(/^Node/, NX, NY + 0.62, 0, "t");
  b.label(/Postgre|Mongo/, DBX, NY + 0.55, 0, "t");
  b.label(/BullMQ|SQS/, 1.3, QY - 0.3, 0, "b");
  b.label(/pino|OpenTelemetry/, TX - 0.05, SY, 0, "l");

  const inbound = clients.map((c) => new Path([[c[0] + 0.25, c[1], c[2] + 0.05], [gate[0] - 0.3, gate[1], gate[2] + 0.05]]));
  const toNode = new Path([[gate[0], gate[1], 0.15], [NX, NY, 0.25]]);
  const toDb = new Path([[NX, NY, 0.25], [DBX, NY, 0.25]]);
  const reqs: Req[] = Array.from({ length: 14 }, () => ({ on: false, t0: 0, client: 0, ok: true, phase: 0, traced: false }));
  const CAP = 5;
  let tokens = CAP;
  let last = -1;
  let spawned = 0;
  let flash = 0;
  let pulse = 0;
  let trace = -1e9;
  const BURST = 8;
  const GAP = 3.6;
  const spawnAt = (k: number) => Math.floor(k / BURST) * GAP + (k % BURST) * 0.19;
  const REJECT = 0.6;
  return {
    slug,
    ...b,
    title: [0, 2.6, 0],
    hw: 4.1,
    hh: 2.95,
    animate(live) {
      const t = live.t;
      if (t < last) {
        // Rebuilt: start over with a full bucket.
        tokens = CAP;
        spawned = 0;
        trace = -1e9;
        for (const r of reqs) r.on = false;
      }
      last = t;
      tokens = Math.min(CAP, tokens + live.dt * 1.2);
      flash = Math.max(0, flash - live.dt * 2.4);
      pulse = Math.max(0, pulse - live.dt * 5);
      // Requests arrive in bursts (round-robin over the clients): the bucket drains during a
      // burst, the last ones get a 429, and it refills in the lull.
      while (spawnAt(spawned) <= t) {
        let r: Req | null = null;
        for (let i = 0; i < reqs.length && !r; i++) if (!reqs[i].on) r = reqs[i];
        if (r) {
          r.on = true;
          r.t0 = spawnAt(spawned);
          r.client = (spawned * 2) % 3;
          r.phase = 0;
          r.ok = true;
          r.traced = spawned % BURST === 0;
        }
        spawned++;
      }
      for (const r of reqs) {
        if (!r.on) continue;
        let age = t - r.t0;
        if (age < D[0]) {
          inbound[r.client].at(easeInOut(age / D[0]), tmp);
          live.packet(tmp[0], tmp[1], tmp[2], 0.26, T.accent, 1, -0.14, 0, 0);
          continue;
        }
        if (r.phase === 0) {
          // At the gateway: validated, then a token per request, or 429 back to the client.
          r.phase = 1;
          if (tokens >= 1) {
            tokens -= 1;
            pulse = 1;
            if (r.traced) trace = r.t0 + D[0];
          } else {
            r.ok = false;
            flash = 1;
          }
        }
        age -= D[0];
        if (!r.ok) {
          if (age < REJECT) {
            inbound[r.client].at(1 - easeInOut(age / REJECT), tmp);
            live.packet(tmp[0], tmp[1], tmp[2], 0.24, T.muted, 1 - age / REJECT, 0.12, 0, 0);
          } else r.on = false;
          continue;
        }
        let done = true;
        for (let ph = 1; ph < D.length; ph++) {
          if (age < D[ph]) {
            const u = easeInOut(age / D[ph]);
            if (ph === 1) toNode.at(u, tmp);
            else if (ph === 2) toDb.at(u, tmp);
            else if (ph === 3) toDb.at(1 - u, tmp);
            else if (ph === 4) toNode.at(1 - u, tmp);
            else inbound[r.client].at(1 - u, tmp);
            const res = ph >= 3;
            live.packet(tmp[0], tmp[1], tmp[2], 0.26, res ? T.ok : T.accent, 1);
            if (ph === 2 || ph === 3) live.glow(1, discs[ph === 2 ? 2 : 0], 1 - Math.abs(u - 1 + (ph - 2)) * 1.5);
            if (ph === 1 || ph === 4) live.glow(1, node, 1 - Math.abs(u - (ph === 1 ? 1 : 0)) * 2);
            done = false;
            break;
          }
          age -= D[ph];
        }
        if (done) r.on = false;
      }
      // The meter: how much of the bucket this burst has used.
      const used = CAP - tokens;
      for (let k = 0; k < meter.length; k++) live.fill(meter[k], clamp01(used - k));
      // Validation pulse per request; a 429 flashes the whole gateway.
      live.glow(2, shield, Math.max(pulse * 0.8, flash));
      live.glow(2, check, pulse);
      if (flash > 0.02) live.packet(gate[0], gate[1] - 0.6, gate[2] + 0.15, 0.9 + (1 - flash) * 1.6, T.accent, flash * 0.75);
      // Job queue: boxes step toward the worker.
      const q = (t / 0.9) % 1;
      live.glow(0, jobs[jobs.length - 1], smooth(q * 2 - 1));
      live.glow(2, worker, q < 0.25 ? 1 - q * 4 : 0);
      // The sampled trace: bars grow as the request moves through each part, a cursor marks now.
      const age = t - trace;
      for (let k = 0; k < spans.length; k++) {
        const [s0, s1] = spanT[k];
        live.fill(spans[k], age < 0 || age > GAP - 0.25 ? 0 : clamp01((age - s0) / (s1 - s0)));
      }
      if (age >= 0 && age <= total) live.packet(TX + age * TS, AY, 0.06, 0.2, T.fg, 1);
    },
  };
}

// ---------- fallback: a hub of the service's own technologies ----------

function hub(slug: string, tech: string[]): Design {
  const b = new Builder(tech);
  b.sprite(0, 0, 0.1, 0.8, T.accent, SPRITE.orb);
  b.sprite(0, 0, 0.1, 1.4, T.accent, SPRITE.ring);
  const n = Math.min(8, tech.length);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const p = [Math.cos(a) * 2.6, Math.sin(a) * 1.8, Math.sin(a) * 0.4];
    b.sprite(p[0], p[1], p[2], 0.45, (i % 4) as Tint, SPRITE.orb);
    b.link([0, 0, 0.1], p, 0.05, T.muted, LINK.flow, 0.8);
    b.labels.push({ text: tech[i], x: p[0], y: p[1] + 0.32, z: p[2], side: "t" });
  }
  return { slug, ...b, title: [0, 2.55, 0], hw: 3.6, hh: 2.7, animate() {} };
}

const BUILDERS: [RegExp, (slug: string, tech: string[], low: boolean) => Design][] = [
  [/next/i, nextjs],
  [/mern/i, mern],
  [/devops|aws|cloud/i, devops],
  [/api|backend/i, api],
];

/** One machine per service, in the services' display order. */
export function buildDesigns(services: NeuralData["services"], low: boolean): Design[] {
  return services.map((s) => {
    const make = BUILDERS.find(([re]) => re.test(s.slug))?.[1];
    return make ? make(s.slug, s.tech, low) : hub(s.slug, s.tech);
  });
}
