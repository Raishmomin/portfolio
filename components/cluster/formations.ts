// Per-section pod formations derived from real data (tasks/design-spec.md §4).
// Pure TS with no three.js import: the server poster and the client scene share it,
// and the same input always yields the same output (seeded PRNG, no Math.random).
import { nodeSide, type Layout } from "./config";
import { FORMATION_KEYS, type FormationData, type FormationKey } from "./types";

/** 0 = unscheduled (scaled to 0), 1 = Running, 2 = Ready (green), 3 = Pending (orange). */
export const STATUS = { hidden: 0, running: 1, ready: 2, pending: 3 } as const;

/** Screen-space bounds (world units along the camera's right/up axes) to frame a formation. */
export type FormationView = { cx: number; cy: number; w: number; h: number };

export type Formation = {
  /** xyz per instance (pod centres; pods are 0.8 cubes on a 1.0 grid, ground at y = 0). */
  positions: Float32Array;
  status: Uint8Array;
  /** Index into data.skills / data.experience / data.projects for stack / experience / work, else -1. */
  tag: Int8Array;
  /** Scheduled pods; instances at or past this index are hidden. */
  visible: number;
  view: FormationView;
  /** Node plates (hero/about only): x, z, width, depth per plate. */
  plates: Float32Array;
};

export type Formations = Record<FormationKey, Formation>;

export const POD = 0.8;
const HALF = POD / 2;

// Camera direction from spec §4 (position [12,10,12] looking at the origin) and its screen basis.
const camLen = Math.hypot(12, 10, 12);
export const CAM_DIR: readonly [number, number, number] = [12 / camLen, 10 / camLen, 12 / camLen];
const rLen = Math.hypot(CAM_DIR[0], CAM_DIR[2]);
/** Screen right, in world space. */
export const SCREEN_R: readonly [number, number, number] = [CAM_DIR[2] / rLen, 0, -CAM_DIR[0] / rLen];
/** Screen up, in world space (CAM_DIR × SCREEN_R). */
export const SCREEN_U: readonly [number, number, number] = [
  CAM_DIR[1] * SCREEN_R[2] - CAM_DIR[2] * SCREEN_R[1],
  CAM_DIR[2] * SCREEN_R[0] - CAM_DIR[0] * SCREEN_R[2],
  CAM_DIR[0] * SCREEN_R[1] - CAM_DIR[1] * SCREEN_R[0],
];
const POD_HX = HALF * (Math.abs(SCREEN_R[0]) + Math.abs(SCREEN_R[1]) + Math.abs(SCREEN_R[2]));
const POD_HY = HALF * (Math.abs(SCREEN_U[0]) + Math.abs(SCREEN_U[1]) + Math.abs(SCREEN_U[2]));

export function projectX(x: number, y: number, z: number): number {
  return x * SCREEN_R[0] + y * SCREEN_R[1] + z * SCREEN_R[2];
}
export function projectY(x: number, y: number, z: number): number {
  return x * SCREEN_U[0] + y * SCREEN_U[1] + z * SCREEN_U[2];
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Slot = { x: number; y: number; z: number; tag: number; status?: number };

/** Split `total` across weights, exactly, largest remainders first. */
function apportion(weights: number[], total: number): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (!weights.length) return [];
  const raw = weights.map((w) => (sum > 0 ? (w / sum) * total : total / weights.length));
  const out = raw.map(Math.floor);
  let rest = total - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0]);
  for (let k = 0; rest > 0 && k < order.length; k++, rest--) out[order[k][1]]++;
  return out;
}

function heroSlots(n: number, layout: Layout): { slots: Slot[]; plates: number[] } {
  const slots: Slot[] = [];
  const plates: number[] = [];
  const step = n + 1.6;
  const c = (n - 1) / 2;
  for (let k = 0; k < 3; k++) {
    // Portrait stacks the nodes down the screen (along world x+z), landscape runs them along x.
    const ox = k * step;
    const oz = layout === "portrait" ? k * step : 0;
    const cells = k === 2 ? (n * n) / 2 : n * n; // node-3 is half full: capacity available
    for (let cell = 0; cell < cells; cell++) {
      slots.push({ x: ox + Math.floor(cell / n) - c, y: HALF, z: oz + (cell % n) - c, tag: -1 });
    }
    plates.push(ox, oz, n + 0.3, n + 0.3);
  }
  return { slots, plates };
}

/**
 * Columns of f×f pods `layers` high: a row of columns runs along screen-horizontal
 * (world +x −z); rows stack down the screen with clearance for the columns in front.
 */
function skyline(items: { pods: number; tag: number }[], f: number, perRow: number): Slot[] {
  const slots: Slot[] = [];
  const perLayer = f * f;
  const colStep = f + 0.7;
  const c = (f - 1) / 2;
  // Moving one unit along world (1,0,1) shifts the screen by this much (downwards).
  const diagDrop = -(SCREEN_U[0] + SCREEN_U[2]);
  const footprintH = f * (Math.abs(SCREEN_U[0]) + Math.abs(SCREEN_U[2]));
  let rowOffset = 0;
  for (let start = 0, row = 0; start < items.length; start += perRow, row++) {
    const rowItems = items.slice(start, start + perRow);
    if (row > 0) {
      const tallest = Math.max(...rowItems.map((it) => Math.ceil(it.pods / perLayer)));
      rowOffset += (tallest * SCREEN_U[1] + footprintH + 1.2) / diagDrop;
    }
    rowItems.forEach((it, col) => {
      const bx = rowOffset + col * colStep;
      const bz = rowOffset - col * colStep;
      for (let p = 0; p < it.pods; p++) {
        const layer = Math.floor(p / perLayer);
        const a = Math.floor((p % perLayer) / f);
        const b = p % f;
        slots.push({ x: bx + a - c, y: HALF + layer, z: bz + b - c, tag: it.tag });
      }
    });
  }
  return slots;
}

function experienceSlots(data: FormationData, pods: number, layout: Layout): Slot[] {
  const jobs = data.experience.map((e, tag) => ({ months: Math.max(1, e.months), tag })).reverse(); // oldest first
  const counts = apportion(jobs.map((j) => j.months), pods);
  // The most recent role (display order index 0) is the live revision: only its top layer reads
  // Ready (a green cap), so status green stays an accent rather than a solid block.
  const status = (tag: number, top: boolean) => (tag === 0 && top ? STATUS.ready : undefined);
  const slots: Slot[] = [];
  if (layout === "portrait") {
    // A staircase: one f×f block of layers per company, oldest at the bottom, each newer
    // block a layer higher and stepped back along −z (screen up-right), so every block
    // leaves its predecessor's top face visible as a ledge.
    const f = 4;
    const c = (f - 1) / 2;
    const step = 2;
    let y = HALF;
    jobs.forEach((job, k) => {
      const oz = (jobs.length - 1) / 2 * step - k * step;
      const topLayer = Math.ceil(counts[k] / (f * f)) - 1;
      for (let p = 0; p < counts[k]; p++) {
        const layer = Math.floor(p / (f * f));
        slots.push({ x: Math.floor((p % (f * f)) / f) - c, y: y + layer, z: oz + (p % f) - c, tag: job.tag, status: status(job.tag, layer === topLayer) });
      }
      y += Math.ceil(counts[k] / (f * f)) + 1;
    });
  } else {
    // A timeline beam along x, 2×2 in section, one segment per company.
    let x = 0;
    jobs.forEach((job, k) => {
      for (let p = 0; p < counts[k]; p++) {
        const along = Math.floor(p / 4);
        const row = Math.floor(p / 2) % 2;
        slots.push({ x: x + along, y: HALF + row, z: (p % 2) - 0.5, tag: job.tag, status: status(job.tag, row === 1) });
      }
      x += Math.ceil(counts[k] / 4) + 1;
    });
  }
  return slots;
}

function ringSlots(pods: number): Slot[] {
  const radii = [5.2, 6.4];
  const laps = radii.map((r) => Math.floor((2 * Math.PI * r) / 1.25));
  const perLayer = laps.reduce((a, b) => a + b, 0);
  const layers = Math.max(1, Math.ceil(pods / perLayer));
  const counts = apportion(
    Array.from({ length: layers * radii.length }, (_, i) => laps[i % radii.length]),
    pods,
  );
  const slots: Slot[] = [];
  counts.forEach((n, i) => {
    const layer = Math.floor(i / radii.length);
    const r = radii[i % radii.length];
    for (let j = 0; j < n; j++) {
      const a = (2 * Math.PI * (j + 0.5 * (layer % 2))) / n;
      slots.push({ x: Math.cos(a) * r, y: HALF + layer, z: Math.sin(a) * r, tag: -1, status: STATUS.running });
    }
  });
  // Angle order, so instance index sweeps around the ring (stagger and the green pulse follow it).
  return slots.sort((p, q) => Math.atan2(p.z, p.x) - Math.atan2(q.z, q.x));
}

function viewOf(slots: Slot[], plates: number[]): FormationView {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  const add = (sx: number, sy: number, hx: number, hy: number) => {
    x0 = Math.min(x0, sx - hx);
    x1 = Math.max(x1, sx + hx);
    y0 = Math.min(y0, sy - hy);
    y1 = Math.max(y1, sy + hy);
  };
  for (const s of slots) add(projectX(s.x, s.y, s.z), projectY(s.x, s.y, s.z), POD_HX, POD_HY);
  for (let i = 0; i < plates.length; i += 4) {
    for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const x = plates[i] + (dx * plates[i + 2]) / 2;
      const z = plates[i + 1] + (dz * plates[i + 3]) / 2;
      add(projectX(x, 0, z), projectY(x, 0, z), 0, 0);
    }
  }
  if (!Number.isFinite(x0)) return { cx: 0, cy: 0, w: 10, h: 10 };
  return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
}

function pack(slots: Slot[], plates: number[], count: number, seed: number, view?: FormationView): Formation {
  const visible = Math.min(slots.length, count);
  const positions = new Float32Array(count * 3);
  const status = new Uint8Array(count);
  const tag = new Int8Array(count).fill(-1);
  const rand = mulberry32(seed);
  let cx = 0, cz = 0;
  for (let i = 0; i < visible; i++) {
    const s = slots[i];
    positions.set([s.x, s.y, s.z], i * 3);
    tag[i] = s.tag;
    const r = rand();
    status[i] = s.status ?? (r < 0.035 ? STATUS.pending : r < 0.15 ? STATUS.ready : STATUS.running);
    cx += s.x;
    cz += s.z;
  }
  // Unscheduled instances wait (scaled to 0) at the formation's centre.
  cx = visible ? cx / visible : 0;
  cz = visible ? cz / visible : 0;
  for (let i = visible; i < count; i++) positions.set([cx, HALF, cz], i * 3);
  return {
    positions,
    status,
    tag,
    visible,
    view: view ?? viewOf(slots.slice(0, visible), plates),
    plates: new Float32Array(plates),
  };
}

/**
 * Pods that can hop: scheduled pods with nothing above them. Pods are axis-aligned
 * 0.8 cubes, so a straight lift can only meet a pod whose footprint overlaps in x and z.
 */
export function hopCandidates(f: Formation): Uint16Array {
  const p = f.positions;
  const out: number[] = [];
  for (let i = 0; i < f.visible; i++) {
    if (f.status[i] === STATUS.hidden) continue;
    let free = true;
    for (let j = 0; j < f.visible && free; j++) {
      free = !(j !== i && p[j * 3 + 1] > p[i * 3 + 1] + 0.01 && Math.abs(p[j * 3] - p[i * 3]) < POD && Math.abs(p[j * 3 + 2] - p[i * 3 + 2]) < POD);
    }
    if (free) out.push(i);
  }
  return Uint16Array.from(out);
}

export function buildFormations(
  data: FormationData,
  count: number,
  options: { layout?: Layout } = {},
): Formations {
  const layout = options.layout ?? "portrait";
  const seedBase = hash(
    [
      data.skills.map((s) => `${s.group}:${s.count}`).join(","),
      data.experience.map((e) => `${e.company}:${e.months}`).join(","),
      data.projects.map((p) => `${p.slug}:${p.techCount}`).join(","),
      count,
      layout,
    ].join("|"),
  );
  const seed = (key: FormationKey) => seedBase ^ hash(key);

  const n = nodeSide(count);
  const hero = heroSlots(n, layout);
  const pods = hero.slots.length;
  const heroView = viewOf(hero.slots, hero.plates);
  // "about": the same scheduling, the camera eased in on the middle node: its whole
  // plate fills the frame edge to edge (VIEW_MARGIN still leaves air at the corners);
  // the neighbouring nodes stay in view above and below.
  const aboutView = viewOf(hero.slots.slice(n * n, 2 * n * n), hero.plates.slice(4, 8));
  aboutView.w *= 0.96;
  aboutView.h *= 0.96;

  const skillItems = data.skills.map((s, tag) => ({ weight: s.count, tag }));
  const skillPods = apportion(skillItems.map((s) => s.weight), pods);
  const stack = skyline(
    skillItems.map((s, i) => ({ pods: skillPods[i], tag: s.tag })).filter((s) => s.pods > 0),
    3,
    layout === "portrait" ? 2 : 4,
  );

  // Work: one 2×2 column per featured project, one layer per technology (scaled down
  // proportionally only when the pod budget can't fit them all).
  const techs = data.projects.map((p) => Math.max(1, p.techCount));
  const fit = Math.min(1, pods / (4 * techs.reduce((a, b) => a + b, 0)));
  const work = skyline(
    techs.map((t, tag) => ({ pods: Math.max(1, Math.round(t * fit)) * 4, tag })),
    2,
    layout === "portrait" ? 3 : 6,
  );

  const out = {} as Formations;
  for (const key of FORMATION_KEYS) {
    const s = seed(key);
    switch (key) {
      case "hero":
        out[key] = pack(hero.slots, hero.plates, count, s, heroView);
        break;
      case "about":
        out[key] = pack(hero.slots, hero.plates, count, seed("hero"), aboutView);
        break;
      case "stack":
        out[key] = stack.length ? pack(stack, [], count, s) : pack(hero.slots, hero.plates, count, s, heroView);
        break;
      case "experience": {
        const exp = experienceSlots(data, pods, layout);
        out[key] = exp.length ? pack(exp, [], count, s) : pack(hero.slots, hero.plates, count, s, heroView);
        break;
      }
      case "work":
        out[key] = work.length ? pack(work, [], count, s) : pack(hero.slots, hero.plates, count, s, heroView);
        break;
      case "contact":
        out[key] = pack(ringSlots(pods), [], count, s);
        break;
    }
  }
  return out;
}
