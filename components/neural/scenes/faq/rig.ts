// The FAQ scene as plain three.js objects driven by `frame()` (lazy 3D chunk).
// Where: the section's empty sticky window ([data-faq-window], desktop) beside the question
// cards; below lg, the section's opening while nothing is open and, once a question opens,
// the empty slot under its card ([data-faq-pic]). Never under text. Laid out in screen px
// every frame and lifted into the world through the live camera.
// What:
// - Idle: the question field. One node per question, level with its card, its index ("01")
//   at the window's edge where the card's thread enters; each node is a small glyph of its
//   answer's picture, threads converge on a glass answer core with one spark per question.
// - A question open (or hovered/focused for a moment while none is open): the nodes fold
//   into a rail on the window's edge (the open card's connector meets its node), the old
//   picture fades out, a beam runs from the node to where the new one assembles
//   (visuals.ts).
// Three instanced draw calls; DOM reads only on scroll/resize/toggle; nothing allocates per
// frame. Labels are aria-hidden duplicates of the page's text (shared label layer rules).
import { Color, Group, Vector3, type Camera, type PerspectiveCamera } from "three";
import { framing, sceneFrames } from "../../framing";
import type { NeuralData, ScenePalette } from "../../types";
import { isLightBg, layerColors, paletteColor } from "../stack/gl";
import type { Align, LabelLayer } from "../stack/labels";
import { ARC, FaqGL, SEG, arc, dashes, dot, seg } from "./gl";
import {
  beacon,
  bez,
  career,
  clock,
  field,
  figures,
  list,
  path,
  prepare,
  stack,
  tickClock,
  verdict,
  versus,
  type Colors,
  type Ctx,
  type Item,
  type Kind,
  type LabelKind,
  type Pre,
  type Said,
  type Used,
} from "./visuals";

const QMAX = 12; // question nodes drawn (pages list 5-8)
const N_DOTS = 200;
const N_ARCS = 72;
const N_SEGS = 140;
const DUST = 24;
const BEAM = 8; // beam segments
const D_VIS = 2 * QMAX + 2; // dots: nodes, satellites, 2 beam packets, then the visual
const A_VIS = 2 * QMAX; // arcs: node glyphs (2 each), then the visual
const S_BEAM = 2 * QMAX; // segs: threads, core threads, the beam, then the visual
const S_VIS = S_BEAM + BEAM;
const L_VIS = 22; // visual labels
const DWELL_S = 0.7; // hover/focus this long (nothing open) previews a question's answer
const OUT_S = 0.22; // the old picture fades this long before the next one assembles
const MIN_WIN = 160;
const HEADER_PX = 64;
const INSET = 16; // labels stay this far inside the window

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
const NEGATION = /\b(?:don't|do not|never|not|no)\b/i;

/** Skills the answer names in a positive clause (a "never in git" does not feature git), most used first. */
function namedSkills(text: string, data: NeuralData): number[] {
  const clauses = text.split(/[.;:—()]/).filter((c) => !NEGATION.test(c));
  const out: number[] = [];
  data.skills.forEach((s, i) => {
    const key = s.name.toLowerCase();
    const re = new RegExp(String.raw`(?:^|[^a-z0-9])(?:${ALIAS[key] ?? esc(key)})(?![a-z0-9])`, "i");
    if (clauses.some((c) => re.test(c))) out.push(i);
  });
  return out.sort((a, b) => data.skills[b].uses - data.skills[a].uses);
}

function kindOf(topic: string, q: string, said: Said, named: number[], data: NeuralData): Kind {
  if (topic === "experience" && data.experience.length) return "career";
  if (topic === "timezone") return "clock";
  if (topic === "availability") return "beacon";
  if (said.o.length >= 2) return "versus";
  if (topic === "stack" && /\bstack\b|speciali/i.test(q) && data.skills.length) return "stack";
  if (said.f.length) return "figures";
  if (said.v) return "verdict";
  if (named.length >= 3 && said.l !== "enum" && data.skills.length) return "stack";
  if (said.l === "enum" && said.s.length >= 2) return "list";
  return "path";
}

const EMPTY: Said = { f: [], v: null, s: [], l: "say", h: null, o: [] };

const LABEL_CLASS: Record<LabelKind, string> = {
  tag: "font-mono text-[10px] uppercase leading-none tracking-[0.16em]",
  name: "font-mono text-[11px] leading-[14px] tracking-[0.02em]",
  sub: "font-mono text-[10px] leading-[13px] tracking-[0.02em]",
  plate: "rounded-[3px] px-[5px] py-[2px] font-mono text-[10.5px] uppercase leading-[13px] tracking-[0.1em]",
  fig: "font-mono text-[13px] font-semibold leading-none tabular-nums",
  big: "font-sans text-[24px] font-semibold leading-none tracking-[-0.02em] tabular-nums",
  cap: "font-sans text-[12.5px] leading-[17px]",
};
const IDX_CLASS = "font-mono text-[11.5px] leading-none tracking-[0.12em] tabular-nums";

type Want = { text: string; kind: LabelKind; x: number; y: number; ax: number; ay: number; alpha: number; color: Color | null; maxW: number };

const IDX_RIGHT: Align = { x: 0, y: -0.5 };
const IDX_LEFT: Align = { x: -1, y: -0.5 };

const ray = new Vector3();
const v0 = new Vector3();
const v1 = new Vector3();
const vp = new Vector3();

export class FaqRig {
  readonly root = new Group();
  readonly gl = new FaqGL(N_DOTS, N_ARCS, N_SEGS);
  private col: Colors;
  private css = new Map<Color, string>();
  private fgCss = "";
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
  private readonly docY = new Float32Array(QMAX);
  private layoutDirty = true;
  private followUntil = 0;
  private listX = 0;
  private cTop = 0;
  private wl = 0;
  private wt = 0;
  private ww = 0;
  private wh = 0;
  private winOk = false;
  /** Below lg: the open card's picture slot (canvas px), and the top of the head under the opening. */
  private pic = { l: 0, t: 0, w: 0, h: 0, ok: false };
  private headTop = 0;
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

  // Labels.
  private layer: LabelLayer | null = null;
  private idxIds: number[] = [];
  private visIds: number[] = [];
  private readonly lText: string[] = [];
  private readonly lKind: LabelKind[] = [];
  private readonly lColor: (Color | null)[] = [];
  private readonly lMax = new Float32Array(L_VIS);
  private readonly lW = new Float32Array(L_VIS);
  private readonly lH = new Float32Array(L_VIS);
  private readonly lAlpha = new Float32Array(L_VIS);
  private readonly lAlign: Align[] = [];
  private readonly want: Want[] = [];
  private wantN = 0;
  private readonly idxA = new Float32Array(QMAX);
  private readonly idxO = new Float32Array(QMAX);
  private readonly idxX = new Float32Array(QMAX);
  private readonly idxLit = new Uint8Array(QMAX);
  private idxSide = 0;
  // The labels' rect (canvas px) this frame: the window's inner rect.
  private bl = 0;
  private bt = 0;
  private br = 0;
  private bb = 0;

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
      this.want.push({ text: "", kind: "tag", x: 0, y: 0, ax: 0, ay: 0, alpha: 0, color: null, maxW: 0 });
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
    this.fgCss = p.fg;
    this.chipBg = `color-mix(in srgb, ${p.bg} 78%, transparent)`;
    this.bgCss = p.bg;
    this.gl.setLight(light);
    // Restyle the labels in their current text.
    for (let j = 0; j < L_VIS; j++) this.lText[j] = "\u0000";
    this.idxLit.fill(2);
  }

  // ------------------------------------------------------------ DOM

  /** Listeners for scroll / resize / toggles; returns the cleanup. */
  attach(): () => void {
    const schedule = () => {
      this.dirty = true;
    };
    const relayout = () => {
      this.dirty = true;
      this.layoutDirty = true;
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
      // The cards slide while answers open and close: follow them until the accordion settles.
      this.followUntil = performance.now() + 900;
      relayout();
    };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", relayout, { passive: true });
    document.addEventListener("toggle", onToggle, true);
    // Answers opening and closing (and anything else that resizes the page) move the cards.
    const ro = new ResizeObserver(relayout);
    ro.observe(document.body);
    document.fonts?.ready.then(relayout);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", relayout);
      document.removeEventListener("toggle", onToggle, true);
      ro.disconnect();
      this.section?.removeAttribute("data-faq-live");
    };
  }

  private build(section: HTMLElement | null) {
    this.section?.removeAttribute("data-faq-live");
    this.section = section;
    section?.setAttribute("data-faq-live", "");
    this.win = section?.querySelector<HTMLElement>("[data-faq-window]") ?? null;
    const els = section ? Array.from(section.querySelectorAll<HTMLDetailsElement>("details[data-faq-item]")).slice(0, QMAX) : [];
    this.items = els.map((el, i) => {
      const id = el.dataset.focusId ?? `faq:other:${i}`;
      const topic = id.split(":")[1] ?? "other";
      let said = EMPTY;
      try {
        said = { ...EMPTY, ...(JSON.parse(el.dataset.faq ?? "{}") as Partial<Said>) };
      } catch {
        said = EMPTY;
      }
      said.f = said.f.slice(0, 4);
      const named = namedSkills(el.querySelector(".faq-a")?.textContent ?? "", this.data);
      const q = el.querySelector("summary")?.textContent ?? "";
      return {
        el,
        sum: el.querySelector<HTMLElement>("summary") ?? el,
        pic: el.parentElement?.querySelector<HTMLElement>("[data-faq-pic]") ?? null,
        id,
        topic,
        index: pad(i + 1),
        said,
        named,
        kind: kindOf(topic, q, said, named, this.data),
        variant: 0,
      };
    });
    // Two questions in a row never get the same picture: the second takes the other layout.
    for (let i = 1; i < this.items.length; i++) if (this.items[i].kind === this.items[i - 1].kind) this.items[i].variant = this.items[i - 1].variant ^ 1;
    this.byId = new Map(this.items.map((it, i) => [it.id, i]));
    this.openOrder = this.items.flatMap((it, i) => (it.el.open ? [i] : []));
    this.openIdx = this.openOrder.length ? this.openOrder[this.openOrder.length - 1] : -1;
    this.subject = -2;
    this.layoutDirty = true;
    this.pre.selFor = null;
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
    this.cTop = c.top;
    if (this.win && !this.win.isConnected) this.win = this.section.querySelector<HTMLElement>("[data-faq-window]");
    const r = this.win?.getBoundingClientRect();
    this.winOk = !!r && r.width > MIN_WIN && r.height > MIN_WIN;
    if (r && this.winOk) {
      this.wl = r.left - c.left;
      this.wt = r.top - c.top;
      this.ww = r.width;
      this.wh = r.height;
    }
    const pic = this.pic;
    pic.ok = false;
    if (!this.winOk) {
      const head = this.section.querySelector(".faq-grid");
      this.headTop = head ? head.getBoundingClientRect().top - c.top : this.H;
      const open = this.openIdx >= 0 ? this.items[this.openIdx]?.pic : null;
      const pr = open?.getBoundingClientRect();
      if (pr && pr.height > 60) {
        pic.l = pr.left - c.left;
        pic.t = pr.top - c.top;
        pic.w = pr.width;
        pic.h = pr.height;
        pic.ok = true;
      }
    }
    // Question lines in document px from the layout (offsets ignore the cards' entrance
    // transforms, which would put a node beside where its card is still flying in from).
    if (this.layoutDirty) {
      this.layoutDirty = false;
      let listX = 0;
      for (let i = 0; i < this.items.length; i++) {
        const sum = this.items[i].sum;
        let y = 0;
        let x = 0;
        for (let e: HTMLElement | null = sum; e; e = e.offsetParent as HTMLElement | null) {
          y += e.offsetTop;
          x += e.offsetLeft;
        }
        this.docY[i] = y + Math.min(28, sum.offsetHeight / 2);
        if (i === 0) listX = x + sum.offsetWidth / 2 - window.scrollX;
      }
      this.listX = listX;
    }
    this.side = !this.winOk || this.listX - c.left < this.wl + this.ww / 2 ? 1 : -1;
  }

  // ------------------------------------------------------------ labels

  attachLabels(layer: LabelLayer | null) {
    this.layer = layer;
    this.idxIds = [];
    this.visIds = [];
    if (!layer) return;
    for (let i = 0; i < QMAX; i++) this.idxIds.push(layer.add(pad(i + 1), "", IDX_CLASS, IDX_RIGHT));
    this.idxSide = 0;
    this.idxLit.fill(2);
    for (let j = 0; j < L_VIS; j++) {
      this.visIds.push(layer.add("", "", LABEL_CLASS.tag, this.lAlign[j]));
      this.lText[j] = "\u0000";
    }
  }

  private label = (text: string, kind: LabelKind, x: number, y: number, ax: number, ay: number, color: Color | null, maxW: number, alpha: number) => {
    if (!text || this.wantN >= L_VIS) return;
    const w = this.want[this.wantN++];
    w.text = text;
    w.kind = kind;
    w.x = x;
    w.y = y;
    w.ax = ax;
    w.ay = ay;
    w.alpha = alpha;
    w.color = color;
    w.maxW = maxW > 0 ? Math.round(Math.max(90, maxW)) : 0;
  };

  private restyle(j: number, w: Want) {
    const layer = this.layer!;
    const id = this.visIds[j];
    const el = layer.el.children[id] as HTMLElement | undefined;
    if (!el) return;
    el.textContent = w.text;
    el.className = LABEL_CLASS[w.kind];
    const own = (w.color && this.css.get(w.color)) || "";
    const fg = this.fgCss;
    const muted = this.css.get(this.col.muted) ?? fg;
    const color = w.kind === "tag" || w.kind === "sub" ? muted : w.kind === "cap" ? own || `color-mix(in srgb, ${fg} 86%, transparent)` : own || fg;
    layer.style(id, {
      color,
      background: w.kind === "plate" ? this.chipBg : "",
      textShadow: w.kind === "plate" ? "" : `0 0 3px ${this.bgCss}, 0 0 8px ${this.bgCss}, 0 0 14px ${this.bgCss}`,
      whiteSpace: w.maxW ? "normal" : "nowrap",
      maxWidth: w.maxW ? `${w.maxW}px` : "",
      width: w.maxW ? "max-content" : "",
      textAlign: w.ax === -0.5 ? "center" : w.ax === -1 ? "right" : "left",
    });
    this.lW[j] = el.offsetWidth;
    this.lH[j] = el.offsetHeight;
    this.lText[j] = w.text;
    this.lKind[j] = w.kind;
    this.lColor[j] = w.color;
    this.lMax[j] = w.maxW;
  }

  private styleIndex(i: number, lit: boolean) {
    const css = lit ? (this.css.get(this.col.accent) ?? "") : `color-mix(in srgb, ${this.fgCss} 72%, transparent)`;
    this.layer?.style(this.idxIds[i], { color: css, textShadow: `0 0 3px ${this.bgCss}, 0 0 8px ${this.bgCss}`, fontWeight: lit ? "600" : "400" });
    this.idxLit[i] = lit ? 1 : 0;
  }

  private placeLabels(dt: number, weight: number) {
    const layer = this.layer;
    if (!layer || !this.cam) return;
    if (!layer.begin(weight * (this.room > 0.6 ? 1 : 0))) return;
    const M = this.root.matrixWorld;
    const cam = this.cam;
    const k = 1 - Math.exp(-dt * 9);
    // Index labels at the window's edge, level with their cards (the cards show "01", "02" ...).
    const P = this.gl.dots.cur;
    if (this.idxSide !== this.side) {
      for (const id of this.idxIds) layer.setAlign(id, this.side > 0 ? IDX_RIGHT : IDX_LEFT);
      this.idxSide = this.side;
    }
    for (let i = 0; i < this.idxIds.length; i++) {
      const id = this.idxIds[i];
      this.idxO[i] += (this.idxA[i] - this.idxO[i]) * k;
      if (i >= this.items.length || this.idxO[i] < 0.03) {
        layer.hide(id);
        continue;
      }
      const lit = i === this.hoverIdx || i === this.subject;
      if (this.idxLit[i] !== (lit ? 1 : 0)) this.styleIndex(i, lit);
      layer.place(id, this.idxX[i], P[i * 8 + 1], 0, M, cam, this.W, this.H, this.idxO[i]);
    }
    // Visual labels: fade out, swap text while invisible, fade in; kept inside the window.
    for (let j = 0; j < L_VIS; j++) {
      const id = this.visIds[j];
      const w = j < this.wantN ? this.want[j] : null;
      if (!w) {
        // No label for this slot any more: gone at once (it would hang at its last spot).
        this.lAlpha[j] = 0;
        layer.hide(id);
        continue;
      }
      const same = w.text === this.lText[j] && w.kind === this.lKind[j] && w.color === this.lColor[j] && w.maxW === this.lMax[j];
      this.lAlpha[j] += ((same ? w.alpha : 0) - this.lAlpha[j]) * k;
      if (!same && this.lAlpha[j] < 0.04) this.restyle(j, w);
      if (this.lAlpha[j] < 0.02) {
        layer.hide(id);
        continue;
      }
      const al = this.lAlign[j];
      const dx = w.ax === 0 ? 10 : w.ax === -1 ? -10 : 0;
      const dy = w.ay === -1 ? -8 : w.ay === 0 ? 8 : 0;
      if (al.x !== w.ax || al.y !== w.ay || al.dx !== dx || al.dy !== dy) {
        al.x = w.ax;
        al.y = w.ay;
        al.dx = dx;
        al.dy = dy;
        layer.setAlign(id, al);
      }
      // Clamp the box into the window's inner rect (local units are canvas px at z = 0).
      vp.set(w.x, w.y, 0).applyMatrix4(M).project(cam);
      const bx = ((vp.x + 1) / 2) * this.W + al.x * this.lW[j] + dx;
      const by = ((1 - vp.y) / 2) * this.H + al.y * this.lH[j] + dy;
      const ox = bx < this.bl ? this.bl - bx : bx + this.lW[j] > this.br ? Math.max(this.bl - bx, this.br - bx - this.lW[j]) : 0;
      const oy = by < this.bt ? this.bt - by : by + this.lH[j] > this.bb ? Math.max(this.bt - by, this.bb - by - this.lH[j]) : 0;
      layer.place(id, w.x + ox, w.y - oy, 0, M, cam, this.W, this.H, this.lAlpha[j]);
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
    this.cam = camera;
    this.W = size.width;
    this.H = size.height;
    if (this.followUntil > 0) {
      if (performance.now() < this.followUntil) this.layoutDirty = true;
      else this.followUntil = 0;
    }
    if (this.dirty || this.layoutDirty) this.measure(canvas);
    const n = this.items.length;
    const sy = window.scrollY + this.cTop;
    for (let i = 0; i < n; i++) this.ys[i] = this.docY[i] - sy;

    // Where: the window (desktop); below lg the open card's slot, else the section's opening.
    let l = this.wl;
    let t = Math.max(this.wt, HEADER_PX + 6);
    let w = this.ww;
    let h = Math.min(this.wt + this.wh, this.H - 6) - t;
    let vis = 0;
    if (this.winOk) vis = n > 0 ? clamp01((h - 200) / 160) : 0;
    else if (n > 0 && this.pic.ok) {
      const p = this.pic;
      l = p.l + 4;
      w = p.w - 8;
      t = p.t + 6;
      h = p.h - 12;
      vis = clamp01((Math.min(t + h, this.H) - Math.max(t, 56)) / (h * 0.55));
    } else if (n > 0) {
      const r = sceneFrames.faq.rect;
      l = r.l * this.W;
      w = (r.r - r.l) * this.W;
      t = Math.max(r.t * this.H, framing.phone ? 56 : HEADER_PX);
      h = Math.min(r.b * this.H, this.H, this.headTop - 10) - t;
      vis = w > MIN_WIN ? clamp01((h - 110) / 90) : 0;
    }
    const ok = vis > 0;
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
    this.bl = l + INSET;
    this.br = l + w - INSET;
    this.bt = t + 10;
    this.bb = t + h - 10;

    // Which question: the open one, else a question hovered/focused for a moment.
    const fi = focus ? (this.byId.get(focus) ?? -1) : -1;
    if (fi !== this.hoverIdx) {
      this.hoverIdx = fi;
      this.hoverSince = time;
    }
    let subj = this.openIdx < n ? this.openIdx : -1;
    if (subj < 0 && this.hoverIdx >= 0 && time - this.hoverSince > DWELL_S) subj = this.hoverIdx;
    let fresh = false;
    if (subj !== this.subject) {
      fresh = this.subject === -2;
      this.subject = subj;
      this.switchT = fresh ? time - OUT_S : time;
      this.kind = subj >= 0 ? this.items[subj].kind : "field";
    }
    if (this.kind === "clock") tickClock(this.pre, this.data);
    const since = time - this.switchT;
    const out = since < OUT_S;

    this.layout(time, w, h, cyPx, n, out);

    // Ease + upload (the active node is where new parts fly in from).
    const sO = Math.max(0, this.subject) * 8;
    const cur = this.gl.dots.cur;
    this.gl.ease(d, since - OUT_S, 2 * QMAX, cur[sO], cur[sO + 1], cur[sO + 2], out);
    this.gl.upload(per, this.W, this.H, time);
    this.placeLabels(d, weight);
  }

  private layout(time: number, w: number, h: number, cyPx: number, n: number, out: boolean) {
    const gl = this.gl;
    const col = this.col;
    const side = this.side;
    const rail = this.winOk;
    const answer = this.subject >= 0;
    const R = Math.max(70, Math.min(w * 0.36, h * 0.4));
    const vx = side * Math.min(w * 0.06, 34);
    const vy = 0;
    const railX = side * (-w / 2 + (rail ? 12 : 18));
    const half = h / 2 - 16;
    const coreX = vx + side * R * 0.4;
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
      // Level with its card on desktop; evenly spread in the opening (or slot) on phones.
      let y = rail ? cyPx - this.ys[i] : (0.5 - (i + 0.5) / n) * h * 0.8;
      const inView = rail ? clamp01((half + 10 - Math.abs(y)) / 34) : 1;
      y = Math.max(-half, Math.min(half, y));
      const isSub = i === this.subject;
      const isHover = i === this.hoverIdx;
      const ph = 1.9 * i + 0.7;
      let x: number;
      let z: number;
      if (!answer) {
        x = vx - side * R * 0.56 + side * R * 0.18 * Math.sin(ph) + (isHover ? side * R * 0.1 : 0);
        z = R * 0.2 * Math.cos(ph) + 5 * Math.sin(time * 0.8 + i) + (isHover ? R * 0.35 : 0);
        y += 3 * Math.sin(time * 0.9 + i * 1.3);
      } else {
        x = railX;
        z = isSub ? 8 : 0;
      }
      const lit = isSub || (isHover && !answer);
      const c = lit ? col.accent : col.ai;
      const size = answer ? (isSub ? 18 : isHover ? 13 : 9) : isHover ? 26 : 16;
      dot(gl, i, x, y, z, c, size, inView * (answer ? (isSub ? 1 : isHover ? 0.9 : 0.55) : 1));
      // Satellite (idle only).
      const so = time * 1.1 + i * 2.1;
      const sr = isHover ? 30 : 24;
      dot(gl, D0 + i, x + Math.cos(so) * sr, y + Math.sin(so) * 6, z + Math.sin(so) * sr, col.fg, 6, answer ? 0 : 0.6 * inView);
      // Glyph: idle, each node previews its answer's picture; answering, the active node pulses.
      if (answer && isSub) {
        const pulse = (time * 0.7) % 1;
        arc(gl, i, x, y, z, 0, 0, 0, 12 + 22 * pulse, 1.4, 0, 1, col.accent, 0.9 * (1 - pulse) * inView, 0, 0, 0.5);
        arc(gl, QMAX + i, x, y, z, 1.25, time * 0.5 + i, 0, 26, 1, 0, 1, col.accent, 0.5 * inView, dashes(16, 0.5), 0, 0);
      } else if (!answer) glyph(gl, i, this.items[i].kind, x, y, z, isHover ? 1.4 : 1, lit ? col.accent : col.ai, lit ? col.accent : col.muted, col.ok, (isHover ? 1 : 0.8) * inView, time);
      else {
        hideArc(gl, i);
        hideArc(gl, QMAX + i);
      }
      // Threads: from the card's index at the window edge to its node, node → core (idle);
      // the rail spine (answering).
      if (!answer) {
        if (rail) seg(gl, i, railX + side * 30, y, 0, x, y, z, isHover ? col.accent : col.ai, (isHover ? 0.85 : 0.4) * inView, isHover ? 1.6 : 1.2, 1, 0.5);
        else hideSeg(gl, i);
        seg(gl, QMAX + i, x, y, z, coreX, vy, 0, isHover ? col.accent : col.ai, (isHover ? 0.7 : 0.26) * inView, isHover ? 1.4 : 1, 2, 0.35);
      } else {
        if (i < n - 1) {
          const y2 = rail ? Math.max(-half, Math.min(half, cyPx - this.ys[i + 1])) : (0.5 - (i + 1.5) / n) * h * 0.8;
          seg(gl, i, railX, y, 0, railX, y2, 0, col.muted, 0.35 * inView, 1, 0, 0);
        } else hideSeg(gl, i);
        hideSeg(gl, QMAX + i);
      }
      this.idxX[i] = answer ? railX + side * 14 : railX + side * 4;
      this.idxA[i] = rail ? inView * (answer ? (isSub || isHover ? 1 : 0) : 1) : 0;
    }

    // ---- the visual (after the old one has faded out)
    const ctx = this.ctx;
    ctx.gl = gl;
    ctx.data = this.data;
    ctx.col = col;
    ctx.t = time;
    ctx.R = R;
    ctx.vx = vx;
    ctx.vy = vy;
    ctx.x0 = side > 0 ? -w / 2 + (rail ? 44 : 26) : -w / 2 + 16;
    ctx.x1 = side > 0 ? w / 2 - 16 : w / 2 - (rail ? 44 : 26);
    ctx.y0 = -h / 2 + 16;
    ctx.y1 = h / 2 - 16;
    ctx.low = this.low;
    ctx.side = side;
    ctx.item = answer ? this.items[this.subject] : null;
    ctx.D = D_VIS;
    ctx.A = A_VIS;
    ctx.S = S_VIS;
    ctx.Dmax = N_DOTS - DUST;
    ctx.pre = this.pre;
    let used: Used = { d: D_VIS, a: A_VIS, s: S_VIS };
    if (!out)
      switch (this.kind) {
        case "career":
          used = career(ctx);
          break;
        case "stack":
          used = stack(ctx);
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
        case "versus":
          used = versus(ctx);
          break;
        case "verdict":
          used = verdict(ctx);
          break;
        case "list":
          used = list(ctx);
          break;
        case "path":
          used = path(ctx);
          break;
        default:
          used = field(ctx, coreX, vy, hot, n, this.hoverIdx);
      }
    hideRange(gl.dots.tgt, 8, 7, used.d, N_DOTS - DUST);
    gl.arcs.hideFrom(used.a);
    gl.segs.hideFrom(used.s);

    // ---- the beam from the active node to where the visual takes it in (two packets riding it)
    if (answer && !out) {
      const s0 = this.subject;
      const ax = railX;
      const ay = rail ? Math.max(-half, Math.min(half, cyPx - this.ys[s0])) : gl.dots.cur[s0 * 8 + 1];
      const ix = ctx.inX;
      const iy = ctx.inY;
      const c1x = ax + side * Math.min(80, Math.abs(ix - ax) * 0.5);
      const c2x = ix - side * Math.min(60, Math.abs(ix - ax) * 0.4);
      for (let k = 0; k < BEAM; k++) {
        bez(ax, ay, c1x, ay, c2x, iy, ix, iy, k / BEAM, bz0);
        bez(ax, ay, c1x, ay, c2x, iy, ix, iy, (k + 1) / BEAM, bz1);
        seg(gl, S_BEAM + k, bz0[0], bz0[1], 4, bz1[0], bz1[1], 4, col.accent, 0.85, 1.6, 0, 0);
      }
      for (let k = 0; k < 2; k++) {
        const u = (time * 0.55 + k * 0.5) % 1;
        bez(ax, ay, c1x, ay, c2x, iy, ix, iy, u, bz0);
        dot(gl, 2 * QMAX + k, bz0[0], bz0[1], 6, col.accent, 13, Math.sin(u * Math.PI));
      }
    } else {
      for (let k = 0; k < BEAM; k++) hideSeg(gl, S_BEAM + k);
      gl.dots.tgt[2 * QMAX * 8 + 7] = 0;
      gl.dots.tgt[(2 * QMAX + 1) * 8 + 7] = 0;
    }

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
      dot(gl, i, x, y, z, k % 3 ? col.muted : col.ai, 4 + 3 * hash(k + 7), answer ? 0.2 : 0.4);
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
    x0: 0,
    x1: 0,
    y0: 0,
    y1: 0,
    low: false,
    side: 1,
    item: null,
    D: 0,
    A: 0,
    S: 0,
    Dmax: 0,
    inX: 0,
    inY: 0,
    label: this.label,
    pre: null as unknown as Pre,
  };

  dispose() {
    this.gl.dispose();
    this.pre.selFor = null;
    this.items = [];
    this.section?.removeAttribute("data-faq-live");
    this.section = null;
  }
}

/** A question node's idle glyph: a small preview of its answer's picture (two arcs). */
function glyph(gl: FaqGL, i: number, kind: Kind, x: number, y: number, z: number, s: number, hc: Color, oc: Color, ok: Color, a: number, time: number) {
  const j = QMAX + i;
  const wob = time * 0.5 + i;
  const r = 13 * s;
  switch (kind) {
    case "career": // year rings
      arc(gl, i, x, y, z, -0.3, 0, 0, r, 1.6, 0.05, 0.8, hc, a, 0, 0, 0.5);
      arc(gl, j, x, y, z, -0.3, 0, 0, r * 1.5, 1.2, 0.3, 1.1, ok, a * 0.8, 0, 0, 0.4);
      break;
    case "clock": // a dial of points
      arc(gl, i, x, y, z, 0, 0, 0, r, 1.6, 0, ((time * 0.02) % 1) + 0.4, hc, a, 0, 0, 0.5);
      arc(gl, j, x, y, z, 0, 0, 0, r * 1.45, 1.4, 0, 1, oc, a * 0.75, dashes(24, 0.25), 0, 0);
      break;
    case "beacon": {
      const p = (time * 0.5 + i * 0.3) % 1;
      arc(gl, i, x, y, z, 1.2, 0, 0, r * (0.7 + 0.9 * p), 1.4, 0, 1, ok, a * (1 - p), 0, 0, 0.5);
      arc(gl, j, x, y, z, 1.2, 0, wob, r * 1.5, 1, 0, 1, ok, a * 0.7, dashes(12, 0.5), 0, 0);
      break;
    }
    case "figures": // a share lit
      arc(gl, i, x, y, z, 0, 0, 0, r, 1.6, 0, 0.55 + 0.25 * Math.sin(wob), ok, a, 0, 0, 0.5);
      arc(gl, j, x, y, z, 0, 0, 0, r * 1.45, 1, 0, 1, oc, a * 0.7, dashes(20, 0.4), 0, 0);
      break;
    case "versus": // two orbs
      arc(gl, i, x - r * 0.5, y, z, 0, 0, 0, r * 0.85, 1.4, 0, 1, hc, a, 0, 0, 0.5);
      arc(gl, j, x + r * 0.5, y, z, 0, 0, 0, r * 0.85, 1.4, 0, 1, ok, a * 0.85, 0, 0, 0.5);
      break;
    case "stack": // a tilted orbit
      arc(gl, i, x, y, z, 0, 0, 0, r, 1.6, 0, 1, hc, a, 0, 0, 0.5);
      arc(gl, j, x, y, z, 1.2, wob * 0.4, 0, r * 1.7, 1, 0, 1, oc, a * 0.75, dashes(16, 0.5), 0, 0);
      break;
    case "verdict": // a lit ring and its halo
      arc(gl, i, x, y, z, 0, 0, 0, r, 2, 0, 1, ok, a, 0, 0, 0.6);
      arc(gl, j, x, y, z, 0, 0, wob * 0.3, r * 1.5, 1, 0, 1, oc, a * 0.7, dashes(18, 0.4), 0, 0);
      break;
    case "list": // spokes
      arc(gl, i, x, y, z, 0, 0, 0, r, 1.6, 0, 1, hc, a, 0, 0, 0.5);
      arc(gl, j, x, y, z, 0, 0, wob * 0.4, r * 1.6, 2, 0, 1, oc, a * 0.75, dashes(5, 0.12), 0, 0);
      break;
    default: // path: a ring and a travelling arc
      arc(gl, i, x, y, z, 0, 0, 0, r, 1.6, 0, 1, hc, a, 0, 0, 0.5);
      arc(gl, j, x, y, z, 0, 0, 0, r * 1.55, 1.2, (time * 0.3) % 1, ((time * 0.3) % 1) + 0.3, oc, a * 0.85, 0, 0.8, 0);
  }
}

const bz0 = [0, 0];
const bz1 = [0, 0];

function hideArc(gl: FaqGL, i: number) {
  gl.arcs.tgt[i * ARC.stride + ARC.alpha] = 0;
}
function hideSeg(gl: FaqGL, i: number) {
  gl.segs.tgt[i * SEG.stride + SEG.alpha] = 0;
}
function hideRange(tgt: Float32Array, stride: number, alpha: number, from: number, to: number) {
  for (let i = from; i < to; i++) tgt[i * stride + alpha] = 0;
}
