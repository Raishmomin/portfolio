// The AI scene's pure model: one slot per distinct stage across the AI projects (each
// slot is one 3D object: chat window, vector store, agent, model core, answer card...),
// and for each project its "plan": which slots it uses, where they stand, what their
// technology lines say, how its links run and the timeline one request takes through it.
// Layout: the model core is the hub; the stages before it arc over it from the left and
// the stages after it leave on the right, so the system fills a roughly square free area.
// Each project gets one of three arrangements (by its position in the list), so switching
// projects visibly rebuilds the system even when two projects share their stage names.
import type { NeuralData } from "../../types";
import { aiRoles, stageKind, stageTech, type InputKind, type StageKind } from "./system";

export const MAX_SLOTS = 8;
export const MAX_RINGS = 3;
/** Half extents [x, y] of each object in layout units (labels and links keep clear of them). */
export const EXT: Record<StageKind, readonly [number, number]> = {
  input: [0.8, 0.62],
  stt: [0.72, 0.5],
  rag: [0.66, 0.72],
  agent: [0.86, 0.6],
  llm: [1.2, 1.2],
  tts: [0.72, 0.5],
  output: [0.66, 0.86],
  generic: [0.42, 0.42],
};
/** Where links attach: distance from the object's centre. */
export const PORT: Record<StageKind, number> = { input: 0.8, stt: 0.7, rag: 0.7, agent: 0.86, llm: 1.08, tts: 0.7, output: 0.72, generic: 0.42 };

/** Seconds a request spends inside each kind of stage, and between two stages. */
const DWELL: Record<StageKind, number> = { input: 1.4, stt: 1.3, rag: 1.9, agent: 2.3, llm: 1.7, tts: 1.3, output: 2.2, generic: 1.1 };
export const TRAVEL = 0.75;
/** After the answer is complete: hold it, then clear it before the next request. */
export const HOLD = 1.6;
export const CLEAR = 0.55;

export type Slot = { name: string; kind: StageKind };
export type Step = { slot: number; start: number; dwell: number; leave: number };
export type Plan = {
  slug: string;
  title: string;
  /** Slot indices in flow order, and the stage names as the DOM card lists them. */
  order: number[];
  stages: string[];
  on: Uint8Array;
  /** Per slot: centre (x, y, z) and yaw. */
  pos: Float32Array;
  yaw: Float32Array;
  /** Per slot: label above (1) or below (-1) the object. */
  label: Int8Array;
  input: InputKind;
  /** Model rings round the core: one per model provider (1..MAX_RINGS). */
  rings: number;
  /** Per slot: the technology line under its name. */
  tech: string[];
  /** Centre and half extents of everything (objects, labels, title). */
  box: [number, number, number, number];
  /** Title anchor (top left of the system). */
  title0: [number, number];
  links: [number, number][];
  steps: Step[];
  cycle: number;
};
export type AiModel = { slots: Slot[]; plans: Plan[]; index: Map<string, number>; generic: boolean };

const GENERIC = [{ slug: "", title: "", stages: ["Input", "Retrieval (RAG)", "LLM", "Output"] }];

/** Merge the stage lists, keeping each list's order (a new stage goes right after its predecessor). */
function mergeVocab(lists: string[][]): string[] {
  const vocab: string[] = [];
  for (const list of lists) {
    let prev = -1;
    for (const s of list) {
      let i = vocab.indexOf(s);
      if (i < 0) {
        i = prev + 1;
        vocab.splice(i, 0, s);
      }
      prev = i;
    }
  }
  return vocab;
}

const RAD = Math.PI / 180;
const RX = 3.0;
const RY = 2.25;
/** Arrangements: m = 1 arcs over the core ("M"), -1 under it ("W"); a0/a1 = arc of the stages before the core. */
const VARIANTS = [
  { m: 1, a0: 205, a1: 52, post: -30, hub: [0.05, -0.12], depth: (a: number) => -0.55 * Math.sin(a) + 0.12 * Math.cos(a) },
  { m: -1, a0: 200, a1: 55, post: -28, hub: [0, 0.12], depth: (a: number) => 0.5 * Math.cos(a) - 0.2 * Math.sin(a) },
  { m: 1, a0: 168, a1: 28, post: -62, hub: [-0.2, -0.3], depth: (a: number) => -0.35 * Math.sin(a) - 0.4 * Math.cos(a) },
];

function spread(a: number, b: number, n: number): number[] {
  if (n <= 0) return [];
  if (n === 1) return [a];
  return Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
}

function plan(
  p: { slug: string; title: string; stages: string[] },
  tech: string[],
  slots: Slot[],
  variant: number,
): Plan {
  const names = slots.map((s) => s.name);
  const order = p.stages.map((s) => names.indexOf(s)).filter((i) => i >= 0);
  const kinds = order.map((i) => slots[i].kind);
  let hub = kinds.indexOf("llm");
  if (hub < 0) hub = Math.floor(order.length / 2);
  const V = VARIANTS[variant % VARIANTS.length];
  const nPre = hub;
  const nPost = order.length - hub - 1;
  // Few stages before the core: a shorter arc, so they do not crowd one side.
  const preEnd = nPre >= 3 ? V.a1 : nPre === 2 ? (V.a0 + V.a1) / 2 - 8 : V.a0;
  const pre = spread(nPre === 1 ? V.a0 - 15 : V.a0, preEnd, nPre);
  const post = nPost === 1 ? [V.post] : spread(-12, -78, nPost);
  const angles = [...pre, NaN, ...post];

  const on = new Uint8Array(MAX_SLOTS);
  const pos = new Float32Array(MAX_SLOTS * 3);
  const yaw = new Float32Array(MAX_SLOTS);
  const label = new Int8Array(MAX_SLOTS).fill(-1);
  const roles = aiRoles(p.stages, tech);
  const techLine = slots.map((s) => stageTech(s.kind, roles));
  let l = Infinity;
  let r = -Infinity;
  let b = Infinity;
  let t = -Infinity;
  order.forEach((slot, k) => {
    on[slot] = 1;
    const a = angles[k] * RAD;
    const centre = Number.isNaN(a);
    const x = centre ? V.hub[0] : V.hub[0] + RX * Math.cos(a);
    const y = centre ? V.hub[1] : V.hub[1] + V.m * RY * Math.sin(a);
    const z = centre ? 0.15 : V.depth(a);
    pos.set([x, y, z], slot * 3);
    yaw[slot] = centre ? 0 : -0.16 * (x / RX);
    // Labels go outward: above the stages that sit high, below the others; the core's
    // label goes to the open side (below in "M", above in "W").
    label[slot] = centre ? (V.m > 0 ? -1 : 1) : V.m * Math.sin(a) > 0.3 ? 1 : -1;
    const [ex, ey] = EXT[slots[slot].kind];
    const lab = 0.62; // label chip + technology line
    l = Math.min(l, x - ex);
    r = Math.max(r, x + ex);
    b = Math.min(b, y - ey - (label[slot] < 0 ? lab : 0));
    t = Math.max(t, y + ey + (label[slot] > 0 ? lab : 0));
  });
  const title0: [number, number] = [l, t + 0.12];
  t += 0.5; // the title row
  const links: [number, number][] = [];
  for (let k = 1; k < order.length; k++) links.push([order[k - 1], order[k]]);
  // Timeline of one request: dwell in each stage, travel between them.
  const steps: Step[] = [];
  let time = 0.2;
  order.forEach((slot, k) => {
    const dwell = DWELL[slots[slot].kind];
    steps.push({ slot, start: time, dwell, leave: time + dwell });
    time += dwell + (k < order.length - 1 ? TRAVEL : 0);
  });
  return {
    slug: p.slug,
    title: p.title,
    order,
    stages: p.stages,
    on,
    pos,
    yaw,
    label,
    input: roles.input,
    rings: Math.max(1, Math.min(MAX_RINGS, roles.models.length)),
    tech: techLine,
    box: [(l + r) / 2, (b + t) / 2, (r - l) / 2, (t - b) / 2],
    title0,
    links,
    steps,
    cycle: time + HOLD + CLEAR,
  };
}

export function buildModel(ai: NeuralData["ai"], work: NeuralData["work"]): AiModel {
  const generic = ai.length === 0;
  const list = (generic ? GENERIC : ai).map((p) => ({ ...p, stages: p.stages.length ? p.stages : GENERIC[0].stages }));
  const names = mergeVocab(list.map((p) => p.stages)).slice(0, MAX_SLOTS);
  const slots = names.map((name) => ({ name, kind: stageKind(name) }));
  const stack = new Map(work.map((w) => [w.slug, w.stack.map((t) => t.name)]));
  // Every project keeps only the stages that made it into the slots.
  const plans = list.map((p, i) => plan({ ...p, stages: p.stages.filter((s) => names.includes(s)) }, stack.get(p.slug) ?? [], slots, i));
  return { slots, plans, index: new Map(list.map((p, i) => [p.slug, i])), generic };
}
