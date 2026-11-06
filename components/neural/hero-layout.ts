// The hero network's geometry and camera rig, shared by the server poster (poster.tsx)
// and the WebGL scene (scenes/hero.tsx), so the poster is a projection of the very
// network the canvas fades in over. Pure and deterministic: no three.js, no DOM.

/** Nodes per layer, input → output. "low" quality halves them. */
export const LAYERS: Record<"high" | "low", readonly number[]> = { high: [8, 14, 18, 14, 8], low: [4, 7, 9, 7, 4] };
export const PARTICLES: Record<"high" | "low", number> = { high: 96, low: 48 };
/** World units between layers along x. */
export const LAYER_GAP = 2.6;
/** The network's resting orientation (radians): a three-quarter view so each layer reads as a disc. */
export const BASE_YAW = -0.42;
export const BASE_PITCH = 0.14;
/** Vertical field of view of the shared camera (degrees). */
export const FOV = 40;

export type HeroLayout = {
  /** xyz per node, group-local. */
  nodes: Float32Array;
  /** Layer index per node. */
  layer: Uint8Array;
  /** Node index pairs (source in layer l, target in l + 1). */
  edges: Uint16Array;
  /** One node per layer for each particle route (input → output). */
  routes: Uint16Array;
  layers: number;
};

/** mulberry32: small seeded PRNG, so server poster and client scene agree. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GOLDEN = Math.PI * (3 - Math.sqrt(5));

export function heroLayout(sizes: readonly number[] = LAYERS.high, routeCount = PARTICLES.high, seed = 7): HeroLayout {
  const rand = rng(seed);
  const total = sizes.reduce((s, n) => s + n, 0);
  const nodes = new Float32Array(total * 3);
  const layer = new Uint8Array(total);
  const start: number[] = [];
  const mid = (sizes.length - 1) / 2;
  // Fewer nodes ("low") spread over the same discs, so the silhouette never shrinks.
  const spread = 62 / total;
  let k = 0;
  sizes.forEach((n, l) => {
    start.push(k);
    // Each layer is a sunflower disc in the y–z plane, flatter in depth.
    const ry = 0.9 + n * 0.14 * spread;
    const rz = ry * 0.6;
    for (let i = 0; i < n; i++, k++) {
      const r = Math.sqrt((i + 0.5) / n);
      const a = i * GOLDEN + l * 1.1;
      nodes[k * 3] = (l - mid) * LAYER_GAP + (rand() - 0.5) * 0.3;
      nodes[k * 3 + 1] = ry * r * Math.cos(a);
      nodes[k * 3 + 2] = rz * r * Math.sin(a);
      layer[k] = l;
    }
  });
  start.push(total);

  // Each node feeds its nearest few in the next layer; every node gets an input.
  const fanOut = sizes[0] >= 8 ? 4 : 3;
  const edges: number[] = [];
  const out: number[][] = Array.from({ length: total }, () => []);
  const dist = (a: number, b: number) =>
    (nodes[a * 3 + 1] - nodes[b * 3 + 1]) ** 2 + (nodes[a * 3 + 2] - nodes[b * 3 + 2]) ** 2;
  for (let l = 0; l < sizes.length - 1; l++) {
    const next = Array.from({ length: sizes[l + 1] }, (_, j) => start[l + 1] + j);
    const fed = new Set<number>();
    for (let a = start[l]; a < start[l + 1]; a++) {
      const near = [...next].sort((x, y) => dist(a, x) - dist(a, y)).slice(0, fanOut);
      for (const b of near) {
        edges.push(a, b);
        out[a].push(b);
        fed.add(b);
      }
    }
    for (const b of next) {
      if (fed.has(b)) continue;
      let best = start[l];
      for (let a = start[l]; a < start[l + 1]; a++) if (dist(a, b) < dist(best, b)) best = a;
      edges.push(best, b);
      out[best].push(b);
    }
  }

  // Signal routes: random walks along real edges from an input to an output node.
  const routes = new Uint16Array(routeCount * sizes.length);
  for (let r = 0; r < routeCount; r++) {
    let n = start[0] + Math.floor(rand() * sizes[0]);
    routes[r * sizes.length] = n;
    for (let l = 1; l < sizes.length; l++) {
      n = out[n][Math.floor(rand() * out[n].length)];
      routes[r * sizes.length + l] = n;
    }
  }
  return { nodes, layer, edges: Uint16Array.from(edges), routes, layers: sizes.length };
}

/** Hero framing: camera distance, and the share of the half-width the network sits right of centre. */
export const HERO_DISTANCE = 16.5;
export const HERO_SHIFT = 0.36;

export type CameraTarget = { px: number; py: number; pz: number; lx: number; ly: number; lz: number };

/** Camera distance for scenes without their own rig (they are built around the origin). */
export const DEFAULT_DISTANCE = 14;

/** Portrait viewports stand the network upright (input at the top). */
export const isPortrait = (aspect: number) => aspect < 0.95;

/**
 * Hero camera: on wide screens the camera slides left so the network fills the right
 * side and the h1 sits over calm space; it pulls back as the visitor scrolls on.
 */
export function heroCamera(aspect: number, progress: number, out: CameraTarget): CameraTarget {
  const dist = HERO_DISTANCE + progress * 7;
  const halfW = Math.tan(((FOV / 2) * Math.PI) / 180) * dist * aspect;
  const shift = isPortrait(aspect) ? 0 : -halfW * Math.min(HERO_SHIFT, 0.16 + (aspect - 0.95) * 0.3);
  out.px = shift;
  out.py = progress * 1.2;
  out.pz = dist;
  out.lx = shift;
  out.ly = progress * 0.6;
  out.lz = 0;
  return out;
}

/** Group-local → camera-space rotation used by the poster (pitch about x after yaw about y). */
export function orient(x: number, y: number, z: number, yaw: number, pitch: number): [number, number, number] {
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const x1 = x * cy + z * sy;
  const z1 = -x * sy + z * cy;
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  return [x1, y * cp - z1 * sp, y * sp + z1 * cp];
}
