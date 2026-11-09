// The experience timeline (deterministic, data → numbers) and the path it is drawn on.
// The path is laid out in SCREEN space every frame, then lifted into the world: on the home
// journey each milestone sits exactly on its role's rail dot ([data-exp-node]) while the
// track moves; elsewhere it is laid out inside the free part of the viewport the scene owns.
// Control points, in order: lead · M0 · A0 · M1 · A1 … M(n-1) · A(n-1) · now, where M are
// the milestones and A the arcs between them (lifted and pushed into depth, so the trail
// weaves through 3D). A uniform Catmull-Rom spline runs through them, evaluated identically
// here (CPU: milestones, ticks, head, packets) and in the ribbon's vertex shader (GPU).
import type { Vector3 } from "three";
import type { NeuralData } from "../../types";

export const MAX_ROLES = 8;
export const MAX_POINTS = 2 * MAX_ROLES + 2;

/** "Sept 2021 - Dec 2022" → "2021–2022"; "Feb 2024 - Present" → "2024–now". */
export function yearsLabel(period: string): string {
  const years = period.match(/\b(19|20)\d{2}\b/g) ?? [];
  const current = /present|now|current/i.test(period);
  const start = years[0];
  const end = current ? "now" : years[years.length - 1];
  if (!start) return current ? "now" : period;
  return !end || end === start ? start : `${start}–${end}`;
}

export type Milestone = {
  company: string;
  role: string;
  years: string;
  current: boolean;
  months: number;
  /** 0..1: how high its stop stands (oldest lowest), as the DOM stems (--rise). */
  rise: number;
};

export type Timeline = {
  milestones: Milestone[];
  /** Control-point count (2n + 2), 0 without roles. */
  count: number;
  /** Quarter-year ticks as path parameters (control-point units). */
  ticks: number[];
};

/** Path parameter (control-point units) of milestone i; "now" is count - 1. */
export const milestoneS = (i: number) => 1 + 2 * i;

export function layoutTimeline(data: NeuralData): Timeline {
  const roles = data.experience.slice(-MAX_ROLES);
  const n = roles.length;
  const milestones = roles.map((r, i) => ({
    company: r.company,
    role: r.role,
    years: yearsLabel(r.period),
    current: r.current,
    months: Math.max(1, r.months),
    rise: n > 1 ? i / (n - 1) : 0.5,
  }));
  // Role i runs from its milestone to the next one (the last one to "now"): one tick per
  // quarter it lasted, evenly along that stretch.
  const ticks: number[] = [];
  milestones.forEach((m, i) => {
    for (let q = 3; q < m.months; q += 3) ticks.push(milestoneS(i) + (2 * q) / m.months);
  });
  return { milestones, count: n ? 2 * n + 2 : 0, ticks };
}

/**
 * Uniform Catmull-Rom through `count` points (xyz triplets in `p`), phantom end points
 * mirrored; s in control-point units (0 … count-1). Mirrors pathAt() in the ribbon shader.
 */
export function evalPath(p: Float32Array, count: number, s: number, out: Vector3): Vector3 {
  const n1 = count - 1;
  const c = s < 0 ? 0 : s > n1 ? n1 : s;
  const i = Math.min(Math.floor(c), n1 - 1);
  const t = c - i;
  const t2 = t * t;
  const t3 = t2 * t;
  const b1 = i * 3;
  const b2 = b1 + 3;
  const b0 = i > 0 ? b1 - 3 : -1;
  const b3 = i + 2 <= n1 ? b2 + 3 : -1;
  const v = (k: number) => {
    const p1 = p[b1 + k];
    const p2 = p[b2 + k];
    const p0 = b0 < 0 ? 2 * p1 - p2 : p[b0 + k];
    const p3 = b3 < 0 ? 2 * p2 - p1 : p[b3 + k];
    return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
  };
  return out.set(v(0), v(1), v(2));
}

/** GLSL twin of evalPath (uP = the points, uN = count). */
export const PATH_GLSL = /* glsl */ `
  uniform vec3 uP[${MAX_POINTS}];
  uniform float uN;
  vec3 pathAt(float s) {
    float n1 = uN - 1.0;
    s = clamp(s, 0.0, n1);
    float fi = min(floor(s), n1 - 1.0);
    float t = s - fi;
    int i = int(fi);
    vec3 p1 = uP[i];
    vec3 p2 = uP[i + 1];
    vec3 p0 = i > 0 ? uP[i - 1] : 2.0 * p1 - p2;
    vec3 p3 = fi + 2.0 <= n1 ? uP[min(i + 2, ${MAX_POINTS - 1})] : 2.0 * p2 - p1;
    float t2 = t * t;
    float t3 = t2 * t;
    return 0.5 * (2.0 * p1 + (-p0 + p2) * t + (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * t2 + (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * t3);
  }
`;

/** Screen layout of the control points: x, y in CSS px, z = world depth. */
export type ScreenPath = { x: Float32Array; y: Float32Array; z: Float32Array };

export const screenPath = (): ScreenPath => ({
  x: new Float32Array(MAX_POINTS),
  y: new Float32Array(MAX_POINTS),
  z: new Float32Array(MAX_POINTS),
});

/** Depth of the arcs between milestones: alternately behind and in front of the dots. */
const ARC_Z = [-2.6, 1.1];

/**
 * Fill the arcs (A) and the depths once the lead, milestones and "now" are placed.
 * `lift` = px an arc rises above the higher of its two ends; `top` = highest y allowed.
 */
export function fillArcs(sp: ScreenPath, count: number, lift: number, top: number) {
  for (let k = 2; k < count - 1; k += 2) {
    sp.x[k] = (sp.x[k - 1] + sp.x[k + 1]) / 2;
    sp.y[k] = Math.max(top, Math.min(sp.y[k - 1], sp.y[k + 1]) - lift);
    sp.z[k] = ARC_Z[(k / 2 - 1) % 2];
  }
  for (let k = 1; k < count - 1; k += 2) sp.z[k] = 0;
  sp.z[0] = 0.6;
  sp.z[count - 1] = 0;
}
