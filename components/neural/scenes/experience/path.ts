// The experience timeline's path and milestone layout (deterministic, data → numbers).
// The path SHAPE is fixed (a rising S-weave through depth: growth over time); the data
// only decides where each company's milestone sits on it, by cumulative months, so a
// segment's length is proportional to the time spent there.
import { CatmullRomCurve3, Vector3 } from "three";
import type { NeuralData } from "../../types";
import { clamp01 } from "../stack/gl";

const CONTROL: [number, number, number][] = [
  [-8.2, -1.35, 1.2],
  [-5.5, -0.85, -0.45],
  [-2.75, -0.45, 0.85],
  [0, 0.05, -0.7],
  [2.75, 0.55, 0.7],
  [5.5, 1.0, -0.5],
  [8.2, 1.5, 0.6],
];
/** The floor grid sits below the lowest point of the path. */
export const FLOOR_Y = -2.5;
const LEAD = 0.06; // arc fraction before the first milestone
const TAIL = 0.025; // arc fraction after "now"
const LUT_N = 1024;

export const curve = new CatmullRomCurve3(
  CONTROL.map(([x, y, z]) => new Vector3(x, y, z)),
  false,
  "centripetal",
);

// Arc-length-uniform lookup table: per-frame sampling without allocation or searching.
const LUT = new Float32Array((LUT_N + 1) * 3);
{
  const p = new Vector3();
  for (let i = 0; i <= LUT_N; i++) {
    curve.getPointAt(i / LUT_N, p);
    LUT[i * 3] = p.x;
    LUT[i * 3 + 1] = p.y;
    LUT[i * 3 + 2] = p.z;
  }
}

/** Point at arc fraction f (0..1) into `out`, from the lookup table. */
export function pointAt(f: number, out: Vector3): Vector3 {
  const x = clamp01(f) * LUT_N;
  const i = Math.min(LUT_N - 1, Math.floor(x));
  const t = x - i;
  const o = i * 3;
  return out.set(
    LUT[o] + (LUT[o + 3] - LUT[o]) * t,
    LUT[o + 1] + (LUT[o + 4] - LUT[o + 1]) * t,
    LUT[o + 2] + (LUT[o + 5] - LUT[o + 2]) * t,
  );
}

/** Scroll progress → arc fraction of the trail head (drawn by ~88% of the section). */
export const headOf = (progress: number) => clamp01((progress - 0.04) / 0.84);

/**
 * Where the trail head is for a given section progress, in the scene's path space
 * (before the scene's own tilt and centring). The scene already keeps the head centred
 * by moving its group, so the engine does not have to move the camera; an engine that
 * wants to add its own look-ahead can use this.
 */
export function cameraTarget(progress: number, out: Vector3 = new Vector3()): Vector3 {
  return pointAt(headOf(progress), out);
}

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
  /** Arc fraction where this role starts. */
  f: number;
  /** Arc fraction where it ends (the next start, or "now"). */
  end: number;
};

export type Timeline = {
  milestones: Milestone[];
  /** Arc fractions of the quarter-year ticks (segment length ∝ months). */
  ticks: number[];
  /** Arc fraction of "now" (end of the last role). */
  now: number;
};

export function layoutTimeline(data: NeuralData): Timeline {
  const roles = data.experience;
  const total = Math.max(1, roles.reduce((s, r) => s + Math.max(1, r.months), 0));
  const span = 1 - LEAD - TAIL;
  let cum = 0;
  const milestones = roles.map((r) => {
    const f = LEAD + (span * cum) / total;
    cum += Math.max(1, r.months);
    return {
      company: r.company,
      role: r.role,
      years: yearsLabel(r.period),
      current: r.current,
      f,
      end: LEAD + (span * cum) / total,
    };
  });
  const ticks: number[] = [];
  for (let m = 3; m < total; m += 3) ticks.push(LEAD + (span * m) / total);
  return { milestones, ticks, now: LEAD + span };
}
