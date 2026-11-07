// The hero's neural core as plain three.js objects driven by `frame()`; React only wires its
// lifecycle (scenes/hero.tsx), so nothing re-renders and nothing allocates per frame.
//
// Placement: the brain is camera-locked. Each frame it is put on the ray through the centre
// of its screen box (the home hero's [data-hero-core] element, or the free side of the
// section's composition elsewhere) at a fixed depth and scaled to fill that box, so the
// stage's camera moves, view offsets and parallax never push it under the text column.
import {
  BufferAttribute,
  BufferGeometry,
  Group,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  LineSegments,
  Mesh,
  PlaneGeometry,
  Points,
  ShaderMaterial,
  Vector3,
  type IUniform,
  type PerspectiveCamera,
} from "three";
import { compositionFor, framing, isLayout, zeroComposition } from "../../framing";
import { isLight, setColor, setGlowBlending } from "../../fx";
import { BASE_PITCH, BASE_YAW, brainSteps, COUNTS, FOV, VIEW_HALF, type BrainLayout } from "../../hero-layout";
import type { SceneProps } from "../../types";
import { SHADERS } from "./shaders";

/** Depth (world units in front of the camera) the brain is drawn at. */
const DEPTH = 14;
/** Share of its box the resting brain fills (room for the turn toward the cursor and the glow). */
const FIT = 0.84;
/** Build budget per frame while the layout is generated (ms). */
const BUILD_MS = 4;
/** Arc tessellation. */
const SEG_SHORT = 6;
const SEG_LONG = 18;
const TAN = Math.tan(((FOV / 2) * Math.PI) / 180);
const HERO_SECTION = '[data-section="hero"]:not([data-scene]),[data-section][data-scene="hero"]';

type Box = { x: number; y: number; w: number; h: number };
const smooth = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** A geometry with the attributes a program expects but nothing to draw (compiled during warm-up). */
function placeholder(names: [string, number][], instanced = false) {
  const g = instanced ? new InstancedBufferGeometry() : new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(3), 3));
  for (const [name, size] of names)
    g.setAttribute(name, instanced ? new InstancedBufferAttribute(new Float32Array(size), size) : new BufferAttribute(new Float32Array(size), size));
  if (g instanceof InstancedBufferGeometry) g.instanceCount = 0;
  else g.setDrawRange(0, 0);
  return g;
}

export class HeroCore {
  readonly group = new Group();
  private readonly uniforms: Record<string, IUniform> = {
    uTime: { value: 0 },
    uIntro: { value: 0 },
    uDisperse: { value: 0 },
    uWeight: { value: 0 },
    uLight: { value: 0 },
    uCenterZ: { value: -DEPTH },
    uRadius: { value: 1 },
    uPointer: { value: new Vector3(0, 0, 9) },
    uPointerOn: { value: 0 },
    uAi: { value: new Vector3() },
    uDeep: { value: new Vector3() },
    uCore: { value: new Vector3() },
    uHot: { value: new Vector3() },
  };
  private readonly neuronMat = new ShaderMaterial({
    ...SHADERS.neuron,
    uniforms: {
      ...this.uniforms,
      uPx: { value: 1 },
      uStream: { value: new Vector3(-3, -2, 0) },
      uCtrl: { value: new Vector3(0, -2, 0) },
      uSpread: { value: 1 },
    },
  });
  private readonly synapseMat = new ShaderMaterial({ ...SHADERS.synapse, uniforms: { ...this.uniforms } });
  private readonly signalMat = new ShaderMaterial({ ...SHADERS.signal, uniforms: { ...this.uniforms } });
  private readonly materials = [this.neuronMat, this.synapseMat, this.signalMat];
  private readonly quad = new PlaneGeometry(1, 1);
  private readonly neurons: Points;
  private readonly synapses: LineSegments;
  private readonly signals: Mesh;

  private job: Generator<void, BrainLayout> | null;
  private readonly signalCount: number;
  private ready = false;
  private introStart = -1;
  private fadeHost: HTMLElement | null = null;
  private readonly coarse: boolean;

  // Screen boxes (CSS px), cached on resize; the core box's y is in document coordinates.
  private box: Box = { x: 0, y: 0, w: 0, h: 0 };
  private boxEl: HTMLElement | null = null;
  private sectionTop = 0;
  private stream = { x: 0.23, y: 0.92 };
  private measured = false;
  private readonly onResize = () => (this.measured = false);

  // Eased state.
  private yaw = BASE_YAW;
  private pitch = BASE_PITCH;
  private on = 0;
  private disperse = 0;
  private readonly tmp = new Vector3();
  private readonly dir = new Vector3();
  private readonly fwd = new Vector3();
  private readonly hit = new Vector3();
  private readonly virt = new Vector3();
  private readonly comp = zeroComposition();

  constructor(quality: SceneProps["quality"]) {
    this.coarse = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
    this.job = brainSteps(COUNTS[quality]);
    this.signalCount = COUNTS[quality].signals;
    this.neurons = new Points(placeholder([["aSeed", 1], ["aKind", 1]]), this.neuronMat);
    this.synapses = new LineSegments(placeholder([["aT", 1], ["aSeed", 1], ["aKind", 1]]), this.synapseMat);
    const sig = placeholder([["aP0", 3], ["aP1", 3], ["aP2", 3], ["aPh", 3]], true);
    sig.index = this.quad.index;
    sig.setAttribute("position", this.quad.getAttribute("position"));
    sig.setAttribute("uv", this.quad.getAttribute("uv"));
    this.signals = new Mesh(sig, this.signalMat);
    this.signals.renderOrder = 0;
    this.synapses.renderOrder = 1;
    this.neurons.renderOrder = 2;
    for (const o of [this.signals, this.synapses, this.neurons]) {
      o.frustumCulled = false;
      this.group.add(o);
    }
  }

  /** Re-measure the boxes when the layout changes; returns the detach function (effects own it). */
  attach() {
    window.addEventListener("resize", this.onResize, { passive: true });
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(this.onResize) : null;
    ro?.observe(document.body);
    this.measured = false;
    return () => {
      window.removeEventListener("resize", this.onResize);
      ro?.disconnect();
    };
  }

  /** Palette → colours and blending (additive light on dark, ink on paper). */
  setPalette(p: SceneProps["palette"]) {
    const u = this.uniforms;
    const light = isLight(p.bg);
    u.uLight.value = light ? 1 : 0;
    setColor(u.uHot.value, p.accent);
    if (light) {
      setColor(u.uAi.value, p.ai);
      setColor(u.uDeep.value, p.ai, p.fg, 0.3);
      setColor(u.uCore.value, p.ai, p.fg, 0.5);
    } else {
      setColor(u.uAi.value, p.ai, "#ffffff", 0.12);
      setColor(u.uDeep.value, p.ai, p.bg, 0.42);
      setColor(u.uCore.value, p.ai, "#ffffff", 0.62);
    }
    for (const m of this.materials) setGlowBlending(m, light);
  }

  /** Spends up to BUILD_MS on the layout; builds the GPU buffers once it is complete. */
  private build() {
    if (!this.job) return;
    const until = performance.now() + BUILD_MS;
    let r = this.job.next();
    while (!r.done && performance.now() < until) r = this.job.next();
    if (!r.done) return;
    this.job = null;
    this.upload(r.value);
    this.ready = true;
  }

  private upload(L: BrainLayout) {
    // Neurons.
    const ng = new BufferGeometry();
    ng.setAttribute("position", new BufferAttribute(L.pos, 3));
    ng.setAttribute("aSeed", new BufferAttribute(L.seed, 1));
    ng.setAttribute("aKind", new BufferAttribute(Float32Array.from(L.kind), 1));
    this.neurons.geometry.dispose();
    this.neurons.geometry = ng;

    // Synapses: each quadratic arc tessellated into segments (t 0 → 1 along it).
    const arcs = L.arcKind.length;
    let segs = 0;
    for (let a = 0; a < arcs; a++) segs += L.arcKind[a] ? SEG_LONG : SEG_SHORT;
    const pos = new Float32Array(segs * 6);
    const at = new Float32Array(segs * 2);
    const seed = new Float32Array(segs * 2);
    const kind = new Float32Array(segs * 2);
    let v = 0;
    for (let a = 0; a < arcs; a++) {
      const o = a * 9;
      const n = L.arcKind[a] ? SEG_LONG : SEG_SHORT;
      const sd = (a * 0.6180339) % 1;
      for (let i = 0; i < n; i++)
        for (const t of [i / n, (i + 1) / n]) {
          const u = 1 - t;
          for (let c = 0; c < 3; c++) pos[v * 3 + c] = u * u * L.arcs[o + c] + 2 * u * t * L.arcs[o + 3 + c] + t * t * L.arcs[o + 6 + c];
          at[v] = t;
          seed[v] = sd;
          kind[v] = L.arcKind[a];
          v++;
        }
    }
    const sg = new BufferGeometry();
    sg.setAttribute("position", new BufferAttribute(pos, 3));
    sg.setAttribute("aT", new BufferAttribute(at, 1));
    sg.setAttribute("aSeed", new BufferAttribute(seed, 1));
    sg.setAttribute("aKind", new BufferAttribute(kind, 1));
    this.synapses.geometry.dispose();
    this.synapses.geometry = sg;

    // Signals ride the long arcs first, then every few short ones; instance 0 is the aura.
    const order: number[] = [];
    for (let a = 0; a < arcs; a++) if (L.arcKind[a]) order.push(a);
    for (let a = 0; a < arcs && order.length < this.signalCount; a += 3) if (!L.arcKind[a]) order.push(a);
    const count = Math.min(this.signalCount, order.length) + 1;
    const p0 = new Float32Array(count * 3);
    const p1 = new Float32Array(count * 3);
    const p2 = new Float32Array(count * 3);
    const ph = new Float32Array(count * 3);
    for (let i = 1; i < count; i++) {
      const o = order[i - 1] * 9;
      p0.set(L.arcs.subarray(o, o + 3), i * 3);
      p1.set(L.arcs.subarray(o + 3, o + 6), i * 3);
      p2.set(L.arcs.subarray(o + 6, o + 9), i * 3);
      ph[i * 3] = (i * 0.381966) % 1;
      ph[i * 3 + 1] = L.arcKind[order[i - 1]] ? 0.28 + ((i * 0.7548777) % 1) * 0.22 : 0.6 + ((i * 0.7548777) % 1) * 0.4;
      ph[i * 3 + 2] = 1;
    }
    const ig = new InstancedBufferGeometry();
    ig.index = this.quad.index;
    ig.setAttribute("position", this.quad.getAttribute("position"));
    ig.setAttribute("uv", this.quad.getAttribute("uv"));
    ig.setAttribute("aP0", new InstancedBufferAttribute(p0, 3));
    ig.setAttribute("aP1", new InstancedBufferAttribute(p1, 3));
    ig.setAttribute("aP2", new InstancedBufferAttribute(p2, 3));
    ig.setAttribute("aPh", new InstancedBufferAttribute(ph, 3));
    ig.instanceCount = count;
    this.signals.geometry.dispose();
    this.signals.geometry = ig;
  }

  /** Screen boxes: the hero's core box (document coords) or the composition's free side, and where the next scene sits. */
  private measure(w: number, h: number) {
    this.measured = true;
    const sections = [...document.querySelectorAll<HTMLElement>("[data-section]")];
    const own = document.querySelector<HTMLElement>(HERO_SECTION);
    this.boxEl = own?.querySelector<HTMLElement>("[data-hero-core]") ?? null;
    const r = this.boxEl?.getBoundingClientRect();
    if (this.boxEl && r && r.width > 0 && r.height > 0) {
      this.box = { x: r.left, y: r.top + scrollY, w: r.width, h: r.height };
      this.sectionTop = (own?.getBoundingClientRect().top ?? 0) + scrollY;
    } else {
      this.boxEl = null;
      const stage = own?.dataset.stage;
      compositionFor(isLayout(stage) ? stage : "left", "ambient", framing.phone, this.comp);
      // The free side minus its lower part, where pages put their caption chip.
      const c = this.comp;
      this.box = { x: (0.5 + c.cx - c.w / 2) * w, y: (0.5 + c.cy - c.h / 2) * h, w: c.w * w, h: c.h * h * 0.78 };
    }
    // The hand-off target: the free side of the section after the hero, low in the viewport
    // where that section comes in.
    const next = own ? sections[sections.indexOf(own) + 1] : undefined;
    const layout = next?.dataset.stage;
    compositionFor(isLayout(layout) ? layout : "left", "ambient", framing.phone, this.comp);
    this.stream.x = 0.5 + this.comp.cx;
    this.stream.y = 0.92;
  }

  /** Is the canvas visible yet (the island fades it in once the stage is ready)? */
  private canvasShown(canvas: HTMLCanvasElement) {
    if (!this.fadeHost) {
      let el: HTMLElement | null = canvas;
      while (el?.parentElement && !el.parentElement.hasAttribute("data-neural-stage")) el = el.parentElement;
      this.fadeHost = el ?? canvas;
    }
    return this.fadeHost === canvas || this.fadeHost.style.opacity !== "0";
  }

  /** Canvas px → that pixel's ray direction (this.dir). */
  private ray(camera: PerspectiveCamera, px: number, py: number, w: number, h: number) {
    return this.dir.set((px / w) * 2 - 1, 1 - (py / h) * 2, 0.5).unproject(camera).sub(camera.position).normalize();
  }

  /** Canvas px → the point at `depth` in front of the camera on that pixel's ray. */
  private rayPoint(camera: PerspectiveCamera, px: number, py: number, w: number, h: number, depth: number, out: Vector3) {
    this.ray(camera, px, py, w, h);
    return out.copy(camera.position).addScaledVector(this.dir, depth / Math.max(0.2, this.dir.dot(this.fwd)));
  }

  frame(
    camera: PerspectiveCamera,
    canvas: HTMLCanvasElement,
    size: { width: number; height: number },
    bufferHeight: number,
    rawDelta: number,
    { weight, progress, pointer }: SceneProps,
  ) {
    const u = this.uniforms;
    const dt = Math.min(rawDelta, 0.1);
    const time = (u.uTime.value += dt);
    if (!this.ready) {
      u.uWeight.value = 0;
      this.build();
      return;
    }
    if (this.introStart < 0 && this.canvasShown(canvas)) this.introStart = time;
    u.uIntro.value = this.introStart < 0 ? 0 : time - this.introStart;
    u.uWeight.value = weight;

    const W = size.width;
    const H = size.height;
    if (!this.measured) this.measure(W, H);
    const scroll = scrollY;
    const b = this.box;
    // The home core scrolls with its section but lags behind it (it lingers while it disperses).
    const cx = b.x + b.w / 2;
    let cy = b.y + b.h / 2;
    if (this.boxEl) cy = cy - scroll + 0.45 * Math.max(0, scroll - this.sectionTop);
    const fitPx = FIT * Math.min(b.w / (2 * VIEW_HALF.w), b.h / (2 * VIEW_HALF.h));
    // The brain's visual mass sits above its pivot (the stem below is faint): centre the mass.
    cy += 0.1 * fitPx;

    // Disperse: on the home hero with scroll progress; elsewhere as the scene hands over.
    const target = this.boxEl ? smooth(0.6, 1, progress) : 0.8 * smooth(0, 1, 1 - weight);
    this.disperse += (target - this.disperse) * (1 - Math.exp(-dt / 0.12));
    u.uDisperse.value = this.disperse;

    // Rotation: a slow breath (a wider auto-orbit on touch), turned toward the cursor.
    const k = 1 - Math.exp(-dt / 0.55);
    const live = !this.coarse && Math.abs(pointer.x) + Math.abs(pointer.y) > 0.002;
    const ppx = ((pointer.x + 1) / 2) * W;
    const ppy = ((1 - pointer.y) / 2) * H;
    const dx = live ? Math.max(-1, Math.min(1, (ppx - cx) / (W * 0.4))) : 0;
    const dy = live ? Math.max(-1, Math.min(1, (ppy - cy) / (H * 0.45))) : 0;
    const orbit = this.coarse || !live ? 1 : 0.35;
    const yawT = BASE_YAW + Math.sin(time * 0.21) * 0.32 * orbit + dx * 0.42 + this.disperse * 0.5;
    const pitchT = BASE_PITCH + Math.sin(time * 0.17) * 0.06 * orbit + dy * 0.26;
    this.yaw += (yawT - this.yaw) * k;
    this.pitch += (pitchT - this.pitch) * k;

    // Camera-locked placement in the box.
    camera.updateMatrixWorld();
    camera.getWorldDirection(this.fwd);
    const g = this.group;
    this.rayPoint(camera, cx, cy, W, H, DEPTH, g.position);
    const worldPerPx = (2 * DEPTH * TAN) / Math.max(1, H) / camera.zoom;
    const scale = fitPx * worldPerPx;
    g.scale.setScalar(scale);
    g.rotation.set(this.pitch, this.yaw, 0);
    g.updateMatrixWorld();
    u.uRadius.value = scale;
    this.tmp.copy(g.position).applyMatrix4(camera.matrixWorldInverse);
    u.uCenterZ.value = this.tmp.z;
    this.neuronMat.uniforms.uPx.value = bufferHeight / 2 / TAN;

    // Where the dispersal streams (the next section's free side) and the bend of the current
    // (straight below the brain), in the brain's local space.
    const sx = this.stream.x * W;
    const sy = this.stream.y * H;
    this.rayPoint(camera, sx, sy, W, H, DEPTH, this.tmp);
    g.worldToLocal((this.neuronMat.uniforms.uStream.value as Vector3).copy(this.tmp));
    this.rayPoint(camera, cx * 0.7 + sx * 0.3, sy, W, H, DEPTH, this.tmp);
    g.worldToLocal((this.neuronMat.uniforms.uCtrl.value as Vector3).copy(this.tmp));
    this.neuronMat.uniforms.uSpread.value = (0.09 * W) / Math.max(1, fitPx);

    // Cursor → the nearest point of the brain's bounding sphere (local space). Without a
    // mouse (touch, or before the first move) a virtual cursor wanders over the cortex.
    const P = u.uPointer.value as Vector3;
    const onT = live ? Math.max(0.3, 1 - Math.max(0, Math.hypot(ppx - cx, ppy - cy) / (fitPx * 1.2) - 0.8) * 0.5) : 0.55;
    this.on += (onT - this.on) * (1 - Math.exp(-dt / 0.3));
    u.uPointerOn.value = this.on * (1 - this.disperse);
    this.virt.set(Math.sin(time * 0.37) * 0.75, 0.3 + 0.35 * Math.sin(time * 0.23), Math.cos(time * 0.29) * 0.8);
    if (live) {
      const d = this.ray(camera, ppx, ppy, W, H);
      // Closest approach of the ray to the centre, pushed onto the sphere toward the camera.
      const along = this.tmp.copy(g.position).sub(camera.position).dot(d);
      this.hit.copy(camera.position).addScaledVector(d, along).sub(g.position);
      const off = this.hit.length();
      const R = scale * 0.95;
      if (off < R) this.hit.addScaledVector(d, -Math.sqrt(R * R - off * off));
      else this.hit.multiplyScalar(R / Math.max(1e-6, off));
      this.hit.add(g.position);
      g.worldToLocal(this.hit);
      P.lerp(this.hit, 1 - Math.exp(-dt / 0.08));
    } else P.lerp(this.virt, 1 - Math.exp(-dt / 0.6));
  }

  dispose() {
    this.job = null;
    this.neurons.geometry.dispose();
    this.synapses.geometry.dispose();
    this.signals.geometry.dispose();
    this.quad.dispose();
    for (const m of this.materials) m.dispose();
  }
}
