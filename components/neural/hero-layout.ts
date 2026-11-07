// The hero "neural core": a brain built from particle-neurons, shared by the server poster
// (poster.tsx) and the WebGL scene (scenes/hero.tsx), so the poster is a projection of the
// very brain the canvas assembles. Pure and deterministic (seeded): no three.js, no DOM.
//
// Local space: x = lateral (right hemisphere +x), y = up, z = front. The brain spans about
// z -1..1, y -1.1..0.8 (brain stem included), x -0.8..0.8. Its surface is the radial
// envelope of a few anatomical ellipsoids (two hemispheres of frontal / parietal /
// temporal / occipital lobes, the cerebellum, the stem); gradient noise draws the folds.

/** Vertical field of view of the shared camera (degrees). */
export const FOV = 40;
/** Camera distance for scenes without their own rig (they are built around the origin). */
export const DEFAULT_DISTANCE = 14;

export type CameraTarget = { px: number; py: number; pz: number; lx: number; ly: number; lz: number };

/**
 * Hero camera: the default framing, pulling back a little as the hero scrolls away, so the
 * next scene arrives with a gentle dolly-in. The brain itself is placed relative to the
 * camera (scenes/hero.tsx), so this never moves it on screen.
 */
export function heroCamera(_aspect: number, progress: number, out: CameraTarget): CameraTarget {
  out.px = out.py = out.lx = out.ly = out.lz = 0;
  out.pz = DEFAULT_DISTANCE + Math.max(0, progress - 0.5) * 8;
  return out;
}

/** Resting orientation (radians): a three-quarter view from the left-front and a little above, frontal lobe toward the text. */
export const BASE_YAW = -1.02;
export const BASE_PITCH = 0.3;
/** Half extents of the brain in its resting view (local units), used to fit it into its box. */
export const VIEW_HALF = { w: 1.12, h: 1.0 };

/** Neuron kinds (the `kind` array). */
export const KIND = { fill: 0, fold: 1, inner: 2, hub: 3 } as const;

export type Counts = { fold: number; fill: number; inner: number; hubs: number; long: number; signals: number };
export const COUNTS: Record<"high" | "low" | "poster", Counts> = {
  high: { fold: 4600, fill: 3300, inner: 1300, hubs: 220, long: 64, signals: 96 },
  low: { fold: 2200, fill: 1600, inner: 560, hubs: 110, long: 34, signals: 48 },
  poster: { fold: 230, fill: 150, inner: 0, hubs: 34, long: 14, signals: 0 },
};

export type BrainLayout = {
  /** xyz per neuron (hubs last). */
  pos: Float32Array;
  /** KIND per neuron. */
  kind: Uint8Array;
  /** 0..1 per neuron (stable random). */
  seed: Float32Array;
  /** Neuron index of the first hub; hubs run to the end. */
  hubStart: number;
  /** Synapse arcs: p0, control, p2 (9 floats each). */
  arcs: Float32Array;
  /** Per arc: 0 = short arc over the surface, 1 = long arc through the core. */
  arcKind: Uint8Array;
};

/** mulberry32: small seeded PRNG, so server poster and client scene agree. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- shape -------------------------------------------------------------------------------

/** [cx, cy, cz, rx, ry, rz, region]; hemisphere parts are mirrored in x. Region: 0 cerebrum, 1 cerebellum, 2 stem. */
type Ellipsoid = readonly [number, number, number, number, number, number, number];
const HALF: readonly Ellipsoid[] = [
  [0.33, 0.12, -0.08, 0.47, 0.66, 0.93, 0], // parietal / main mass
  [0.3, 0.2, 0.4, 0.43, 0.5, 0.6, 0], // frontal
  [0.5, -0.27, 0.1, 0.3, 0.3, 0.56, 0], // temporal
  [0.28, 0.02, -0.62, 0.4, 0.47, 0.42, 0], // occipital
  [0.26, -0.5, -0.6, 0.31, 0.23, 0.33, 1], // cerebellum
];
const ELLIPSOIDS: readonly Ellipsoid[] = [
  ...HALF,
  ...HALF.map((e): Ellipsoid => [-e[0], e[1], e[2], e[3], e[4], e[5], e[6]]),
  [0, -0.68, -0.2, 0.15, 0.42, 0.16, 2], // stem
  [0, -0.5, -0.08, 0.2, 0.18, 0.19, 2], // pons
];
/** The star centre rays are cast from. */
const O = [0, 0.02, -0.05] as const;

/** Radial envelope along a unit direction from O: distance and the region that produced it. */
function envelope(dx: number, dy: number, dz: number, out: { r: number; region: number }) {
  let best = 0;
  let region = 0;
  for (const [cx, cy, cz, rx, ry, rz, reg] of ELLIPSOIDS) {
    // Ray O + t·d against ((p - c) / r)² = 1, far root.
    const ox = (O[0] - cx) / rx, oy = (O[1] - cy) / ry, oz = (O[2] - cz) / rz;
    const ux = dx / rx, uy = dy / ry, uz = dz / rz;
    const a = ux * ux + uy * uy + uz * uz;
    const b = ox * ux + oy * uy + oz * uz;
    const c = ox * ox + oy * oy + oz * oz - 1;
    const disc = b * b - a * c;
    if (disc <= 0) continue;
    const t = (-b + Math.sqrt(disc)) / a;
    if (t > best) {
      best = t;
      region = reg;
    }
  }
  out.r = best;
  out.region = region;
  return out;
}

// The envelope tabulated over the sampling parameters (u = dy in -1..1, a = azimuth), so
// thousands of samples cost a bilinear lookup each instead of a dozen ray casts.
const NU = 96;
const NA = 192;
let table: { r: Float32Array; region: Uint8Array } | null = null;
function* envelopeTable(): Generator<void, { r: Float32Array; region: Uint8Array }> {
  if (table) return table;
  const r = new Float32Array((NU + 1) * (NA + 1));
  const region = new Uint8Array((NU + 1) * (NA + 1));
  const e = { r: 0, region: 0 };
  for (let i = 0; i <= NU; i++) {
    if ((i & 7) === 7) yield;
    const u = (i / NU) * 2 - 1;
    const q = Math.sqrt(Math.max(0, 1 - u * u));
    for (let j = 0; j <= NA; j++) {
      const a = (j / NA) * Math.PI * 2;
      envelope(q * Math.cos(a), u, q * Math.sin(a), e);
      r[i * (NA + 1) + j] = e.r;
      region[i * (NA + 1) + j] = e.region;
    }
  }
  return (table = { r, region });
}
function lookup(t: { r: Float32Array; region: Uint8Array }, u: number, a: number, out: { r: number; region: number }) {
  const fi = ((u + 1) / 2) * NU, fj = (a / (Math.PI * 2)) * NA;
  const i = Math.min(NU - 1, Math.floor(fi)), j = Math.min(NA - 1, Math.floor(fj));
  const di = fi - i, dj = fj - j;
  const o = i * (NA + 1) + j;
  const r0 = t.r[o] + (t.r[o + 1] - t.r[o]) * dj;
  const r1 = t.r[o + NA + 1] + (t.r[o + NA + 2] - t.r[o + NA + 1]) * dj;
  out.r = r0 + (r1 - r0) * di;
  out.region = t.region[o + (di > 0.5 ? NA + 1 : 0) + (dj > 0.5 ? 1 : 0)];
  return out;
}

/** Seeded 3D gradient noise (Perlin "improved"), about -0.9..0.9. */
function makeNoise(seed: number) {
  const rand = rng(seed);
  const perm = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  const p = new Uint8Array(512);
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (t: number, a: number, b: number) => a + t * (b - a);
  const grad = (h: number, x: number, y: number, z: number) => {
    const g = h & 15;
    const u = g < 8 ? x : y;
    const v = g < 4 ? y : g === 12 || g === 14 ? x : z;
    return ((g & 1) === 0 ? u : -u) + ((g & 2) === 0 ? v : -v);
  };
  return (x: number, y: number, z: number) => {
    const fx = Math.floor(x), fy = Math.floor(y), fz = Math.floor(z);
    const X = fx & 255, Y = fy & 255, Z = fz & 255;
    x -= fx;
    y -= fy;
    z -= fz;
    const u = fade(x), v = fade(y), w = fade(z);
    const A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z, B = p[X + 1] + Y, BA = p[B] + Z, BB = p[B + 1] + Z;
    return lerp(
      w,
      lerp(v, lerp(u, grad(p[AA], x, y, z), grad(p[BA], x - 1, y, z)), lerp(u, grad(p[AB], x, y - 1, z), grad(p[BB], x - 1, y - 1, z))),
      lerp(
        v,
        lerp(u, grad(p[AA + 1], x, y, z - 1), grad(p[BA + 1], x - 1, y, z - 1)),
        lerp(u, grad(p[AB + 1], x, y - 1, z - 1), grad(p[BB + 1], x - 1, y - 1, z - 1)),
      ),
    );
  };
}

const FOLD_FREQ = 3.1;
const FOLD_BAND = 0.07;

/**
 * Builds the brain. Surface neurons are sampled over the envelope: "fold" neurons trace the
 * gyri (zero lines of the gradient noise on the cerebrum, the parallel folia on the
 * cerebellum), "fill" neurons cover the surface evenly, "inner" ones glow inside, and
 * evenly spaced "hub" neurons anchor the synapse arcs (short arcs between neighbouring
 * hubs over the surface, long arcs through the core between distant hubs).
 */
export function brainLayout(counts: Counts, seed = 11): BrainLayout {
  const job = brainSteps(counts, seed);
  for (;;) {
    const r = job.next();
    if (r.done) return r.value;
  }
}

/**
 * The same build as a generator that yields every few hundred samples, so the browser can
 * spread it over frames (a few ms each) instead of one long task.
 */
export function* brainSteps(counts: Counts, seed = 11): Generator<void, BrainLayout> {
  const tab = yield* envelopeTable();
  let tick = 0;
  const rand = rng(seed);
  const noise = makeNoise(seed + 1);
  const total = counts.fold + counts.fill + counts.inner + counts.hubs;
  const pos = new Float32Array(total * 3);
  const kind = new Uint8Array(total);
  const seeds = new Float32Array(total);
  const env = { r: 0, region: 0 };
  let k = 0;
  const put = (x: number, y: number, z: number, lift: number, kd: number) => {
    pos[k * 3] = O[0] + (x - O[0]) * lift;
    pos[k * 3 + 1] = O[1] + (y - O[1]) * lift;
    pos[k * 3 + 2] = O[2] + (z - O[2]) * lift;
    kind[k] = kd;
    seeds[k] = rand();
    k++;
  };

  // A surface sample: a random direction and its envelope point, roughly area-uniform.
  const s = { x: 0, y: 0, z: 0, region: 0 };
  const sample = () => {
    for (;;) {
      const u = rand() * 2 - 1;
      const a = rand() * Math.PI * 2;
      const q = Math.sqrt(1 - u * u);
      const dx = q * Math.cos(a), dy = u, dz = q * Math.sin(a);
      lookup(tab, u, a, env);
      if (env.r <= 0) continue;
      // Area weighting (rays fan out with r²); 1.15 ≈ the largest radius.
      if (rand() > (env.r * env.r) / (1.15 * 1.15)) continue;
      s.x = O[0] + dx * env.r;
      s.y = O[1] + dy * env.r;
      s.z = O[2] + dz * env.r;
      s.region = env.region;
      return s;
    }
  };
  // The longitudinal fissure: few neurons right on the midline of the cerebrum's top.
  const fissure = () => Math.abs(s.x) < 0.05 && s.y > -0.1;

  let fold = 0;
  let guard = 0;
  while (fold < counts.fold && guard++ < counts.fold * 40) {
    if ((++tick & 1023) === 0) yield;
    sample();
    if (s.region === 2 || fissure()) continue;
    let on: boolean;
    if (s.region === 1) {
      // Cerebellum folia: thin parallel bands, gently curved.
      const v = s.y + 0.5 + 0.3 * (s.z + 0.6) ** 2;
      on = Math.abs((v * 15) - Math.floor(v * 15) - 0.5) > 0.38;
    } else {
      on = Math.abs(noise(s.x * FOLD_FREQ, s.y * FOLD_FREQ, s.z * FOLD_FREQ)) < FOLD_BAND;
    }
    if (!on) continue;
    // Gyri crests sit a touch proud of the surface.
    put(s.x, s.y, s.z, 1.012, KIND.fold);
    fold++;
  }
  for (let i = 0; i < counts.fill; ) {
    if ((++tick & 1023) === 0) yield;
    sample();
    if (fissure() && rand() < 0.7) continue;
    // Sulci sink a little below the crests.
    put(s.x, s.y, s.z, 0.985, KIND.fill);
    i++;
  }
  for (let i = 0; i < counts.inner; i++) {
    sample();
    put(s.x, s.y, s.z, 0.35 + 0.55 * Math.cbrt(rand()), KIND.inner);
  }

  // Hubs: evenly spaced over the cerebrum and cerebellum (dart throwing, shrinking radius).
  const hubStart = k;
  const hubs: number[] = [];
  let minD = counts.hubs > 100 ? 0.2 : 0.3;
  guard = 0;
  while (hubs.length < counts.hubs && guard++ < counts.hubs * 400) {
    if ((++tick & 255) === 0) yield;
    sample();
    if (s.region === 2) continue;
    let ok = true;
    for (let h = 0; h < hubs.length && ok; h++) {
      const o = hubs[h] * 3;
      const dx = pos[o] - s.x, dy = pos[o + 1] - s.y, dz = pos[o + 2] - s.z;
      if (dx * dx + dy * dy + dz * dz < minD * minD) ok = false;
    }
    if (!ok) {
      if (guard % 300 === 0) minD *= 0.93;
      continue;
    }
    hubs.push(k);
    put(s.x, s.y, s.z, 1.01, KIND.hub);
  }
  const n = k;

  const arcs: number[] = [];
  const arcKind: number[] = [];
  const arc = (a: number, b: number, bow: number, kd: number) => {
    const ax = pos[a * 3], ay = pos[a * 3 + 1], az = pos[a * 3 + 2];
    const bx = pos[b * 3], by = pos[b * 3 + 1], bz = pos[b * 3 + 2];
    const mx = (ax + bx) / 2 - O[0], my = (ay + by) / 2 - O[1], mz = (az + bz) / 2 - O[2];
    arcs.push(ax, ay, az, O[0] + mx * bow, O[1] + my * bow, O[2] + mz * bow, bx, by, bz);
    arcKind.push(kd);
  };
  const d2 = (a: number, b: number) =>
    (pos[a * 3] - pos[b * 3]) ** 2 + (pos[a * 3 + 1] - pos[b * 3 + 1]) ** 2 + (pos[a * 3 + 2] - pos[b * 3 + 2]) ** 2;
  // Short arcs: each hub to its two nearest hubs, bowed outward over the surface.
  const seen = new Set<number>();
  for (const a of hubs) {
    if ((++tick & 63) === 0) yield;
    let b1 = -1, b2 = -1, d1 = Infinity, dd2 = Infinity;
    for (const b of hubs) {
      if (b === a) continue;
      const d = d2(a, b);
      if (d < d1) {
        b2 = b1;
        dd2 = d1;
        b1 = b;
        d1 = d;
      } else if (d < dd2) {
        b2 = b;
        dd2 = d;
      }
    }
    for (const b of [b1, b2]) {
      if (b < 0) continue;
      const key = Math.min(a, b) * 65536 + Math.max(a, b);
      if (seen.has(key)) continue;
      seen.add(key);
      arc(a, b, 1.05, 0);
    }
  }
  // Long arcs: distant hub pairs, pulled through the core.
  guard = 0;
  let long = 0;
  while (long < counts.long && guard++ < counts.long * 50 && hubs.length > 2) {
    const a = hubs[Math.floor(rand() * hubs.length)];
    const b = hubs[Math.floor(rand() * hubs.length)];
    if (d2(a, b) < 0.8) continue;
    arc(a, b, 0.25 + rand() * 0.3, 1);
    long++;
  }

  return {
    pos: pos.subarray(0, n * 3),
    kind: kind.subarray(0, n),
    seed: seeds.subarray(0, n),
    hubStart,
    arcs: Float32Array.from(arcs),
    arcKind: Uint8Array.from(arcKind),
  };
}

/** Local → view rotation (yaw about y, then pitch about x: three's XYZ Euler applied to a vector). */
export function orient(x: number, y: number, z: number, yaw: number, pitch: number): [number, number, number] {
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const x1 = x * cy + z * sy;
  const z1 = -x * sy + z * cy;
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  return [x1, y * cp - z1 * sp, y * sp + z1 * cp];
}
