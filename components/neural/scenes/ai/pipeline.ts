// Pure model for the AI scene: the union of every project's stages, each project's
// stage positions along one fixed pipe, and the pipe path itself (CPU + GLSL twins).
import { Curve, Vector3 } from "three";
import type { NeuralData } from "../../types";

export type StageKind = "io" | "speech" | "rag" | "agent" | "llm" | "generic";
export const MAX_STAGES = 8;
/** Pipe length in world units (x from -W/2 to W/2). */
export const PATH_W = 10;
const MAX_GAP = 0.3; // in path t: widest spacing between two stages

export function stageKind(name: string): StageKind {
  if (/\b(llm|gpt|model|claude|gemini)\b/i.test(name)) return "llm";
  if (/speech|voice|tts|stt|audio|whisper/i.test(name)) return "speech";
  if (/retriev|rag|vector|embed|search|knowledge/i.test(name)) return "rag";
  if (/agent|tool/i.test(name)) return "agent";
  if (/^(input|output)$/i.test(name.trim())) return "io";
  return "generic";
}

export type PipelineModel = {
  /** Every distinct stage across projects, in pipeline order. */
  vocab: { name: string; kind: StageKind }[];
  projects: { slug: string; title: string }[];
  /** [project][vocab] position along the pipe (0..1) and presence (0/1). */
  t: number[][];
  present: number[][];
  index: Map<string, number>;
  /** No AI projects in the DB: a generic, unlabeled pipeline. */
  generic: boolean;
};

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

export function buildPipeline(ai: NeuralData["ai"]): PipelineModel {
  const generic = ai.length === 0;
  const list = (generic ? GENERIC : ai).map((p) => ({ ...p, stages: p.stages.length ? p.stages : GENERIC[0].stages }));
  const names = mergeVocab(list.map((p) => p.stages)).slice(0, MAX_STAGES);
  const t: number[][] = [];
  const present: number[][] = [];
  for (const p of list) {
    const own = names.filter((n) => p.stages.includes(n));
    const gap = own.length > 1 ? Math.min(MAX_GAP, 1 / (own.length - 1)) : 0;
    const start = 0.5 - (gap * (own.length - 1)) / 2;
    const pos = names.map((n) => {
      const k = own.indexOf(n);
      return k < 0 ? Number.NaN : start + k * gap;
    });
    // A stage this project lacks waits between its neighbours, so it grows in place on a morph.
    const filled = pos.map((v, i) => {
      if (!Number.isNaN(v)) return v;
      let a = i - 1;
      while (a >= 0 && Number.isNaN(pos[a])) a--;
      let b = i + 1;
      while (b < pos.length && Number.isNaN(pos[b])) b++;
      const ta = a >= 0 ? pos[a] : start;
      const tb = b < pos.length ? pos[b] : start + gap * (own.length - 1);
      return (ta + tb) / 2;
    });
    t.push(filled);
    present.push(pos.map((v) => (Number.isNaN(v) ? 0 : 1)));
  }
  return {
    vocab: names.map((name) => ({ name, kind: stageKind(name) })),
    projects: list.map(({ slug, title }) => ({ slug, title })),
    t,
    present,
    index: new Map(list.map((p, i) => [p.slug, i])),
    generic,
  };
}

// The pipe: a gentle S in y and a bow toward the viewer in z, so it reads as 3D.
const TAU = Math.PI * 2;
export function pathAt(t: number, out: Vector3): Vector3 {
  return out.set((t - 0.5) * PATH_W, 0.32 * Math.sin(TAU * t), 0.7 * Math.sin(Math.PI * t) - 0.35);
}
export function tangentAt(t: number, out: Vector3): Vector3 {
  return out.set(PATH_W, 0.32 * TAU * Math.cos(TAU * t), 0.7 * Math.PI * Math.cos(Math.PI * t)).normalize();
}
export const PATH_GLSL = /* glsl */ `
vec3 pathAt(float t) {
  return vec3((t - 0.5) * ${PATH_W.toFixed(1)}, 0.32 * sin(6.2831853 * t), 0.7 * sin(3.14159265 * t) - 0.35);
}
`;

/** The same path as a three Curve, parameterised by t (not arc length) so tube uv.x === t. */
export class PipeCurve extends Curve<Vector3> {
  constructor() {
    super();
  }
  getPoint(t: number, target = new Vector3()) {
    return pathAt(t, target);
  }
  getPointAt(u: number, target = new Vector3()) {
    return pathAt(u, target);
  }
  getTangent(t: number, target = new Vector3()) {
    return tangentAt(t, target);
  }
  getTangentAt(u: number, target = new Vector3()) {
    return tangentAt(u, target);
  }
}
