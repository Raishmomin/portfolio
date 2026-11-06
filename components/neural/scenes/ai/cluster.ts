// The LLM stage geometry: a small, dense neural network (5 layers of neurons ringed
// round the data pipe, fully connected layer to layer, 240 synapses). Built once,
// deterministically; signals and flicker are animated in the shaders.
import { BufferAttribute, BufferGeometry, type Color } from "three";
import { rng } from "./shared";

const LAYERS = [6, 10, 12, 10, 6];
const SPACING = 0.27;

export function buildCluster() {
  const rand = rng(7);
  const nodes: number[][] = [];
  const layerOf: number[] = [];
  LAYERS.forEach((count, l) => {
    const r = 0.16 + 0.04 * count;
    const twist = rand() * Math.PI;
    for (let i = 0; i < count; i++) {
      const a = twist + (i / count) * Math.PI * 2;
      const rr = r * (0.82 + 0.18 * rand());
      nodes.push([(l - (LAYERS.length - 1) / 2) * SPACING + (rand() - 0.5) * 0.06, Math.cos(a) * rr, Math.sin(a) * rr]);
      layerOf.push(l);
    }
  });
  const n = nodes.length;
  const pos = new Float32Array(n * 3);
  const size = new Float32Array(n);
  const phase = new Float32Array(n);
  const tint = new Float32Array(n);
  nodes.forEach((p, i) => {
    pos.set(p, i * 3);
    size[i] = 0.1 + rand() * 0.06;
    phase[i] = rand();
    tint[i] = rand() * 0.35;
  });
  const points = new BufferGeometry();
  points.setAttribute("position", new BufferAttribute(pos, 3));
  points.setAttribute("aColor", new BufferAttribute(new Float32Array(n * 3), 3));
  points.setAttribute("aSize", new BufferAttribute(size, 1));
  points.setAttribute("aPhase", new BufferAttribute(phase, 1));

  const seg: number[] = [];
  const end: number[] = [];
  const ph: number[] = [];
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      if (layerOf[j] !== layerOf[i] + 1) continue;
      const p = rand();
      seg.push(...nodes[i], ...nodes[j]);
      end.push(0, 1);
      ph.push(p, p);
    }
  const lines = new BufferGeometry();
  lines.setAttribute("position", new BufferAttribute(new Float32Array(seg), 3));
  lines.setAttribute("aEnd", new BufferAttribute(new Float32Array(end), 1));
  lines.setAttribute("aPhase", new BufferAttribute(new Float32Array(ph), 1));

  /** Neuron colours: the AI accent, some tinted toward the foreground. */
  const paint = (ai: Color, fg: Color) => {
    const col = points.getAttribute("aColor") as BufferAttribute;
    for (let i = 0; i < n; i++) {
      const t = tint[i];
      col.setXYZ(i, ai.r + (fg.r - ai.r) * t, ai.g + (fg.g - ai.g) * t, ai.b + (fg.b - ai.b) * t);
    }
    col.needsUpdate = true;
  };
  return { points, lines, paint };
}
