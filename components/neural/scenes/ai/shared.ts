// Small helpers shared by the scenes-b scenes (ai, work, contact).
import { useEffect, useState } from "react";
import { AdditiveBlending, Color, NormalBlending, type Blending } from "three";

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const smooth = (e0: number, e1: number, v: number) => {
  const t = clamp01((v - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
/** Frame-rate independent exponential approach (lambda ≈ 1 / time constant). */
export const damp = (current: number, target: number, lambda: number, dt: number) =>
  mix(current, target, 1 - Math.exp(-lambda * Math.min(dt, 0.1)));

/** Deterministic 0..1 pseudo-random numbers (mulberry32), so every visit draws the same scene. */
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

/** True when the theme background is light: glows then use normal blending (additive vanishes on paper). */
export function isLight(bg: string): boolean {
  const c = new Color(bg);
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b > 0.35;
}
export const glowBlending = (light: boolean): Blending => (light ? NormalBlending : AdditiveBlending);

/** A palette hex as a linear three Color (what shader uniforms expect). */
export const lin = (hex: string) => new Color(hex);

/** Soft round sprite for gl.POINTS: bright core + gaussian halo. Expects vColor, vAlpha. */
export const POINT_FRAG = /* glsl */ `
uniform float uOpacity;
uniform float uLight;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c) * 2.0;
  if (d > 1.0) discard;
  float core = smoothstep(0.32, 0.0, d);
  float halo = exp(-d * d * 5.0);
  float a = mix(halo * 0.75 + core, halo * 0.55 + core * 0.9, uLight);
  vec3 col = mix(vColor + core * 0.45, vColor * (0.85 + core * 0.15), uLight);
  gl_FragColor = vec4(col, a * vAlpha * uOpacity);
  #include <colorspace_fragment>
}
`;

/** Fresnel rim shader for small solids (stage cores, rings): reads as lit glass without lights. */
export const FRESNEL_VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vV;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;
export const FRESNEL_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uRim;
uniform float uOpacity;
varying vec3 vN;
varying vec3 vV;
void main() {
  float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
  gl_FragColor = vec4(mix(uColor, uRim, f), uOpacity);
  #include <colorspace_fragment>
}
`;

/** Static glow points: per-point position, size (world units), colour and alpha. */
export const POINT_VERT = /* glsl */ `
attribute float aSize;
attribute vec3 aColor;
attribute float aAlpha;
uniform float uPx;
uniform float uPersp;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vColor = aColor;
  vAlpha = aAlpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uPx / mix(1.0, -mv.z, uPersp);
  gl_Position = projectionMatrix * mv;
}
`;

type Cam = { isPerspectiveCamera?: boolean; fov?: number; zoom: number };
/**
 * Pixels per world unit for gl_PointSize (divided by view depth in the shader for a
 * perspective camera), times the scene's own scale, written into the uPx/uPersp
 * uniforms. Works for either camera type.
 */
export function pointScale(
  camera: Cam,
  heightPx: number,
  dpr: number,
  scale: number,
  out: { uPx: { value: number }; uPersp: { value: number } },
) {
  const persp = !!camera.isPerspectiveCamera && !!camera.fov;
  out.uPx.value = persp
    ? (heightPx * dpr * 0.5 * scale) / Math.tan((((camera.fov ?? 45) * Math.PI) / 180) * 0.5)
    : camera.zoom * dpr * scale;
  out.uPersp.value = persp ? 1 : 0;
}

/**
 * True from the frame after mount. drei <Html> mounted in the same commit as the
 * <Canvas> loses its first label (its portal target changes once R3F connects its
 * events, and the deferred root unmount wipes the re-created root), so labels wait a frame.
 */
export function useAfterFirstFrame(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return ready;
}
