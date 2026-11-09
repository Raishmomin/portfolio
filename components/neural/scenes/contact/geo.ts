// Real-world geometry for the contact globe: where the city is, where the sun is right
// now (so the day/night terminator is the real one) and the city's wall-clock time.
// Globe-local frame: y = north pole, longitude 0 toward +z, east toward +x.
import type { Vector3 } from "three";

const RAD = Math.PI / 180;

/** Coordinates of the profile city (a public geographic fact, keyed by NeuralData.facts.city). */
export const CITY_GEO: Record<string, { lat: number; lon: number }> = {
  Ahmedabad: { lat: 23.0225, lon: 72.5714 },
};

/** Unit vector of a latitude / longitude (degrees) in the globe-local frame. */
export function geoDir(lat: number, lon: number, out: Vector3): Vector3 {
  const p = lat * RAD;
  const l = lon * RAD;
  return out.set(Math.cos(p) * Math.sin(l), Math.sin(p), Math.cos(p) * Math.cos(l));
}

/**
 * The subsolar point (degrees) at a UTC instant: the low-precision solar ephemeris of the
 * Astronomical Almanac (about 0.01° here), plenty to place the terminator.
 */
export function subsolar(ms: number, out: { lat: number; lon: number }) {
  const d = (ms - 946_728_000_000) / 86_400_000; // days since J2000.0 (2000-01-01 12:00 UTC)
  const L = 280.46 + 0.9856474 * d;
  const g = (357.528 + 0.9856003 * d) * RAD;
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD;
  const eps = (23.439 - 0.0000004 * d) * RAD;
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda)) / RAD;
  const gmst = 280.46061837 + 360.98564736629 * d; // degrees
  out.lat = Math.asin(Math.sin(eps) * Math.sin(lambda)) / RAD;
  out.lon = ((((ra - gmst + 180) % 360) + 360) % 360) - 180;
  return out;
}

/** "HH:MM" (24 h) at a UTC offset in minutes. */
export function clockAt(ms: number, offsetMin: number): string {
  const t = new Date(ms + offsetMin * 60_000);
  const h = t.getUTCHours();
  const m = t.getUTCMinutes();
  return `${h < 10 ? "0" : ""}${h}:${m < 10 ? "0" : ""}${m}`;
}

/** Short zone name for the offsets the profile can have ("IST" for +5:30, else "UTC+h:mm"). */
export function zoneName(offsetMin: number): string {
  if (offsetMin === 330) return "IST";
  const s = offsetMin < 0 ? "-" : "+";
  const a = Math.abs(offsetMin);
  return `UTC${s}${Math.floor(a / 60)}${a % 60 ? `:${String(a % 60).padStart(2, "0")}` : ""}`;
}
