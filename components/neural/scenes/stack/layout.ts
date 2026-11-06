// Deterministic layout of the skills constellation (pure, no three.js objects).
// Each skill layer is a soft horizontal "plate" of nodes; plates are stacked like the
// layers of the stack (ai on top, then frontend → backend → database → devops),
// gently staggered in depth. Within a plate the most-used skill sits at the centre
// and the rest spiral out (phyllotaxis), so the layout never depends on randomness.
import type { NeuralData, SkillLayer } from "../../types";
import { hash01 } from "./gl";

export const LAYER_ORDER: readonly SkillLayer[] = ["ai", "frontend", "backend", "database", "devops"];
export const LAYER_NAME: Record<SkillLayer, string> = {
  ai: "AI",
  frontend: "Frontend",
  backend: "Backend",
  database: "Data",
  devops: "DevOps",
};

export type PlateLayout = { layer: SkillLayer; x: number; y: number; z: number; radius: number; count: number };
export type NodeLayout = {
  id: string;
  name: string;
  layer: SkillLayer;
  uses: number;
  x: number;
  y: number;
  z: number;
  /** Core diameter in world units (∝ √uses, with a floor for unused skills). */
  d: number;
};
export type LinkLayout = { a: number; b: number; weight: number; w: number; ctrl: [number, number, number] };
export type StackLayout = {
  plates: PlateLayout[];
  nodes: NodeLayout[];
  links: LinkLayout[];
  /** For each node: indices of linked nodes. */
  neighbours: number[][];
  /** Nodes that always carry a label: the most-used skills. */
  labelled: number[];
  index: Map<string, number>;
};

const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const MIN_D = 0.11;
const MAX_D = 0.34;
export const TOP_LABELS = 12;

export function layoutStack(data: NeuralData): StackLayout {
  const layers = LAYER_ORDER.filter((l) => data.skills.some((s) => s.layer === l));
  const n = layers.length;
  const height = Math.min(4.7, 1.6 * Math.max(0, n - 1));
  const maxUses = Math.max(1, ...data.skills.map((s) => s.uses));

  const plates: PlateLayout[] = [];
  const nodes: NodeLayout[] = [];
  layers.forEach((layer, k) => {
    const skills = data.skills
      .filter((s) => s.layer === layer)
      .sort((a, b) => b.uses - a.uses || a.name.localeCompare(b.name));
    const count = skills.length;
    const radius = Math.min(3.1, 0.9 + 0.6 * Math.sqrt(count));
    // Soft stagger: plates drift a little left/right and in depth, top to bottom.
    const plate = {
      layer,
      x: Math.sin(k * 1.9 + 0.4) * 0.4,
      y: n > 1 ? height / 2 - (k * height) / (n - 1) : 0,
      z: Math.cos(k * 1.3) * 0.45 - 0.2 * k,
      radius,
      count,
    };
    plates.push(plate);
    skills.forEach((s, i) => {
      const r = radius * 0.8 * Math.sqrt((i + 0.3) / count);
      const a = i * GOLDEN + k * 0.95;
      nodes.push({
        id: s.id,
        name: s.name,
        layer,
        uses: s.uses,
        x: plate.x + Math.cos(a) * r,
        y: plate.y + (hash01(s.id, 7) - 0.5) * 0.22,
        z: plate.z + Math.sin(a) * r,
        d: MIN_D + (MAX_D - MIN_D) * Math.sqrt(s.uses / maxUses),
      });
    });
  });

  const index = new Map(nodes.map((nd, i) => [nd.id, i]));
  const neighbours: number[][] = nodes.map(() => []);
  const maxW = Math.max(1, ...data.links.map((l) => l.weight));
  const links: LinkLayout[] = [];
  for (const l of data.links) {
    const a = index.get(l.a);
    const b = index.get(l.b);
    if (a === undefined || b === undefined || a === b) continue;
    const A = nodes[a];
    const B = nodes[b];
    // Bow each edge outward from the stack's axis (and a little up when it stays in one
    // plate), so edges read as arcs between layers instead of a knot through the middle.
    const mx = (A.x + B.x) / 2;
    const my = (A.y + B.y) / 2;
    const mz = (A.z + B.z) / 2;
    const len = Math.hypot(A.x - B.x, A.y - B.y, A.z - B.z);
    const out = Math.hypot(mx, mz) || 1;
    const push = 0.22 * len;
    const lift = A.layer === B.layer ? 0.28 * len : 0;
    links.push({
      a,
      b,
      weight: l.weight,
      w: l.weight / maxW,
      ctrl: [mx + (mx / out) * push, my + lift, mz + (mz / out) * push],
    });
    neighbours[a].push(b);
    neighbours[b].push(a);
  }

  const labelled = nodes
    .map((nd, i) => ({ i, uses: nd.uses }))
    .filter((x) => x.uses > 0)
    .sort((x, y) => y.uses - x.uses || x.i - y.i)
    .slice(0, TOP_LABELS)
    .map((x) => x.i);

  return { plates, nodes, links, neighbours, labelled, index };
}

/** Quadratic Bézier point (no allocation). */
export function bezier(out: Float32Array, o: number, A: NodeLayout, c: [number, number, number], B: NodeLayout, t: number) {
  const u = 1 - t;
  out[o] = u * u * A.x + 2 * u * t * c[0] + t * t * B.x;
  out[o + 1] = u * u * A.y + 2 * u * t * c[1] + t * t * B.y;
  out[o + 2] = u * u * A.z + 2 * u * t * c[2] + t * t * B.z;
}
