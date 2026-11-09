// Shared GL helpers for the stack and experience scenes (scenes-a lane).
// Glow without postprocessing: soft billboard sprites drawn procedurally in the shader
// (no textures, no network assets), and two blend modes:
// - dark theme: pure additive colour that never writes canvas alpha, so it composites
//   additively over whatever the stage paints behind it (opaque clear or page background)
// - light theme: normal alpha blending with darker, print-like colours (additive light
//   on paper would wash out to white)
import {
  AddEquation,
  Color,
  CustomBlending,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  NormalBlending,
  OneFactor,
  PlaneGeometry,
  ShaderMaterial,
  ZeroFactor,
  type Camera,
  type Material,
} from "three";
import { fitFree } from "../../framing";
import type { ScenePalette } from "../../types";

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const smooth01 = (v: number) => {
  const t = clamp01(v);
  return t * t * (3 - 2 * t);
};

/** Deterministic hash in [0,1) from a string (layouts must not depend on Math.random). */
export function hash01(s: string, salt = 0): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

/** Light theme = bright page background. */
export function isLightBg(bg: string): boolean {
  const c = new Color(bg);
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b > 0.3;
}

/** Linear colour from a palette hex, optionally mixed toward another hex. */
export function paletteColor(hex: string, mixWith?: string, t = 0): Color {
  const c = new Color(hex);
  if (mixWith && t > 0) c.lerp(new Color(mixWith), t);
  return c;
}

/** Switch a glow material between dark (additive, alpha untouched) and light (normal) blending. */
export function setGlowBlending(m: Material, light: boolean) {
  if (light) {
    m.blending = NormalBlending;
  } else {
    m.blending = CustomBlending;
    m.blendEquation = AddEquation;
    m.blendSrc = OneFactor;
    m.blendDst = OneFactor;
    m.blendEquationAlpha = AddEquation;
    m.blendSrcAlpha = ZeroFactor;
    m.blendDstAlpha = OneFactor;
  }
  m.needsUpdate = true;
}

/** Fragment tail shared by every glow shader: `c` = colour, `a` = coverage. */
export const GLOW_OUT = /* glsl */ `
  gl_FragColor = uLight > 0.5 ? vec4(c, a) : vec4(c * a, a);
  #include <colorspace_fragment>
`;

const SPRITE_VERT = /* glsl */ `
  attribute vec3 aPos;
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aAlpha;
  uniform float uSize;
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(aPos, 1.0);
    mv.xy += position.xy * aSize * uSize;
    gl_Position = projectionMatrix * mv;
    vUv = position.xy * 2.0;
    vColor = aColor;
    vAlpha = aAlpha;
  }
`;

const SPRITE_FRAG = /* glsl */ `
  uniform float uOpacity;
  uniform float uLight;
  uniform float uCore;
  uniform float uHalo;
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(vUv);
    if (d >= 1.0 || vAlpha <= 0.001) discard;
    float core = 1.0 - smoothstep(uCore * 0.78, uCore, d);
    float halo = pow(1.0 - d, 2.4) * uHalo;
    float a = vAlpha * uOpacity;
    vec3 c;
    if (uLight > 0.5) {
      // print-like: a solid, softly shaded disc with a faint tinted halo
      float shade = 1.0 - 0.3 * smoothstep(0.0, uCore, d);
      c = vColor * shade;
      a *= core + halo * 0.35 * (1.0 - core);
    } else {
      float hot = 1.0 - smoothstep(0.0, uCore * 0.75, d);
      c = mix(vColor, vec3(1.0), hot * 0.6) * (core * 1.25 + halo);
    }
    ${GLOW_OUT}
  }
`;

/**
 * N camera-facing glow sprites in one instanced draw call. Per instance: position,
 * colour (linear), size (world units, full quad width) and alpha. Mutate the arrays,
 * then call `flush()`; nothing is allocated per frame.
 */
export class Sprites {
  readonly geometry = new InstancedBufferGeometry();
  readonly material: ShaderMaterial;
  readonly mesh: Mesh;
  readonly pos: Float32Array;
  readonly color: Float32Array;
  readonly size: Float32Array;
  readonly alpha: Float32Array;
  private readonly attrs: InstancedBufferAttribute[];

  constructor(readonly count: number, opts: { core?: number; halo?: number; renderOrder?: number } = {}) {
    const quad = new PlaneGeometry(1, 1);
    this.geometry.index = quad.index;
    this.geometry.setAttribute("position", quad.getAttribute("position"));
    this.geometry.instanceCount = count;
    this.pos = new Float32Array(count * 3);
    this.color = new Float32Array(count * 3);
    this.size = new Float32Array(count);
    this.alpha = new Float32Array(count);
    const mk = (name: string, arr: Float32Array, n: number) => {
      const a = new InstancedBufferAttribute(arr, n);
      a.setUsage(DynamicDrawUsage);
      this.geometry.setAttribute(name, a);
      return a;
    };
    this.attrs = [mk("aPos", this.pos, 3), mk("aColor", this.color, 3), mk("aSize", this.size, 1), mk("aAlpha", this.alpha, 1)];
    this.material = new ShaderMaterial({
      vertexShader: SPRITE_VERT,
      fragmentShader: SPRITE_FRAG,
      uniforms: {
        uOpacity: { value: 1 },
        uLight: { value: 0 },
        uCore: { value: opts.core ?? 0.24 },
        uHalo: { value: opts.halo ?? 0.9 },
        uSize: { value: 1 },
      },
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    this.mesh = new Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = opts.renderOrder ?? 2;
  }

  set(i: number, x: number, y: number, z: number) {
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
  }

  setColor(i: number, c: Color, k = 1) {
    this.color[i * 3] = c.r * k;
    this.color[i * 3 + 1] = c.g * k;
    this.color[i * 3 + 2] = c.b * k;
  }

  /** Upload changed arrays: bit 1 = positions, 2 = colours, 4 = sizes, 8 = alphas. */
  flush(mask = 15) {
    for (let b = 0; b < 4; b++) if (mask & (1 << b)) this.attrs[b].needsUpdate = true;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}

/** Layer colours derived from the palette (ai uses palette.ai). */
export function layerColors(p: ScenePalette) {
  return {
    frontend: paletteColor(p.accent),
    backend: paletteColor(p.fg, p.accent, 0.12),
    database: paletteColor(p.ok),
    devops: paletteColor(p.ok, p.ai, 0.55),
    ai: paletteColor(p.ai),
  } as const;
}

/**
 * Scale that fits a scene of the given half extents (world units, centred on the origin)
 * into the free part of the viewport the stage's composition leaves it (framing.ts):
 * ≤ 1 normally, up to `capFull` when the section is a "full" composition.
 */
export function fitScale(camera: Camera, size: { width: number; height: number }, halfWidth: number, halfHeight: number, capFull = 1): number {
  return fitFree(camera, size, halfWidth, halfHeight, 1, capFull);
}
