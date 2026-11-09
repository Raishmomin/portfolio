// Shared visual helpers for the scenes (lazy 3D chunk only): the runtime glow sprite,
// glow blending that works on the transparent canvas, and palette colours as shader
// vectors. No network assets: every texture is drawn at runtime.
import { AddEquation, CanvasTexture, CustomBlending, LinearFilter, NormalBlending, OneFactor, Vector3, ZeroFactor, type Material } from "three";

/**
 * 64px glow sprite. Red = a crisp core disc, green = a soft gaussian halo, so one
 * texture serves both the bright centre and the bloom around it.
 */
export function makeGlowTexture(size = 64): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const dx = ((x + 0.5) / size) * 2 - 1;
      const dy = ((y + 0.5) / size) * 2 - 1;
      const r = Math.sqrt(dx * dx + dy * dy);
      const core = 1 - Math.min(1, Math.max(0, (r - 0.15) / 0.08));
      const halo = r >= 1 ? 0 : Math.exp(-r * r * 5.5) * (1 - r * r);
      const o = (y * size + x) * 4;
      img.data[o] = Math.round(core * 255);
      img.data[o + 1] = Math.round(halo * 255);
      img.data[o + 2] = 0;
      img.data[o + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  const texture = new CanvasTexture(canvas);
  texture.minFilter = LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

/** Is this palette background light? (relative luminance of the sRGB hex) */
export function isLight(bg: string): boolean {
  const [r, g, b] = srgb(bg);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.5;
}

/** "#rrggbb" → sRGB components 0..1. */
export function srgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", "").slice(0, 6), 16) || 0;
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** Writes a palette colour into a shader uniform (sRGB; the shaders output sRGB directly). */
export function setColor(v: Vector3, hex: string, mixWith?: string, t = 0): Vector3 {
  const a = srgb(hex);
  const b = mixWith ? srgb(mixWith) : a;
  return v.set(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
}

/**
 * Glow on a transparent canvas: dark themes add light (colour adds, alpha stays 0, so
 * the page shows through: "screen"-like light over the background); light themes use
 * normal alpha blending, since adding light to paper is invisible.
 */
export function setGlowBlending(m: Material, light: boolean) {
  if (light) {
    m.blending = NormalBlending;
  } else {
    m.blending = CustomBlending;
    m.blendEquation = AddEquation;
    m.blendSrc = OneFactor;
    m.blendDst = OneFactor;
    m.blendSrcAlpha = ZeroFactor;
    m.blendDstAlpha = OneFactor;
  }
  m.transparent = true;
  m.depthWrite = false;
  m.depthTest = false;
  m.needsUpdate = true;
}
