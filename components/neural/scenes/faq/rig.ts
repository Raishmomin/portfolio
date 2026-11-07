// The FAQ scene as plain three.js objects driven by `frame()` (lazy 3D chunk).
// Where: the section's empty sticky window ([data-faq-window], desktop) beside the question
// cards, else the scene's own free rect (phones: the section opening), so it never sits
// under text. Laid out in screen px every frame and lifted into the world through the live
// camera (immune to the stage's composition blend).
// What:
// - Idle: the question field. One node per question, level with its card (the card's index
//   label beside it), threads from the window's edge to each node and from each node to a
//   slow answer core; the hovered question's node is pulled forward and lit.
// - A question open (or hovered/focused for a moment while none is open): the nodes fold
//   into a rail on the window's edge, the active one level with its card where the card's
//   connector arrives, a beam carries it into the window and the core unfolds into that
//   answer's visual (visuals.ts). Switching questions morphs one visual into the next.
// Three instanced draw calls; DOM reads only on scroll/resize/toggle; nothing allocates per
// frame. Labels are aria-hidden duplicates of the cards' text (shared label layer rules).
import { Color, Group, Vector3, type Camera, type PerspectiveCamera } from "three";
import { framing, sceneFrames } from "../../framing";
import type { NeuralData, ScenePalette } from "../../types";
import { isLightBg, layerColors, paletteColor } from "../stack/gl";
import type { Align, LabelLayer } from "../stack/labels";
import { FaqGL, arc, dashes, dot, seg } from "./gl";
import {
  beacon,
  bloom,
  career,
  clock,
  field,
  figures,
  prepare,
  stack,
  tickClock,
  verdict,
  type Colors,
  type Ctx,
  type Figure,
  type Item,
  type Kind,
  type LabelKind,
  type Pre,
  type Used,
} from "./visuals";

const QMAX = 12; // question nodes drawn (pages list 5-8)
const N_DOTS = 200;
const N_ARCS = 72;
const N_SEGS = 140;
const DUST = 24;
const BEAM = 8; // beam segments
const D_VIS = 2 * QMAX + 2; // dots: nodes, satellites, 2 beam packets, then the visual
const A_VIS = 2 * QMAX; // arcs: node halos, node orbits, then the visual
const S_BEAM = 2 * QMAX; // segs: threads, core threads, the beam, then the visual
const S_VIS = S_BEAM + BEAM;
const L_VIS = 16; // visual labels
const DWELL_S = 0.7; // hover/focus this long (nothing open) previews a question's answer
const MIN_WIN = 160;
const HEADER_PX = 64;

const pad = (n: number) => String(n).padStart(2, "0");
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (v: number) => {
  const t = clamp01(v);
  return t * t * (3 - 2 * t);
};
const hash = (k: number) => {
  const s = Math.sin(k * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** Skills an answer names: DB names, plus the usual spellings of a few. */
const ALIAS: Record<string, string> = {
  "next.js": String.raw`next\.?js`,
  "node.js": String.raw`node(?:\.?js)?`,
  "express.js": String.raw`express(?:\.?js)?`,
  postgresql: String.raw`postgres(?:ql)?`,
  mongodb: String.raw`mongo(?:db)?`,
  kubernetes: String.raw`kubernetes|k8s|eks`,
  websockets: String.raw`websockets?|socket\.io`,
  "ci/cd": String.raw`ci\/cd|github actions`,
  "restful apis": String.raw`rest|restful`,
  authentication: String.raw`auth|authentication`,
  "tailwind css": String.raw`tailwind(?: css)?`,
  "html/css": String.raw`html|css`,
};
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

function namedSkills(text: string, data: NeuralData): number[] {
  const out: number[] = [];
  data.skills.forEach((s, i) => {
    const key = s.name.toLowerCase();
    const re = new RegExp(String.raw`(?:^|[^a-z0-9])(?:${ALIAS[key] ?? esc(key)})(?![a-z0-9])`, "i");
    if (re.test(text)) out.push(i);
  });
  return out.sort((a, b) => data.skills[b].uses - data.skills[a].uses);
}

function kindOf(topic: string, figs: Figure[], verdictWord: string | null, named: number[], data: NeuralData): Kind {
  if (topic === "experience" && data.experience.length) return "career";
  if (topic === "timezone") return "clock";
  if (topic === "availability") return "beacon";
  if (topic === "stack" && data.skills.length) return "stack";
  if (figs.length) return "figures";
  if (named.length >= 2) return "stack";
  if (verdictWord) return "verdict";
  if (named.length) return "stack";
  return "bloom";
}

const LABEL_CLASS: Record<LabelKind, string> = {
  tag: "font-mono text-[10px] uppercase leading-none tracking-[0.16em]",
  chip: "rounded-full border px-2 py-[3px] font-mono text-[10.5px] leading-none tracking-[0.02em]",
  fig: "rounded-md border px-2 py-[5px] font-mono text-[12.5px] font-semibold leading-none tracking-[0.01em] tabular-nums",
  big: "font-sans text-[22px] font-semibold leading-none tracking-[-0.02em]",
  note: "rounded-full border px-3 py-[6px] font-sans text-[12.5px] font-medium leading-none",
};

type Want = { text: string; kind: LabelKind; x: number; y: number; z: number; ax: number; ay: number; alpha: number; color: Color | null };

const IDX_RIGHT: Align = { x: 0, y: -0.5, dx: 14 };
const IDX_LEFT: Align = { x: -1, y: -0.5, dx: -14 };

const ray = new Vector3();
const v0 = new Vector3();
const v1 = new Vector3();

export class FaqRig {
  readonly root = new Group();
  readonly gl = new FaqGL(N_DOTS, N_ARCS, N_SEGS);
  private col: Colors;
  private css = new Map<Color, string>();
  private chipBg = "transparent";
  private bgCss = "#000";
  private pre: Pre;
  private low: boolean;

  // DOM state (refreshed on scroll / resize / toggle).
  private section: HTMLElement | null = null;
  private win: HTMLElement | null = null;
  private items: Item[] = [];
  private byId = new Map<string, number>();
  private readonly ys = new Float32Array(QMAX);
  private wl = 0;
  private wt = 0;
  private ww = 0;
  private wh = 0;
  private winOk = false;
  private side = 1;
  private dirty = true;
  private openOrder: number[] = [];
  private openIdx = -1;

  // Interaction state.
  private hoverIdx = -1;
  private hoverSince = 0;
  private subject = -2;
  private kind: Kind = "field";
  private switchT = 0;
  private room = 0;
  private time = 0;

  // Labels.
  private layer: LabelLayer | null = null;
  private idxIds: number[] = [];
  private visIds: number[] = [];
  private readonly lText: string[] = [];
  private readonly lKind: LabelKind[] = [];
  private readonly lColor: (Color | null)[] = [];
  private readonly lAlpha = new Float32Array(L_VIS);
  private readonly lAlign: Align[] = [];
  private readonly want: Want[] = [];
  private wantN = 0;
  private readonly idxA = new Float32Array(QMAX);
  private readonly idxO = new Float32Array(QMAX);
  private idxSide = 0;

  // Live geometry (px, canvas space) for the current frame.
  private W = 1;
  private H = 1;
  private cam: Camera | null = null;

  constructor(
    private readonly data: NeuralData,
    quality: "high" | "low",
  ) {
    this.low = quality === "low";
    this.pre = prepare(data);
    this.col = { fg: new Color(), muted: new Color(), accent: new Color(), ok: new Color(), ai: new Color(), line: new Color(), layer: {} };
    this.root.add(this.gl.arcMesh, this.gl.segMesh, this.gl.sprites.mesh);
    this.root.visible = false;
    for (let j = 0; j < L_VIS; j++) {
      this.lText.push("");
      this.lKind.push("tag");
      this.lColor.push(null);
      this.lAlign.push({ x: 0, y: 0 });
      this.want.push({ text: "", kind: "tag", x: 0, y: 0, z: 0, ax: 0, ay: 0, alpha: 0, color: null });
    }
  }

  setPalette(p: ScenePalette) {
    const light = isLightBg(p.bg);
    const c = this.col;
    c.fg.copy(paletteColor(p.fg));
    c.muted.copy(paletteColor(p.muted));
    c.accent.copy(paletteColor(p.accent));
    c.ok.copy(paletteColor(p.ok));
    c.ai.copy(paletteColor(p.ai));
    c.line.copy(paletteColor(p.fg, p.bg, light ? 0.55 : 0.6));
    c.layer = { ...layerColors(p) };
    this.css.clear();
    const hex: [Color, string][] = [
      [c.fg, p.fg],
      [c.muted, p.muted],
      [c.accent, p.accent],
      [c.ok, p.ok],
      [c.ai, p.ai],
    ];
    for (const [k, v] of hex) this.css.set(k, v);
    for (const k of Object.values(c.layer)) this.css.set(k, k.getStyle());
    this.chipBg = `color-mix(in srgb, ${p.bg} 82%, transparent)`;
    this.bgCss = p.bg;
    this.gl.setLight(light);
    // Restyle the labels in their current text.
    for (let j = 0; j < L_VIS; j++) this.lText[j] = "\u0000";
    this.styleIndexLabels();
  }

  setQuality(q: "high" | "low") {
    this.low = q === "low";
  }

  // ------------------------------------------------------------ DOM

  /** Listeners for scroll / resize / toggles; returns the cleanup. */
  attach(): () => void {
    let raf = 0;
    const schedule = () => {
      this.dirty = true;
      if (!raf) raf = requestAnimationFrame(() => (raf = 0));
    };
    const onToggle = (e: Event) => {
      const el = e.target;
      if (!(el instanceof HTMLDetailsElement) || !el.hasAttribute("data-faq-item")) return;
      const i = this.items.findIndex((it) => it.el === el);
      if (i < 0) {
        this.section = null; // a list we have not read yet: rebuild on the next measure
      } else {
        this.openOrder = this.openOrder.filter((k) => k !== i);
        if (el.open) this.openOrder.push(i);
        this.openIdx = this.openOrder.length ? this.openOrder[this.openOrder.length - 1] : -1;
      }
      schedule();
    };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    document.addEventListener("toggle", onToggle, true);
    const ro = new ResizeObserver(schedule);
    ro.observe(document.body);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      document.removeEventListener("toggle", onToggle, true);
      ro.disconnect();
    };
  }

  private build(section: HTMLElement | null) {
    this.section = section;
    this.win = section?.querySelector<HTMLElement>("[data-faq-window]") ?? null;
    const els = section ? Array.from(section.querySelectorAll<HTMLDetailsElement>("details[data-faq-item]")).slice(0, QMAX) : [];
    this.items = els.map((el, i) => {
      const id = el.dataset.focusId ?? `faq:other:${i}`;
      const topic = id.split(":")[1] ?? "other";
      let figs: Figure[] = [];
      try {
        figs = el.dataset.faqFigures ? (JSON.parse(el.dataset.faqFigures) as Figure[]) : [];
      } catch {
        figs = [];
      }
      const verdictWord = el.dataset.faqVerdict ?? null;
      const named = namedSkills(el.querySelector(".faq-a")?.textContent ?? "", this.data);
      return {
        el,
        sum: el.querySelector<HTMLElement>("summary") ?? el,
        id,
        topic,
        index: pad(i + 1),
        figures: figs.slice(0, 4),
        verdict: verdictWord,
        named,
        kind: kindOf(topic, figs, verdictWord, named, this.data),
      };
    });
    this.byId = new Map(this.items.map((it, i) => [it.id, i]));
    this.openOrder = this.items.flatMap((it, i) => (it.el.open ? [i] : []));
    this.openIdx = this.openOrder.length ? this.openOrder[this.openOrder.length - 1] : -1;
    this.subject = -2;
    this.styleIndexLabels();
  }

  /** One batch of rect reads: the window and each question line (canvas px). */
  private measure(canvas: HTMLCanvasElement) {
    this.dirty = false;
    const sf = sceneFrames.faq;
    if (sf.el !== this.section || (this.section && !this.section.isConnected)) this.build(sf.el);
    if (!this.section) {
      this.winOk = false;
      return;
    }
    const c = canvas.getBoundingClientRect();
    if (this.win && !this.win.isConnected) this.win = this.section.querySelector<HTMLElement>("[data-faq-window]");
    const r = this.win?.getBoundingClientRect();
    this.winOk = !!r && r.width > MIN_WIN && r.height > MIN_WIN;
    if (r && this.winOk) {
      this.wl = r.left - c.left;
      this.wt = r.top - c.top;
      this.ww = r.width;
      this.wh = r.height;
    }
    let listX = 0;
    for (let i = 0; i < this.items.length; i++) {
      const s = this.items[i].sum.getBoundingClientRect();
      // The question's first line (where its connector leaves the card).
      this.ys[i] = s.top - c.top + Math.min(28, s.height / 2);
      if (i === 0) listX = s.left + s.width / 2 - c.left;
    }
    this.side = !this.winOk || listX < this.wl + this.ww / 2 ? 1 : -1;
  }

  // ------------------------------------------------------------ labels

  attachLabels(layer: LabelLayer | null) {
    this.layer = layer;
    this.idxIds = [];
    this.visIds = [];
    if (!layer) return;
    for (let i = 0; i < QMAX; i++) this.idxIds.push(layer.add(pad(i + 1), "", LABEL_CLASS.tag, IDX_RIGHT));
    this.idxSide = 0;
    for (let j = 0; j < L_VIS; j++) {
      this.visIds.push(layer.add("", "", LABEL_CLASS.tag, this.lAlign[j]));
      this.lText[j] = "\u0000";
    }
    this.styleIndexLabels();
  }

  private styleIndexLabels() {
    const layer = this.layer;
    if (!layer) return;
    for (let i = 0; i < this.idxIds.length; i++)
      layer.style(this.idxIds[i], { color: this.css.get(this.col.muted) ?? "", textShadow: `0 0 8px ${this.bgCss}, 0 0 3px ${this.bgCss}` });
  }

  private label = (text: string, kind: LabelKind, x: number, y: number, z: number, ax: number, ay: number, alpha: number, color?: Color) => {
    if (!text || this.wantN >= L_VIS) return;
    const w = this.want[this.wantN++];
    w.text = text;
    w.kind = kind;
    w.x = x;
    w.y = y;
    w.z = z;
    w.ax = ax;
    w.ay = ay;
    w.alpha = alpha;
    w.color = color ?? null;
  };

  private restyle(j: number, w: Want) {
    const layer = this.layer!;
    const id = this.visIds[j];
    const el = layer.el.children[id] as HTMLElement | undefined;
    if (!el) return;
    el.textContent = w.text;
    el.className = LABEL_CLASS[w.kind];
    const color = (w.color && this.css.get(w.color)) || this.css.get(this.col.fg) || "";
    const shadow = `0 0 10px ${this.bgCss}, 0 0 4px ${this.bgCss}`;
    const boxed = w.kind === "chip" || w.kind === "fig" || w.kind === "note";
    layer.style(id, {
      color: w.kind === "chip" ? (this.css.get(this.col.fg) ?? color) : w.kind === "tag" ? (this.css.get(this.col.muted) ?? color) : color,
      background: boxed ? this.chipBg : "",
      borderColor: boxed ? `color-mix(in srgb, ${color} 55%, transparent)` : "",
      textShadow: boxed ? "" : shadow,
    });
    this.lText[j] = w.text;
    this.lKind[j] = w.kind;
    this.lColor[j] = w.color;
  }

  private placeLabels(dt: number, weight: number) {
    const layer = this.layer;
    if (!layer || !this.cam) return;
    if (!layer.begin(weight * (this.room > 0.6 ? 1 : 0))) return;
    const M = this.root.matrixWorld;
    const cam = this.cam;
    const k = 1 - Math.exp(-dt * 9);
    // Index labels beside the question nodes (the cards show the same "01", "02" ...).
    const P = this.gl.dots.cur;
    const al = this.side > 0 ? IDX_RIGHT : IDX_LEFT;
    for (let i = 0; i < this.idxIds.length; i++) {
      const id = this.idxIds[i];
      this.idxO[i] += (this.idxA[i] - this.idxO[i]) * k;
      if (i >= this.items.length || this.idxO[i] < 0.03) {
        layer.hide(id);
        continue;
      }
      if (this.idxSide !== this.side) layer.setAlign(id, al);
      layer.place(id, P[i * 8], P[i * 8 + 1], P[i * 8 + 2], M, cam, this.W, this.H, this.idxO[i]);
    }
    this.idxSide = this.side;
    // Visual labels: fade out, swap text while invisible, fade in.
    for (let j = 0; j < L_VIS; j++) {
      const id = this.visIds[j];
      const w = j < this.wantN ? this.want[j] : null;
      const same = !!w && w.text === this.lText[j] && w.kind === this.lKind[j] && w.color === this.lColor[j];
      const target = w && same ? w.alpha : 0;
      this.lAlpha[j] += (target - this.lAlpha[j]) * k;
      if (w && !same && this.lAlpha[j] < 0.04) {
        this.restyle(j, w);
      }
      if (this.lAlpha[j] < 0.02 || !w) {
        if (this.lAlpha[j] < 0.02) layer.hide(id);
        if (!w) continue;
      }
      const al = this.lAlign[j];
      const dx = w.ax === 0 ? 12 : w.ax === -1 ? -12 : 0;
      const dy = w.ay === -1 ? -10 : w.ay === 0 ? 10 : 0;
      if (al.x !== w.ax || al.y !== w.ay || al.dx !== dx || al.dy !== dy) {
        al.x = w.ax;
        al.y = w.ay;
        al.dx = dx;
        al.dy = dy;
        layer.setAlign(id, al);
      }
      if (this.lAlpha[j] >= 0.02) layer.place(id, w.x, w.y, w.z, M, cam, this.W, this.H, this.lAlpha[j]);
    }
  }

  // ------------------------------------------------------------ frame

  /** Screen px → world point on the plane z = 0 (through the live camera). */
  private lift(px: number, py: number, out: Vector3) {
    const cam = this.cam as PerspectiveCamera;
    ray.set((px / this.W) * 2 - 1, 1 - (py / this.H) * 2, 0.5).unproject(cam).sub(cam.position);
    const t = -cam.position.z / (ray.z || -1e-6);
    return out.copy(cam.position).addScaledVector(ray, t);
  }

  frame(time: number, dt: number, camera: Camera, size: { width: number; height: number }, canvas: HTMLCanvasElement, weight: number, focus: string | null) {
    if (weight <= 0.001) {
      if (this.root.visible) this.layer?.hideAll();
      this.root.visible = false;
      return;
    }
    const d = Math.min(dt, 0.1);
    this.time = time;
    this.cam = camera;
    this.W = size.width;
    this.H = size.height;
    if (this.dirty) this.measure(canvas);
    const n = this.items.length;

    // Where: the window (desktop), else the scene's free rect (phones: the opening).
    // Only the window's part on screen (below the header) frames the visual.
    let l = this.wl;
    let t = Math.max(this.wt, HEADER_PX + 6);
    let w = this.ww;
    let h = Math.min(this.wt + this.wh, this.H - 6) - t;
    let ok = this.winOk && n > 0 && h > 200;
    if (!this.winOk && n > 0) {
      const r = sceneFrames.faq.rect;
      l = r.l * this.W;
      w = (r.r - r.l) * this.W;
      t = Math.max(r.t * this.H, framing.phone ? 56 : HEADER_PX);
      h = Math.min(r.b * this.H, this.H) - t;
      ok = w > MIN_WIN && h > 130;
    }
    // Share of the window on screen (it rides in and out with the section).
    const vis = ok ? clamp01((h - 200) / 160) : 0;
    this.room += ((ok ? smooth(vis) : 0) - this.room) * (1 - Math.exp(-d * 6));
    if (this.room < 0.01 && !ok) {
      this.layer?.hideAll();
      this.root.visible = false;
      return;
    }
    this.root.visible = true;
    camera.updateMatrixWorld();
    const cxPx = l + w / 2;
    const cyPx = t + h / 2;
    this.lift(cxPx, cyPx, v0);
    this.lift(cxPx + 100, cyPx, v1);
    const per = v0.distanceTo(v1) / 100;
    this.root.position.copy(v0);
    this.root.scale.setScalar(per);
    this.root.updateMatrixWorld(true);
    this.gl.setOpacity(smooth(weight) * this.room);

    // Which question: the open one, else a question hovered/focused for a moment.
    const fi = focus ? (this.byId.get(focus) ?? -1) : -1;
    if (fi !== this.hoverIdx) {
      this.hoverIdx = fi;
      this.hoverSince = time;
    }
    let subj = this.openIdx < n ? this.openIdx : -1;
    if (subj < 0 && this.hoverIdx >= 0 && time - this.hoverSince > DWELL_S) subj = this.hoverIdx;
    if (subj !== this.subject) {
      this.subject = subj;
      this.switchT = time;
      this.kind = subj >= 0 ? this.items[subj].kind : "field";
    }
    if (this.kind === "clock") tickClock(this.pre, this.data);

    this.layout(time, w, h, cyPx, n);

    // Ease + upload (the active node is where new parts fly in from).
    const sO = Math.max(0, this.subject) * 8;
    const cur = this.gl.dots.cur;
    this.gl.ease(d, time - this.switchT, 2 * QMAX, cur[sO], cur[sO + 1], cur[sO + 2]);
    this.gl.upload(per, this.W, this.H, time);
    this.placeLabels(d, weight);
  }

  private layout(time: number, w: number, h: number, cyPx: number, n: number) {
    const gl = this.gl;
    const col = this.col;
    const side = this.side;
    const rail = this.winOk;
    const answer = this.subject >= 0;
    const R = Math.max(70, Math.min(w * 0.36, h * 0.4));
    const vx = side * Math.min(w * 0.06, 34);
    const vy = 0;
    const railX = side * (-w / 2 + 12);
    const half = h / 2 - 16;
    const coreX = vx + side * R * 0.36;
    const hot = this.hoverIdx >= 0 ? 1 : 0;
    this.wantN = 0;

    // ---- question nodes (field when idle, rail when answering)
    const D0 = QMAX;
    for (let i = 0; i < QMAX; i++) {
      if (i >= n) {
        gl.dots.tgt[i * 8 + 7] = 0;
        gl.dots.tgt[(D0 + i) * 8 + 7] = 0;
        hideArc(gl, i);
        hideArc(gl, QMAX + i);
        hideSeg(gl, i);
        hideSeg(gl, QMAX + i);
        this.idxA[i] = 0;
        continue;
      }
      // Level with its card on desktop; evenly spread in the opening on phones.
      let y = rail ? cyPx - this.ys[i] : (0.5 - (i + 0.5) / n) * h * 0.78;
      const inView = rail ? clamp01((half + 10 - Math.abs(y)) / 34) : 1;
      y = Math.max(-half, Math.min(half, y));
      const isSub = i === this.subject;
      const isHover = i === this.hoverIdx;
      const ph = 1.9 * i + 0.7;
      let x: number;
      let z: number;
      if (!answer) {
        x = vx - side * R * 0.62 + side * R * 0.2 * Math.sin(ph) + (isHover ? side * R * 0.12 : 0);
        z = R * 0.28 * Math.cos(ph) + 6 * Math.sin(time * 0.8 + i) + (isHover ? R * 0.5 : 0);
        y += 3 * Math.sin(time * 0.9 + i * 1.3);
      } else {
        x = railX;
        z = isSub ? 8 : 0;
      }
      const lit = isSub || (isHover && !answer);
      const c = lit ? col.accent : isHover ? col.fg : col.ai;
      const size = answer ? (isSub ? 18 : isHover ? 13 : 9) : isHover ? 30 : 18;
      dot(gl, i, x, y, z, c, size, inView * (answer ? (isSub ? 1 : isHover ? 0.9 : 0.55) : isHover ? 1 : 0.85));
      // Satellite (idle only).
      const so = time * 1.3 + i * 2.1;
      dot(gl, D0 + i, x + Math.cos(so) * 22, y + Math.sin(so) * 7, z + Math.sin(so) * 22, col.fg, 7, answer ? 0 : 0.55 * inView);
      // Halo and orbit.
      if (!answer || isSub) {
        const pulse = answer ? (time * 0.7) % 1 : 0;
        arc(gl, i, x, y, z, 0, 0, time * 0.3 + i, (answer ? 14 : isHover ? 22 : 13) + 22 * pulse, isSub || isHover ? 1.8 : 1.1, 0, 1, lit ? col.accent : col.ai, (answer ? 0.9 * (1 - pulse) : isHover ? 0.95 : 0.45) * inView, 0, 0, 0.5);
        arc(gl, QMAX + i, x, y, z, 1.25, time * 0.5 + i, 0, isHover || isSub ? 30 : 21, 1, 0, 1, lit ? col.accent : col.muted, (answer ? 0.5 : isHover ? 0.7 : 0.32) * inView, dashes(16, 0.5), 0, 0);
      } else {
        hideArc(gl, i);
        hideArc(gl, QMAX + i);
      }
      // Threads: window edge → node (its card's link) and node → core (idle);
      // the rail spine (answering).
      if (!answer) {
        if (rail) seg(gl, i, railX, y, 0, x, y, z, isHover ? col.accent : col.ai, (isHover ? 0.8 : 0.24) * inView, isHover ? 1.8 : 1.1, 1, 0.6);
        else hideSeg(gl, i);
        seg(gl, QMAX + i, x, y, z, coreX, vy, 0, isHover ? col.accent : col.ai, (isHover ? 0.65 : 0.16) * inView, isHover ? 1.6 : 1, 2, 0.35);
      } else {
        if (i < n - 1) {
          const y2 = rail ? Math.max(-half, Math.min(half, cyPx - this.ys[i + 1])) : (0.5 - (i + 1.5) / n) * h * 0.78;
          seg(gl, i, railX, y, 0, railX, y2, 0, col.muted, 0.3 * inView, 1, 0, 0);
        } else hideSeg(gl, i);
        hideSeg(gl, QMAX + i);
      }
      this.idxA[i] = inView * (answer ? (isHover && !isSub ? 1 : 0) : isHover ? 1 : 0.6);
    }

    // ---- the beam from the active node into the visual (with two packets riding it)
    const P = gl.dots.cur;
    if (answer) {
      const s0 = this.subject;
      const ax = railX;
      const ay = rail ? Math.max(-half, Math.min(half, cyPx - this.ys[s0])) : P[s0 * 8 + 1];
      // Inlet: the point of the visual's frame facing the node.
      const dx = ax - vx;
      const dy = ay - vy;
      const dl = Math.max(1, Math.hypot(dx, dy));
      const ix = vx + (dx / dl) * R * 0.97;
      const iy = vy + (dy / dl) * R * 0.97;
      const c1x = ax + side * Math.min(80, Math.abs(ix - ax) * 0.6);
      for (let k = 0; k < BEAM; k++) {
        bez(ax, ay, c1x, ay, ix - (dx / dl) * 40, iy - (dy / dl) * 40, ix, iy, k / BEAM, bz0);
        bez(ax, ay, c1x, ay, ix - (dx / dl) * 40, iy - (dy / dl) * 40, ix, iy, (k + 1) / BEAM, bz1);
        seg(gl, S_BEAM + k, bz0[0], bz0[1], 4, bz1[0], bz1[1], 4, col.accent, 0.85, 2, 0, 0);
      }
      for (let k = 0; k < 2; k++) {
        const u = (time * 0.55 + k * 0.5) % 1;
        bez(ax, ay, c1x, ay, ix - (dx / dl) * 40, iy - (dy / dl) * 40, ix, iy, u, bz0);
        dot(gl, 2 * QMAX + k, bz0[0], bz0[1], 6, col.accent, 14, Math.sin(u * Math.PI));
      }
    } else {
      for (let k = 0; k < BEAM; k++) hideSeg(gl, S_BEAM + k);
      gl.dots.tgt[2 * QMAX * 8 + 7] = 0;
      gl.dots.tgt[(2 * QMAX + 1) * 8 + 7] = 0;
    }

    // ---- the visual
    const ctx = this.ctx;
    ctx.gl = gl;
    ctx.data = this.data;
    ctx.col = col;
    ctx.t = time;
    ctx.R = R;
    ctx.vx = vx;
    ctx.vy = vy;
    ctx.low = this.low;
    ctx.side = side;
    ctx.item = answer ? this.items[this.subject] : null;
    ctx.D = D_VIS;
    ctx.A = A_VIS;
    ctx.S = S_VIS;
    ctx.pre = this.pre;
    let used: Used;
    switch (this.kind) {
      case "career":
        used = career(ctx);
        break;
      case "stack":
        used = stack(ctx, ctx.item?.topic !== "stack");
        break;
      case "beacon":
        used = beacon(ctx);
        break;
      case "clock":
        used = clock(ctx);
        break;
      case "figures":
        used = figures(ctx);
        break;
      case "verdict":
        used = verdict(ctx);
        break;
      case "bloom":
        used = bloom(ctx);
        break;
      default:
        used = field(ctx, coreX, vy, hot);
    }
    hideRange(gl.dots.tgt, 8, 7, used.d, N_DOTS - DUST);
    gl.arcs.hideFrom(used.a);
    gl.segs.hideFrom(used.s);

    // ---- dust drifting through the window
    const nd = this.low ? DUST / 2 : DUST;
    for (let k = 0; k < DUST; k++) {
      const i = N_DOTS - DUST + k;
      if (k >= nd) {
        gl.dots.tgt[i * 8 + 7] = 0;
        continue;
      }
      const x = (hash(k) - 0.5) * w * 0.92 + 14 * Math.sin(time * 0.13 + k);
      const y = (hash(k + 50) - 0.5) * h * 0.9 + 10 * Math.cos(time * 0.11 + k * 1.7);
      const z = (hash(k + 99) - 0.5) * R;
      dot(gl, i, x, y, z, k % 3 ? col.muted : col.ai, 4 + 3 * hash(k + 7), answer ? 0.18 : 0.32);
    }

  }

  private readonly ctx: Ctx = {
    gl: null as unknown as FaqGL,
    data: null as unknown as NeuralData,
    col: null as unknown as Colors,
    t: 0,
    R: 1,
    vx: 0,
    vy: 0,
    low: false,
    side: 1,
    item: null,
    D: 0,
    A: 0,
    S: 0,
    label: this.label,
    pre: null as unknown as Pre,
  };

  dispose() {
    this.gl.dispose();
  }
}

const bz0 = [0, 0];
const bz1 = [0, 0];
/** Cubic Bézier point at u (2D) → out. */
function bez(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, u: number, out: number[]) {
  const m = 1 - u;
  const a = m * m * m;
  const b = 3 * m * m * u;
  const c = 3 * m * u * u;
  const e = u * u * u;
  out[0] = a * x0 + b * x1 + c * x2 + e * x3;
  out[1] = a * y0 + b * y1 + c * y2 + e * y3;
}

function hideArc(gl: FaqGL, i: number) {
  gl.arcs.tgt[i * 17 + 13] = 0;
}
function hideSeg(gl: FaqGL, i: number) {
  gl.segs.tgt[i * 13 + 9] = 0;
}
function hideRange(tgt: Float32Array, stride: number, alpha: number, from: number, to: number) {
  for (let i = from; i < to; i++) tgt[i * stride + alpha] = 0;
}
