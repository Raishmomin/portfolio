// Screen-space labels for the scenes-a scenes: one aria-hidden, pointer-events:none layer of
// plain DOM nodes over the canvas, positioned each frame by projecting 3D points.
// Why not one drei <Html> per label: each <Html> owns a separate React root, and under
// React 19 StrictMode its unmount/remount race clears a label's container (labels vanish
// in dev); it also appends to `events.connected`, which can be outside the stage when the
// engine sets an eventSource. This layer is decorative only: every label duplicates text
// that the section already renders on the server.
import type { Camera, Matrix4 } from "three";
import { Vector3 } from "three";

const v = new Vector3();

export class LabelLayer {
  readonly el: HTMLDivElement;
  private readonly items: HTMLDivElement[] = [];
  private readonly x: number[] = [];
  private readonly y: number[] = [];
  private readonly o: number[] = [];

  constructor(parent: HTMLElement) {
    this.el = document.createElement("div");
    this.el.setAttribute("aria-hidden", "true");
    this.el.dataset.neuralLabels = "";
    this.el.style.cssText = "position:absolute;inset:0;overflow:hidden;pointer-events:none;user-select:none;contain:strict;";
    parent.appendChild(this.el);
  }

  /** Add a label; `align` = where the anchor point sits relative to the text. */
  add(text: string, css: string, className = "font-mono"): number {
    const d = document.createElement("div");
    d.className = className;
    d.textContent = text;
    d.style.cssText = `position:absolute;left:0;top:0;white-space:nowrap;will-change:transform,opacity;opacity:0;${css}`;
    this.el.appendChild(d);
    this.items.push(d);
    this.x.push(NaN);
    this.y.push(NaN);
    this.o.push(0);
    return this.items.length - 1;
  }

  style(i: number, css: Partial<CSSStyleDeclaration>) {
    Object.assign(this.items[i].style, css);
  }

  /**
   * Place label i at a local point (x,y,z) under `matrixWorld`, with an opacity.
   * DOM is written only when the rounded value changes.
   */
  place(i: number, x: number, y: number, z: number, matrixWorld: Matrix4, camera: Camera, w: number, h: number, opacity: number) {
    const item = this.items[i];
    v.set(x, y, z).applyMatrix4(matrixWorld).project(camera);
    const behind = v.z > 1 || v.z < -1;
    const o = behind ? 0 : Math.round(Math.max(0, Math.min(1, opacity)) * 40) / 40;
    if (o !== this.o[i]) {
      this.o[i] = o;
      item.style.opacity = String(o);
      item.style.visibility = o > 0 ? "visible" : "hidden";
    }
    if (o === 0) return;
    const px = Math.round(((v.x + 1) / 2) * w * 2) / 2;
    const py = Math.round(((1 - v.y) / 2) * h * 2) / 2;
    if (px !== this.x[i] || py !== this.y[i]) {
      this.x[i] = px;
      this.y[i] = py;
      item.style.transform = `translate3d(${px}px,${py}px,0)`;
    }
  }

  hide(i: number) {
    if (this.o[i] !== 0) {
      this.o[i] = 0;
      this.items[i].style.opacity = "0";
      this.items[i].style.visibility = "hidden";
    }
  }

  hideAll() {
    for (let i = 0; i < this.items.length; i++) this.hide(i);
  }

  dispose() {
    this.el.remove();
  }
}
