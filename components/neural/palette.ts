// Theme colours for the scenes, read from the CSS variables (lazy 3D chunk only).
// Variables may be Tailwind HSL triplets ("17 90% 38%") or any CSS colour; each is
// resolved by painting one pixel, so the scenes always get plain "#rrggbb".
import type { ScenePalette } from "./types";

const VARS: [keyof ScenePalette, string][] = [
  ["bg", "--background"],
  ["fg", "--foreground"],
  ["muted", "--muted-foreground"],
  ["accent", "--primary"],
  ["ok", "--ok"],
  ["ai", "--ai"],
  ["line", "--border"],
];
const AI_FALLBACK = { dark: "#7C9CFF", light: "#3F5BD9" };
const TRIPLET = /^-?[\d.]+(deg)?\s+[\d.]+%\s+[\d.]+%$/;

let ctx: CanvasRenderingContext2D | null = null;

function toHex(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const css = TRIPLET.test(value) ? `hsl(${value})` : value;
  if (typeof CSS !== "undefined" && !CSS.supports("color", css)) return null;
  if (!ctx) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
  }
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = css;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

export function readPalette(): ScenePalette {
  const root = document.documentElement;
  const style = getComputedStyle(root);
  const dark = root.classList.contains("dark");
  const out = {} as ScenePalette;
  for (const [key, name] of VARS) out[key] = toHex(style.getPropertyValue(name)) ?? "";
  if (!out.ai) out.ai = dark ? AI_FALLBACK.dark : AI_FALLBACK.light;
  if (!out.bg) out.bg = dark ? "#0e0f11" : "#f5f3ee";
  if (!out.fg) out.fg = dark ? "#ece7dc" : "#141518";
  for (const [key] of VARS) if (!out[key]) out[key] = out.fg;
  return out;
}

export const samePalette = (a: ScenePalette, b: ScenePalette) => VARS.every(([k]) => a[k] === b[k]);
