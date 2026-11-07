// In-canvas labels for the contact globe: the city and its local time, "Delivered", and
// each channel's name, drawn in the canvas behind the content (tasks/fullmotion-spec.md:
// labels may be "drawn in-canvas behind the content"). They duplicate text the section
// already renders on the server, so they carry no content. Unlike DOM labels they cost no
// style, layout or layerize work per frame while the satellites orbit: one atlas texture
// (red = glyphs, green = a soft halo for legibility), one instanced draw call.
import {
  CanvasTexture,
  Color,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  LinearFilter,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
} from "three";

const ROW = 18; // css px per atlas row (11px text + halo)
const PAD = 5; // css px of halo room around the text
const ATLAS_W = 384; // css px

const VERT = /* glsl */ `
attribute vec3 aPos;
attribute vec4 aUv;
attribute vec2 aSize;
attribute vec2 aOff;
attribute vec3 aColor;
attribute float aAlpha;
uniform float uPxK;
varying vec2 vUv;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec4 mv = modelViewMatrix * vec4(aPos, 1.0);
  vec2 px = (position.xy + 0.5) * aSize + aOff;
  mv.xy += px * uPxK * -mv.z;
  vUv = vec2(mix(aUv.x, aUv.z, position.x + 0.5), mix(aUv.w, aUv.y, position.y + 0.5));
  vColor = aColor;
  vAlpha = aAlpha;
  gl_Position = projectionMatrix * mv;
}
`;
const FRAG = /* glsl */ `
uniform sampler2D uAtlas;
uniform vec3 uHalo;
uniform float uOpacity;
varying vec2 vUv;
varying vec3 vColor;
varying float vAlpha;
void main() {
  if (vAlpha <= 0.002) discard;
  vec4 t = texture2D(uAtlas, vUv);
  float a = max(t.r, t.g * 0.8) * vAlpha * uOpacity;
  if (a <= 0.002) discard;
  gl_FragColor = vec4(mix(uHalo, vColor, t.r), a);
  #include <colorspace_fragment>
}
`;

export class GlobeLabels {
  readonly mesh: Mesh;
  readonly material: ShaderMaterial;
  /** Box size per label (css px). */
  readonly w: Float32Array;
  readonly h: Float32Array;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly tex: CanvasTexture;
  private readonly texts: string[];
  private readonly scale: number;
  private readonly aPos: InstancedBufferAttribute;
  private readonly aUv: InstancedBufferAttribute;
  private readonly aSize: InstancedBufferAttribute;
  private readonly aOff: InstancedBufferAttribute;
  private readonly aColor: InstancedBufferAttribute;
  private readonly aAlpha: InstancedBufferAttribute;
  private font = "";

  constructor(texts: string[]) {
    const n = texts.length;
    this.texts = texts.slice();
    this.w = new Float32Array(n);
    this.h = new Float32Array(n);
    this.scale = Math.max(2, Math.ceil(window.devicePixelRatio || 1));
    this.canvas = document.createElement("canvas");
    this.canvas.width = ATLAS_W * this.scale;
    this.canvas.height = Math.max(1, n) * ROW * this.scale;
    this.ctx = this.canvas.getContext("2d");
    this.tex = new CanvasTexture(this.canvas);
    this.tex.minFilter = this.tex.magFilter = LinearFilter;
    this.tex.generateMipmaps = false;

    const quad = new PlaneGeometry(1, 1);
    const g = new InstancedBufferGeometry();
    g.index = quad.index;
    g.setAttribute("position", quad.getAttribute("position"));
    g.instanceCount = n;
    const mk = (name: string, size: number, dynamic: boolean) => {
      const a = new InstancedBufferAttribute(new Float32Array(Math.max(1, n) * size), size);
      if (dynamic) a.setUsage(DynamicDrawUsage);
      g.setAttribute(name, a);
      return a;
    };
    this.aPos = mk("aPos", 3, true);
    this.aUv = mk("aUv", 4, false);
    this.aSize = mk("aSize", 2, false);
    this.aOff = mk("aOff", 2, true);
    this.aColor = mk("aColor", 3, true);
    this.aAlpha = mk("aAlpha", 1, true);
    this.material = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { uAtlas: { value: this.tex }, uHalo: { value: new Color() }, uOpacity: { value: 1 }, uPxK: { value: 0.001 } },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
    });
    this.mesh = new Mesh(g, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6;
    this.draw();
    // Widths change once the web font arrives.
    document.fonts?.ready.then(() => this.draw());
  }

  /** The site's mono font (next/font family name), read from a .font-mono element. */
  private monoFont() {
    const el = document.querySelector(".font-mono") ?? document.body;
    return `500 11px ${getComputedStyle(el).fontFamily || "ui-monospace, monospace"}`;
  }

  /** Render every label into the atlas (fonts loaded / text changed). */
  private draw() {
    const ctx = this.ctx;
    if (!ctx) return;
    this.font = this.monoFont();
    for (let i = 0; i < this.texts.length; i++) this.drawOne(i);
  }

  private drawOne(i: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    const s = this.scale;
    const text = this.texts[i].toUpperCase();
    ctx.save();
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.clearRect(0, i * ROW, ATLAS_W, ROW);
    ctx.font = this.font;
    (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = "0.9px";
    ctx.textBaseline = "middle";
    const tw = Math.min(ATLAS_W - 2 * PAD, Math.ceil(ctx.measureText(text).width));
    const y = i * ROW + ROW / 2;
    // Halo (green), then the glyphs (red), added channel by channel.
    ctx.globalCompositeOperation = "lighter";
    ctx.filter = "blur(2px)";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#00ff00";
    ctx.strokeText(text, PAD, y);
    ctx.filter = "none";
    ctx.fillStyle = "#ff0000";
    ctx.fillText(text, PAD, y);
    ctx.restore();
    this.w[i] = tw + 2 * PAD;
    this.h[i] = ROW;
    // UV rect (flipY texture: v = 1 at the canvas top): u0, vTop, u1, vBottom.
    const H = this.canvas.height / s;
    this.aUv.setXYZW(i, 0, 1 - (i * ROW) / H, this.w[i] / ATLAS_W, 1 - ((i + 1) * ROW) / H);
    this.aSize.setXY(i, this.w[i], this.h[i]);
    this.aUv.needsUpdate = true;
    this.aSize.needsUpdate = true;
    this.tex.needsUpdate = true;
  }

  /** Change one label's text (e.g. the city's clock, once a minute). */
  setText(i: number, text: string) {
    if (this.texts[i] === text) return;
    this.texts[i] = text;
    this.drawOne(i);
  }

  /**
   * Place label i at a world point with its box offset from the anchor (css px, y up;
   * the box's lower-left corner), colour and opacity.
   */
  set(i: number, x: number, y: number, z: number, offX: number, offY: number, color: Color, alpha: number) {
    this.aPos.setXYZ(i, x, y, z);
    this.aOff.setXY(i, offX, offY);
    this.aColor.setXYZ(i, color.r, color.g, color.b);
    this.aAlpha.setX(i, alpha);
  }

  hide(i: number) {
    this.aAlpha.setX(i, 0);
  }

  flush(pxK: number) {
    this.material.uniforms.uPxK.value = pxK;
    this.aPos.needsUpdate = true;
    this.aOff.needsUpdate = true;
    this.aColor.needsUpdate = true;
    this.aAlpha.needsUpdate = true;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.tex.dispose();
  }
}
