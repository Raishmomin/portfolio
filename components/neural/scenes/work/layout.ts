// Work scene layout (pure, no three.js): where every piece of a project's architecture
// sits, built from its real tiered stack (NeuralData.work[i].stack). Local units, y up,
// before the rig's pitch/yaw. The three stack tiers are glass platforms stacked top to
// bottom (client, server, data); each technology is a node on its platform, in two
// columns whose labels point outward (left column → left, right column → right), with the
// packet spine running between them. AI is a small neural cluster plugged into the right
// edge of the server platform (or the client's when there is no server); its
// technologies are the cluster's output neurons. Infra is a wireframe container round the
// whole system, with its technologies as badges on the top front edge.
import type { ArchTier, NeuralData } from "../../types";

export const STACK = ["client", "server", "data"] as const;
export const TIER_INDEX: Record<ArchTier, number> = { client: 0, server: 1, data: 2, infra: 3, ai: 4 };
/** Nodes drawn per tier: a few, readable in 3 s. The rest count as "+N" on the tier label. */
export const CAP = [4, 4, 4, 3, 3];

/** Pitch (top surfaces toward the viewer) and resting yaw of the stack. */
export const PITCH = 0.52;
export const YAW = -0.2;

const COL_X = 0.72; // node columns at ±COL_X (labels outward)
const SLAB_W = 4.7;
const SLAB_W1 = 3.2; // a tier with a single node
const ROW_Z = 0.4;
const NODE_LIFT = 0.24;
const GAP = 0.95; // screen-space clearance between platforms (labels, spine)
export const LABEL_W = 1.45; // estimated label length in local units (for the fit)
const AI_OUT = 1.05; // AI technologies (the cluster's outputs), right of its anchor

/** Every technology across the projects, one node each (key → index). */
export type Vocab = { keys: string[]; names: string[]; index: Map<string, number> };

export function buildVocab(work: NeuralData["work"]): Vocab {
  const keys: string[] = [];
  const names: string[] = [];
  const index = new Map<string, number>();
  for (const p of work)
    for (const t of p.stack) {
      if (index.has(t.key)) continue;
      index.set(t.key, keys.length);
      keys.push(t.key);
      names.push(t.name);
    }
  return { keys, names, index };
}

export type Platform = { on: boolean; y: number; w: number; d: number; count: number; more: number };
export type Layout = {
  /** Per vocab node: shown, tier index, label side (-1 left, 1 right), stagger order and slot. */
  on: Uint8Array;
  tier: Uint8Array;
  side: Int8Array;
  order: Int16Array;
  slot: Float32Array;
  platforms: Platform[];
  ai: { on: boolean; x: number; y: number; port: number; count: number; more: number };
  infra: { on: boolean; min: number[]; max: number[]; count: number; more: number };
  /** Title anchor (top left of the system). */
  title: number[];
  /** 2D bounds after pitch/yaw, labels included: centre and half extents. */
  cx: number;
  cy: number;
  hw: number;
  hh: number;
  /** Largest depth toward the viewer after rotation (perspective makes those parts bigger). */
  zn: number;
};

const sin = Math.sin(PITCH);
const cos = Math.cos(PITCH);
const sy = Math.sin(YAW);
const cy0 = Math.cos(YAW);

/** Rotated position (yaw, then pitch), as the rig's Euler(PITCH, YAW, 0) applies it. */
function rotate2d(x: number, y: number, z: number, out: number[]) {
  const x1 = x * cy0 + z * sy;
  const z1 = -x * sy + z * cy0;
  out[0] = x1;
  out[1] = y * cos - z1 * sin;
  out[2] = y * sin + z1 * cos;
}

/**
 * Lay out one project. `pin` is a technology key to force into view (a hovered chip whose
 * node would otherwise be beyond its tier's cap): it takes the tier's last visible slot.
 */
export function layout(project: NeuralData["work"][number] | undefined, vocab: Vocab, pin: string | null): Layout {
  const n = vocab.keys.length;
  const L: Layout = {
    on: new Uint8Array(n),
    tier: new Uint8Array(n),
    side: new Int8Array(n),
    order: new Int16Array(n),
    slot: new Float32Array(n * 3),
    platforms: STACK.map(() => ({ on: false, y: 0, w: SLAB_W, d: 1, count: 0, more: 0 })),
    ai: { on: false, x: 0, y: 0, port: 1, count: 0, more: 0 },
    infra: { on: false, min: [0, 0, 0], max: [0, 0, 0], count: 0, more: 0 },
    title: [0, 0, 0],
    cx: 0,
    cy: 0,
    hw: 1,
    hh: 1,
    zn: 0,
  };
  const groups: number[][] = [[], [], [], [], []];
  for (const t of project?.stack ?? []) {
    const i = vocab.index.get(t.key);
    if (i !== undefined) groups[TIER_INDEX[t.tier]].push(i);
  }
  // Cap each tier; a pinned technology replaces the last visible slot of its tier.
  const shown = groups.map((g, k) => {
    const s = g.slice(0, CAP[k]);
    const pi = pin ? vocab.index.get(pin) : undefined;
    if (pi !== undefined && g.includes(pi) && !s.includes(pi)) s[s.length - 1] = pi;
    return s;
  });
  shown.forEach((s, k) => {
    for (const i of s) {
      L.on[i] = 1;
      L.tier[i] = k;
    }
  });

  // Platforms, top to bottom, spaced so their projected footprints never overlap.
  let y = 0;
  let prevD = 0;
  let any = false;
  STACK.forEach((_, k) => {
    const c = shown[k].length;
    const p = L.platforms[k];
    p.count = groups[k].length;
    p.more = groups[k].length - c;
    if (c === 0) return;
    const rows = c > 2 ? 2 : 1;
    p.on = true;
    p.w = c === 1 ? SLAB_W1 : SLAB_W;
    p.d = rows === 2 ? 1.7 : 1.15;
    if (any) y -= (GAP + ((prevD + p.d) / 2) * sin) / cos;
    p.y = y;
    prevD = p.d;
    any = true;
  });
  // A project that lists no client/server/data technology still gets an (empty) client platform.
  if (!any) {
    const p = L.platforms[0];
    p.on = true;
    p.w = SLAB_W1;
    p.d = 1.15;
  }
  // Centre the stack vertically on 0.
  const ons = L.platforms.filter((p) => p.on);
  const mid = (ons[0].y + ons[ons.length - 1].y) / 2;
  for (const p of ons) p.y -= mid;

  // Nodes on the platforms: two columns (labels outward), back row first.
  let order = 0;
  STACK.forEach((_, k) => {
    const p = L.platforms[k];
    const s = shown[k];
    const rows = s.length > 2 ? 2 : 1;
    s.forEach((i, j) => {
      const col = s.length === 1 ? 0 : j % 2;
      const row = Math.floor(j / 2);
      const x = s.length === 1 ? -0.55 : col === 0 ? -COL_X : COL_X;
      const z = rows === 1 ? 0 : row === 0 ? -ROW_Z : ROW_Z;
      L.slot.set([x, p.y + NODE_LIFT, z], i * 3);
      L.side[i] = s.length === 1 ? 1 : col === 0 ? -1 : 1;
      L.order[i] = order++;
    });
  });

  const maxW = Math.max(...ons.map((p) => p.w));
  const maxD = Math.max(...ons.map((p) => p.d));
  const top = ons[0].y;
  const bottom = ons[ons.length - 1].y;

  // AI cluster on the right of the server platform (else the client's).
  const ai = shown[4];
  L.ai.count = groups[4].length;
  L.ai.more = groups[4].length - ai.length;
  let right = maxW / 2;
  if (ai.length) {
    const port = L.platforms[1].on ? 1 : L.platforms[0].on ? 0 : 2;
    const host = L.platforms[port];
    L.ai.on = true;
    L.ai.port = port;
    L.ai.x = host.w / 2 + 0.5;
    L.ai.y = host.y + 0.2;
    ai.forEach((i, j) => {
      L.slot.set([L.ai.x + AI_OUT, L.ai.y + (j - (ai.length - 1) / 2) * 0.62, 0], i * 3);
      L.side[i] = 1;
      L.order[i] = order++;
    });
    right = Math.max(right, L.ai.x + AI_OUT + LABEL_W);
  }

  // Infra: a wireframe container round everything, badges along its top back edge (the
  // front edge would sit on the client platform's labels).
  const infra = shown[3];
  L.infra.count = groups[3].length;
  L.infra.more = groups[3].length - infra.length;
  const minX = -maxW / 2 - 0.3;
  if (infra.length) {
    const maxX = Math.max(right - (ai.length ? LABEL_W - 0.2 : 0) + 0.3, minX + 0.4 + infra.length * 1.85);
    L.infra.on = true;
    L.infra.min = [minX, bottom - 0.5, -maxD / 2 - 0.3];
    L.infra.max = [maxX, top + 0.95, maxD / 2 + 0.3];
    infra.forEach((i, j) => {
      L.slot.set([minX + 0.45 + j * 1.85, L.infra.max[1], L.infra.min[2]], i * 3);
      L.side[i] = 1;
      L.order[i] = order++;
    });
    right = Math.max(right, maxX, minX + 0.45 + (infra.length - 1) * 1.85 + LABEL_W);
  }

  // Title above the system (the project name, duplicated from the DOM card).
  L.title = [minX + 0.1, (L.infra.on ? L.infra.max[1] + 0.5 : top + 0.75), L.infra.on ? L.infra.min[2] : -0.4];

  // 2D bounds after rotation, labels included.
  const pt = [0, 0, 0];
  let zn = 0;
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  const add = (x: number, yy: number, z: number) => {
    rotate2d(x, yy, z, pt);
    if (pt[0] < x0) x0 = pt[0];
    if (pt[0] > x1) x1 = pt[0];
    if (pt[1] < y0) y0 = pt[1];
    if (pt[1] > y1) y1 = pt[1];
    if (pt[2] > zn) zn = pt[2];
  };
  for (const p of ons)
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        add((sx * p.w) / 2, p.y, (sz * p.d) / 2);
        add((sx * p.w) / 2, p.y - 0.45, (sz * p.d) / 2); // tier label under the front edge
      }
  if (L.ai.on) {
    add(right, L.ai.y + 0.9, 0);
    add(right, L.ai.y - 0.9, 0);
  }
  if (L.infra.on)
    for (const xx of [L.infra.min[0], right])
      for (const yy of [L.infra.min[1], L.infra.max[1] + 0.25])
        for (const zz of [L.infra.min[2], L.infra.max[2]]) add(xx, yy, zz);
  add(L.title[0], L.title[1] + 0.35, L.title[2]);
  add(L.title[0] + 2.4, L.title[1], L.title[2]);
  L.cx = (x0 + x1) / 2;
  L.cy = (y0 + y1) / 2;
  L.hw = (x1 - x0) / 2;
  L.hh = (y1 - y0) / 2;
  L.zn = zn;
  return L;
}
