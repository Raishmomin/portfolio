// Screen-space labels for the scenes: one aria-hidden, pointer-events:none layer of plain
// DOM nodes over the canvas, positioned each frame by projecting 3D points.
// Why not one drei <Html> per label: each <Html> owns a separate React root, and under
// React 19 StrictMode its unmount/remount race clears a label's container (labels vanish
// in dev); it also appends to `events.connected`, which can be outside the stage when the
// engine sets an eventSource. This layer is decorative only: every label duplicates text
// that the section already renders on the server.
// Rules (tasks/fullmotion-spec.md contract): labels show only for the active scene
// (weight ≥ 0.6), never over content (panels, cards, [data-occlude], text), never clipped
// at the viewport edges, and never on phones.
import type { Camera, Matrix4 } from "three";
import { Vector3 } from "three";
import { framing, scroll } from "../../framing";
import { occluders } from "../../occluders";

const v = new Vector3();
const EDGE = 12; // px kept free at the viewport edges
const GATE_FROM = 0.6;
const GATE_TO = 0.78;

/** Where the projected anchor sits on the label box: fractions of its size plus px. */
export type Align = { x: number; y: number; dx?: number; dy?: number };

export class LabelLayer {
  readonly el: HTMLDivElement;
  private readonly items: HTMLDivElement[] = [];
  private readonly align: Align[] = [];
  private readonly x: number[] = [];
  private readonly y: number[] = [];
  private readonly o: number[] = [];
  /** Occlusion fade per label (1 = clear, 0 = over content). */
  private readonly clear: number[] = [];
  private readonly w: number[] = [];
  private readonly h: number[] = [];
  private measured = false;
  private gate = 0;

  constructor(parent: HTMLElement) {
    this.el = document.createElement("div");
    this.el.setAttribute("aria-hidden", "true");
    this.el.dataset.neuralLabels = "";
    this.el.style.cssText = "position:absolute;inset:0;overflow:hidden;pointer-events:none;user-select:none;contain:strict;";
    parent.appendChild(this.el);
    occluders.retain();
    // Widths change once the web fonts arrive.
    document.fonts?.ready.then(() => {
      this.measured = false;
    });
  }

  /** Add a label; `align` = where the anchor point sits relative to the text box. */
  add(text: string, css: string, className = "font-mono", align: Align = { x: -0.5, y: -0.5 }): number {
    const d = document.createElement("div");
    d.className = className;
    d.textContent = text;
    d.style.cssText = `position:absolute;left:0;top:0;white-space:nowrap;opacity:0;visibility:hidden;${css}`;
    this.el.appendChild(d);
    this.items.push(d);
    this.align.push(align);
    this.x.push(NaN);
    this.y.push(NaN);
    this.o.push(0);
    this.clear.push(1);
    this.w.push(0);
    this.h.push(0);
    this.measured = false;
    return this.items.length - 1;
  }

  style(i: number, css: Partial<CSSStyleDeclaration>) {
    Object.assign(this.items[i].style, css);
    this.measured = false;
  }

  setAlign(i: number, align: Align) {
    this.align[i] = align;
    this.x[i] = NaN;
  }

  /** One batched read of every label's size (labels are laid out even while hidden). */
  private measure() {
    for (let i = 0; i < this.items.length; i++) {
      this.w[i] = this.items[i].offsetWidth;
      this.h[i] = this.items[i].offsetHeight;
    }
    this.measured = true;
  }

  /**
   * Start a frame of placements for a scene with this blend weight. Returns false (and
   * hides everything) when its labels may not show: not the active scene, or a phone.
   */
  begin(weight: number): boolean {
    const t = Math.max(0, Math.min(1, (weight - GATE_FROM) / (GATE_TO - GATE_FROM)));
    this.gate = framing.phone ? 0 : t * t * (3 - 2 * t);
    if (this.gate <= 0) {
      this.hideAll();
      return false;
    }
    if (!this.measured) this.measure();
    occluders.sync(scroll.x, scroll.y);
    return true;
  }

  /**
   * Place label i at a local point (x,y,z) under `matrixWorld`, with an opacity.
   * DOM is written only when the rounded value changes.
   */
  place(i: number, x: number, y: number, z: number, matrixWorld: Matrix4, camera: Camera, w: number, h: number, opacity: number) {
    const item = this.items[i];
    v.set(x, y, z).applyMatrix4(matrixWorld).project(camera);
    const behind = v.z > 1 || v.z < -1;
    let target = behind ? 0 : Math.max(0, Math.min(1, opacity)) * this.gate;
    let px = 0;
    let py = 0;
    if (target > 0) {
      // Box from the anchor, clamped inside the viewport edges.
      const a = this.align[i];
      const bw = this.w[i];
      const bh = this.h[i];
      px = ((v.x + 1) / 2) * w + a.x * bw + (a.dx ?? 0);
      py = ((1 - v.y) / 2) * h + a.y * bh + (a.dy ?? 0);
      px = Math.min(Math.max(px, EDGE), Math.max(EDGE, w - EDGE - bw));
      py = Math.min(Math.max(py, EDGE), Math.max(EDGE, h - EDGE - bh));
      // Over content: hide at once, so a label is never seen over text even while it
      // slides onto it (a fade-out left it at ~0.1 over headings); ease back in once clear.
      const clearT = occluders.hits(px, py, px + bw, py + bh) ? 0 : 1;
      if (this.o[i] === 0 || clearT === 0) this.clear[i] = clearT; // appearing / covered: never over content
      else this.clear[i] += (clearT - this.clear[i]) * 0.35;
      if (Math.abs(clearT - this.clear[i]) < 0.02) this.clear[i] = clearT;
      target *= this.clear[i];
    }
    const o = Math.round(target * 40) / 40;
    if (o !== this.o[i]) {
      this.o[i] = o;
      item.style.opacity = String(o);
      item.style.visibility = o > 0 ? "visible" : "hidden";
      item.style.willChange = o > 0 ? "transform,opacity" : "";
    }
    if (o === 0) return;
    px = Math.round(px * 2) / 2;
    py = Math.round(py * 2) / 2;
    if (px !== this.x[i] || py !== this.y[i]) {
      this.x[i] = px;
      this.y[i] = py;
      item.style.transform = `translate3d(${px}px,${py}px,0)`;
    }
  }

  hide(i: number) {
    if (this.o[i] !== 0) {
      this.o[i] = 0;
      const s = this.items[i].style;
      s.opacity = "0";
      s.visibility = "hidden";
      s.willChange = "";
    }
  }

  hideAll() {
    for (let i = 0; i < this.items.length; i++) this.hide(i);
  }

  dispose() {
    this.el.remove();
    occluders.release();
  }
}
