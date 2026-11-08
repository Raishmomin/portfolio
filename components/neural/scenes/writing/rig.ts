// Writing scene rig: the latest posts as glass manuscript pages standing on a glowing
// rail in the band above the cards, one page right above its card. A build terminal at
// the rail's start keeps running; ink tokens leave it, run along the rail and climb into
// the active page, where a light-cursor types its lines. The active post (hovered or
// focused card, else the scroll position through the section) steps forward, turns
// orange and shows its real date and title as aria-hidden labels copied from its card.
// Laid out in screen space every frame from the band the director measured
// (framing.sceneFrames.writing, shrunk by clearRect so nothing sits under content) and
// lifted into the world through the live camera. No per-frame allocation or layout reads:
// card positions are cached on resize, the band comes from the director.
import { Color, Group, Matrix4, Vector3, type Camera, type PerspectiveCamera } from "three";
import { clearRect, framing, sceneFrames, type Rect } from "../../framing";
import type { ScenePalette } from "../../types";
import { Sprites, clamp01, hash01, isLightBg, setGlowBlending, smooth01 } from "../stack/gl";
import { LabelLayer } from "../stack/labels";
import { KIND, PAGE, createQuads, lineLen } from "./gl";

const MAXP = 4;
const ASPECT = 0.78; // page width / height (the active page opens up to OPEN)
const OPEN = 1;
const HEADER_PX = 64;
const LABEL_W = 150; // px, the title label's design width (scaled with the page)
const FIXED = MAXP + 6; // glow points: rail joints, the terminal's port, the cursor, 4 corners
const ROWS = Math.floor((1 - 2 * PAGE.m - PAGE.top) / PAGE.rh);

type Post = { slug: string; meta: string; title: string; card: HTMLElement; seed: number };

const v0 = new Vector3();
const v1 = new Vector3();
const ray = new Vector3();
const vx = new Vector3();
const ID = new Matrix4();
const tc = new Color();
const expo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -8 * t));

export class WritingRig {
  readonly root = new Group();
  private readonly q = createQuads(MAXP * 3 + 1 + MAXP + 1);
  private readonly sp: Sprites;
  private nTok = 60;
  private nDust = 46;
  private backs = 2;
  private posts: Post[] = [];
  private section: HTMLElement | null = null;
  private host: HTMLElement | null = null;
  private layer: LabelLayer | null = null;
  private ids: number[] = [];
  private spans: HTMLSpanElement[] = [];
  private scales: number[] = [];
  private palette: ScenePalette | null = null;
  private readonly col = { ai: new Color(), hot: new Color(), fg: new Color(), ok: new Color() };
  // Cards (cached on resize): doc y of their row, centre x per card, one row?, column width.
  private readonly dom = { top: 0, cx: new Float32Array(MAXP), row: false, colW: 0, ok: false };
  // Per page: eased active amount, lines written, layout (px) of the last frame.
  private readonly act = new Float32Array(MAXP);
  private readonly L = new Float32Array(MAXP);
  private readonly X = new Float32Array(MAXP);
  private target = 0;
  private focusId: string | null = null;
  private focusAt = -1;
  private k = 0;
  private lit = -1;
  private seenAt = -1;
  private room = 0;
  private hasLayout = false;
  private readonly lay = { bandT: 0, bandH: 0, l: 0, r: 0, rail: 0, hs: 0, tx: 0, tw: 0, th: 0 };
  private readonly px: Rect = { l: 0, t: 0, r: 0, b: 0 };
  private readonly clear: Rect = { l: 0, t: 0, r: 0, b: 0 };
  // Eased flow target (world): the active page's foot on the rail and its cursor.
  private readonly foot = new Vector3();
  private readonly cur = new Vector3();
  private readonly port = new Vector3();
  private flowInit = false;
  private readonly band = [new Vector3(), new Vector3(), new Vector3()];
  private cam: PerspectiveCamera | null = null;
  private W = 1;
  private H = 1;

  constructor() {
    this.sp = new Sprites(this.nTok + this.nDust + FIXED, { core: 0.26, halo: 0.85, renderOrder: 2 });
    this.root.add(this.q.mesh, this.sp.mesh);
    this.root.visible = false;
  }

  /** Low quality: half the tokens and dust, one sheet behind each page. */
  setQuality(quality: "high" | "low") {
    const low = quality === "low";
    this.nTok = low ? 30 : 60;
    this.nDust = low ? 20 : 46;
    this.backs = low ? 1 : 2;
  }

  setHost(host: HTMLElement | null) {
    this.host = host;
    this.labels();
  }

  setPalette(p: ScenePalette) {
    this.palette = p;
    const light = isLightBg(p.bg);
    const u = this.q.material.uniforms;
    this.col.ai.set(p.ai);
    this.col.hot.set(p.accent);
    this.col.fg.set(p.fg);
    this.col.ok.set(p.ok);
    (u.uTint.value as Color).copy(this.col.ai);
    (u.uHot.value as Color).copy(this.col.hot);
    (u.uFg.value as Color).copy(this.col.fg);
    (u.uOk.value as Color).copy(this.col.ok);
    u.uLight.value = light ? 1 : 0;
    setGlowBlending(this.q.material, light);
    setGlowBlending(this.sp.material, light);
    this.sp.material.uniforms.uLight.value = light ? 1 : 0;
    this.styleLabels();
  }

  /** The section's cards, read from the server-rendered DOM (the only data source). */
  private read(section: HTMLElement) {
    const cards = Array.from(section.querySelectorAll<HTMLElement>('[data-focus-id^="post:"]')).slice(0, MAXP);
    this.posts = cards.map((card, i) => {
      const slug = (card.dataset.focusId ?? "").slice(5);
      return {
        slug,
        meta: `${String(i + 1).padStart(2, "0")} · ${(card.querySelector("time")?.textContent ?? "").trim()}`,
        title: (card.querySelector("h3")?.textContent ?? "").trim(),
        card,
        seed: hash01(slug || String(i)),
      };
    });
    this.L.fill(0);
    this.act.fill(0);
    this.lit = -1;
    this.labels();
    this.measure();
  }

  /** Card positions (resize / layout changes only): offsets ignore the cards' transforms. */
  measure() {
    const d = this.dom;
    d.ok = false;
    const n = this.posts.length;
    if (!n) return;
    const item = (i: number) => (this.posts[i].card.closest("li") as HTMLElement | null) ?? this.posts[i].card;
    const first = item(0);
    const parent = first.offsetParent as HTMLElement | null;
    if (!parent) return;
    const pr = parent.getBoundingClientRect();
    d.top = pr.top + window.scrollY + first.offsetTop;
    d.colW = first.offsetWidth;
    let row = n > 1;
    let prev = -Infinity;
    for (let i = 0; i < n; i++) {
      const el = item(i);
      d.cx[i] = pr.left + el.offsetLeft + el.offsetWidth / 2;
      if (el.offsetTop !== first.offsetTop || d.cx[i] <= prev) row = false;
      prev = d.cx[i];
    }
    d.row = row;
    d.ok = true;
  }

  private labels() {
    this.layer?.dispose();
    this.layer = null;
    this.ids = [];
    this.spans = [];
    if (!this.host || !this.posts.length) return;
    const layer = new LabelLayer(this.host);
    // Each label's text sits in a span scaled with the page (compositor-only, no re-measure).
    const add = (text: string, css: string, cls: string) => {
      const id = layer.add("", "", "", { x: 0, y: 0 });
      const span = document.createElement("span");
      span.className = cls;
      span.textContent = text;
      span.style.cssText = `display:block;transform-origin:0 0;${css}`;
      layer.el.children[id].appendChild(span);
      this.ids.push(id);
      this.spans.push(span);
      this.scales.push(1);
    };
    for (const p of this.posts) {
      add(p.meta, "", "font-mono text-[10px] uppercase leading-none tracking-[0.14em]");
      add(
        p.title,
        `white-space:normal;width:${LABEL_W}px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;`,
        "text-[12px] font-medium leading-[15px] tracking-[-0.005em]",
      );
    }
    this.layer = layer;
    this.styleLabels();
  }

  /** Scale label j's text (quantized; written only on change). */
  private scaleLabel(j: number, s: number) {
    const v = Math.round(s * 50) / 50;
    if (v === this.scales[j]) return;
    this.scales[j] = v;
    this.spans[j].style.transform = `scale(${v})`;
  }

  private styleLabels() {
    const p = this.palette;
    const layer = this.layer;
    if (!p || !layer) return;
    const shadow = `0 0 8px ${p.bg}, 0 0 3px ${p.bg}`;
    this.spans.forEach((el, i) => Object.assign(el.style, { color: i % 2 ? p.fg : p.accent, textShadow: shadow }));
  }

  /** Light the active card in the DOM (and expose it for QA); -1 clears. */
  private mark(i: number) {
    if (i === this.lit) return;
    if (this.lit >= 0) this.posts[this.lit]?.card.removeAttribute("data-lit");
    this.lit = i;
    const p = this.posts[i];
    p?.card.setAttribute("data-lit", "");
    if (this.section) this.section.dataset.writingLit = p ? p.slug : "";
  }

  /** Screen px → world point on the plane z = depth (through the live camera). */
  private lift(x: number, y: number, depth: number, out: Vector3) {
    const cam = this.cam!;
    ray.set((x / this.W) * 2 - 1, 1 - (y / this.H) * 2, 0.5).unproject(cam).sub(cam.position);
    return out.copy(cam.position).addScaledVector(ray, (depth - cam.position.z) / (ray.z || -1e-6));
  }

  /** World units per CSS px at depth z. */
  private per(z: number) {
    const cam = this.cam!;
    return ((cam.position.z - z) * 2 * Math.tan((cam.fov * Math.PI) / 360)) / (this.H * cam.zoom);
  }

  private hide() {
    if (this.root.visible) this.layer?.hideAll();
    this.root.visible = false;
    this.mark(-1);
  }

  frame(camera: Camera, size: { width: number; height: number }, dt: number, time: number, weight: number, focus: string | null, pointer: { x: number; y: number }) {
    const sf = sceneFrames.writing;
    if (weight <= 0.001 || !sf.el) {
      this.hide();
      this.seenAt = -1;
      return;
    }
    if (sf.el !== this.section) {
      this.section = sf.el;
      this.read(sf.el);
    }
    const n = this.posts.length;
    if (!n) return this.hide();
    const d = Math.min(dt, 0.1);
    this.cam = camera as PerspectiveCamera;
    this.W = size.width;
    this.H = size.height;
    const { W, H } = this;
    const phone = framing.phone;
    camera.updateMatrixWorld();

    // The band (desktop) / the section opening (phones), minus anything content covers.
    const px = this.px;
    px.l = sf.rect.l * W;
    px.r = sf.rect.r * W;
    px.t = Math.max(sf.rect.t * H, phone ? 56 : HEADER_PX + 6);
    px.b = Math.min(sf.rect.b * H, H);
    const ok = clearRect(px, phone ? 110 : 120, this.clear);
    this.room += ((ok ? 1 : 0) - this.room) * (1 - Math.exp(-d * 7));
    if (!ok && (this.room < 0.01 || !this.hasLayout)) return this.hide();
    this.root.visible = true;
    const lay = this.lay;
    const dom = this.dom;
    const row = !phone && dom.ok && dom.row;
    if (ok) {
      const c = this.clear;
      const bandH = c.b - c.t;
      lay.bandT = c.t;
      lay.bandH = bandH;
      lay.l = c.l;
      lay.r = c.r;
      lay.rail = c.b - bandH * 0.07;
      let hs = bandH * 0.62;
      if (row) {
        hs = Math.min(hs, (dom.colW * 0.52) / ASPECT);
        for (let i = 0; i < n; i++) this.X[i] = dom.cx[i];
      } else {
        // Even slots after the terminal; on narrow screens neighbouring pages may overlap.
        const w = c.r - c.l;
        const left = c.l + Math.min(w * 0.24, hs * 0.95);
        const slot = (c.r - w * 0.02 - left) / n;
        hs = Math.min(hs, (slot * (phone ? 1.3 : 0.8)) / ASPECT);
        for (let i = 0; i < n; i++) this.X[i] = left + slot * (i + 0.5);
      }
      lay.hs = hs;
      // The build terminal: left of the first page, standing on the rail.
      const room = this.X[0] - (hs * ASPECT) / 2 - c.l;
      lay.th = hs * 0.62;
      lay.tw = Math.min(lay.th * 1.45, room * (phone ? 0.86 : 0.74));
      lay.th = Math.min(lay.th, lay.tw / 1.1);
      lay.tx = c.l + room * (phone ? 0.46 : 0.5);
      this.hasLayout = true;
    }

    // Which post: the hovered / focused card, else the scroll position (cards entering → in view).
    if (focus !== this.focusId) {
      this.focusId = focus;
      this.focusAt = -1;
      for (let i = 0; i < n; i++) if (focus === `post:${this.posts[i].slug}`) this.focusAt = i;
    }
    let t = this.focusAt;
    if (t < 0 && dom.ok) {
      const top = dom.top - window.scrollY;
      const s = clamp01((H * (phone ? 1.3 : 1.2) - top) / (H * (phone ? 0.75 : 0.8)));
      t = Math.min(n - 1, Math.floor(s * n));
    }
    if (t >= 0) this.target = t;
    const A = this.target;
    this.mark(weight >= 0.5 ? A : -1);

    if (this.seenAt < 0) this.seenAt = time;
    const since = time - this.seenAt;
    const vis = smooth01(weight) * smooth01(this.room);
    const ka = 1 - Math.exp(-d * 7);
    const per0 = this.per(0);
    const q = this.q;
    const a = q.a;
    this.k = 0;
    const put = this.put;
    // Rail: port → each page's foot → the far end (fading out). Lit up to the active page.
    const rail = lay.rail;
    const portX = lay.tw > 40 ? lay.tx + lay.tw / 2 : lay.l + 8;
    const endX = lay.r - 12;
    let from = portX;
    let dist = 0;
    for (let i = 0; i <= n; i++) {
      const to = i < n ? this.X[i] : endX;
      const len = Math.max(1, to - from);
      put((from + to) / 2, rail, 0, len, 18, 0, 0, i <= A ? KIND.lit : KIND.dim, (dist / 64) % 1, i / (A + 1), 0, vis * expo(since * 1.4), 0, i === n ? 1 : 0);
      dist += len;
      from = to;
    }

    // Pages, back to front: the sheets behind them, the terminal, then the pages (active last).
    const hs = lay.hs;
    const grow = Math.min(1.26, (lay.bandH * 0.84) / Math.max(1, hs));
    for (let i = 0; i < n; i++) {
      const on = i === A ? 1 : 0;
      this.act[i] += (on - this.act[i]) * ka;
      // Typing: the active page writes on; on arrival every page drafts in to its start.
      const p = this.posts[i];
      const start = 4 + ((i * 1.7) % 3);
      if (this.L[i] < start) this.L[i] = Math.min(start, this.L[i] + d * 9 * clamp01(since * 2 - i * 0.2));
      else if (on) {
        const len = lineLen(Math.floor(this.L[i]), p.seed);
        this.L[i] += d * (len < 0.01 ? 5 : 0.9 / Math.max(0.3, len));
      }
    }
    this.grow = grow;
    this.since = since;
    this.time = time;
    this.ptr = pointer;
    const pageOf = this.pageOf;
    const P = this.pg;
    for (let i = 0; i < n; i++) {
      pageOf(i, P);
      for (let j = this.backs; j >= 1; j--)
        put(P[0] + 5 * j, P[1] - 5 * j, P[2] - 0.16 * j, P[3], P[4], P[5], P[6], KIND.back, 0, 0, this.act[i], vis * P[7] * (j === 1 ? 0.6 : 0.32), 0, 0);
    }
    if (lay.tw > 40) {
      const e = expo(clamp01(since / 0.9));
      put(lay.tx, rail - (lay.th * (0.4 + 0.6 * e)) / 2, -0.1, lay.tw, lay.th * (0.4 + 0.6 * e), pointer.x * 0.1 + 0.18, -0.06, KIND.term, 0, 0, 0, vis * e, 0, 0);
    }
    // Inactive pages first, the active one last (in front on paper).
    const layer = this.layer;
    const labels = !!layer && layer.begin(weight) && !phone;
    for (let pass = 0; pass < 2; pass++)
      for (let i = 0; i < n; i++) {
        if ((i === A) !== (pass === 1)) continue;
        pageOf(i, P);
        const ac = this.act[i];
        // The title label needs a page tall enough to hold it; else its bars stand in.
        // The title label scales with the page; too small to read → its bars stand in.
        const ls = Math.min(1.15, (P[4] * (OPEN - 2 * PAGE.m)) / LABEL_W);
        const lab = labels ? clamp01((ls - 0.8) / 0.08) * ac * ac : 0;
        put(P[0], P[1], P[2], P[3], P[4], P[5], P[6], KIND.page, this.posts[i].seed, this.L[i], ac, vis * P[7] * (0.8 + 0.2 * ac), lab, 0);
        if (layer && labels) {
          // Labels ride the page's content corner (local sheet coords → world).
          const hx = P[3] / P[4] / 2;
          const o = lab * vis;
          this.corner(P, -hx + PAGE.m, 0.5 - PAGE.m);
          this.scaleLabel(i * 2, ls);
          this.scaleLabel(i * 2 + 1, ls);
          layer.place(this.ids[i * 2], v0.x, v0.y, v0.z, ID, camera, W, H, o);
          this.corner(P, -hx + PAGE.m, 0.5 - PAGE.m - 0.055);
          layer.place(this.ids[i * 2 + 1], v0.x, v0.y, v0.z, ID, camera, W, H, o);
        }
      }
    if (!labels) layer?.hideAll();
    q.mesh.geometry.instanceCount = this.k;
    a.C.needsUpdate = a.X.needsUpdate = a.Y.needsUpdate = a.K.needsUpdate = a.M.needsUpdate = true;
    const u = q.material.uniforms;
    u.uTime.value = time;
    u.uPer.value = per0;
    u.uOpacity.value = 1;

    // Glow points: ink tokens on their way to the active page's cursor, rail joints, the
    // cursor's light, the active page's corners and slow dust in the band.
    pageOf(A, P);
    const asp = P[3] / P[4];
    const l0 = Math.floor(this.L[A]);
    const w0 = this.L[A] - l0;
    const scroll = Math.max(0, l0 - ROWS + smooth01(w0 / 0.12));
    this.corner(P, -asp / 2 + PAGE.m + lineLen(l0, this.posts[A].seed) * (asp - 2 * PAGE.m) * w0 + 0.01, 0.5 - PAGE.m - PAGE.top - (l0 + 0.5 - scroll) * PAGE.rh);
    const kf = this.flowInit ? 1 - Math.exp(-d * 6) : 1;
    this.cur.lerp(v0, kf);
    this.lift(this.X[A], rail, 0, v1);
    this.foot.lerp(v1, kf);
    this.lift(portX, rail, 0, this.port);
    this.flowInit = true;
    const sp = this.sp;
    const { ai, hot, fg, ok: green } = this.col;
    const flow = vis * smooth01((since - 0.9) / 0.8);
    const l1 = this.port.distanceTo(this.foot);
    const l2 = this.foot.distanceTo(this.cur) * 1.15;
    const total = Math.max(1e-3, l1 + l2);
    const speed = (150 * per0) / total;
    let s = 0;
    for (let j = 0; j < this.nTok; j++, s++) {
      const seed = (j * 0.618034) % 1;
      const ph = (seed + time * speed) % 1;
      const at = ph * total;
      let fade = 1;
      if (at < l1) {
        v0.lerpVectors(this.port, this.foot, at / l1);
        v0.y += Math.sin(time * 3 + j * 2.1) * 2 * per0;
      } else {
        const b = (at - l1) / l2;
        // Quadratic climb: up from the foot, curving onto the cursor.
        vx.set(this.foot.x, this.foot.y + (this.cur.y - this.foot.y) * 0.7, this.cur.z);
        v0.copy(this.foot).multiplyScalar((1 - b) * (1 - b)).addScaledVector(vx, 2 * b * (1 - b)).addScaledVector(this.cur, b * b);
        fade = 1 - smooth01((b - 0.75) / 0.25);
      }
      sp.set(s, v0.x, v0.y, v0.z);
      sp.setColor(s, tc.copy(ai).lerp(hot, smooth01((ph - 0.45) / 0.5)));
      sp.size[s] = (4 + 3 * ((j * 0.377) % 1)) * per0;
      sp.alpha[s] = flow * fade * (0.55 + 0.45 * ((j * 0.731) % 1)) * smooth01(ph / 0.04);
    }
    // Dust: drifting motes across the band (corners lifted once per frame).
    this.lift(lay.l, lay.bandT, 0, this.band[0]);
    this.lift(lay.r, lay.bandT, 0, this.band[1]);
    this.lift(lay.l, lay.bandT + lay.bandH * 0.9, 0, this.band[2]);
    const [b0, b1, b2] = this.band;
    for (let j = 0; j < this.nDust; j++, s++) {
      const hx = (j * 0.754877 + 0.1) % 1;
      const hy = (j * 0.569840 + 0.3) % 1;
      const dz = ((j * 0.31) % 1) * 2.4 - 1.6;
      const fx = (hx + time * 0.006 * (1 + hy)) % 1;
      const fy = (hy + Math.sin(time * 0.3 + j) * 0.03 + 1) % 1;
      sp.set(s, b0.x + (b1.x - b0.x) * fx, b0.y + (b2.y - b0.y) * fy, dz);
      sp.setColor(s, j % 3 ? ai : fg, 0.8);
      sp.size[s] = (2 + 2.5 * hy) * per0;
      sp.alpha[s] = vis * (0.18 + 0.3 * ((j * 0.43) % 1)) * (0.6 + 0.4 * Math.sin(time * 1.3 + j * 3.1));
    }
    // Rail joints under each page and the terminal's port.
    for (let i = 0; i < MAXP; i++, s++) {
      const on = i < n;
      if (on) this.lift(this.X[i], rail, 0, v0);
      sp.set(s, v0.x, v0.y, v0.z);
      sp.setColor(s, tc.copy(ai).lerp(hot, on ? this.act[i] : 0));
      sp.size[s] = (12 + 8 * (on ? this.act[i] : 0)) * per0;
      sp.alpha[s] = on ? vis * expo(since * 1.4) : 0;
    }
    sp.set(s, this.port.x, this.port.y, this.port.z);
    sp.setColor(s, green);
    sp.size[s] = 12 * per0;
    sp.alpha[s++] = lay.tw > 40 ? vis * expo(since) : 0;
    // The light-cursor and the active page's corners.
    sp.set(s, this.cur.x, this.cur.y, this.cur.z);
    sp.setColor(s, hot, 1.2);
    sp.size[s] = (20 + 4 * Math.sin(time * 6)) * per0;
    sp.alpha[s++] = flow * this.act[A];
    pageOf(A, P);
    for (let c = 0; c < 4; c++, s++) {
      // Bottom corners, top-left and the fold of the dog-ear.
      this.corner(P, (c & 1 ? 0.5 : -0.5) * (P[3] / P[4]) - (c === 3 ? 0.1 : 0), c & 2 ? 0.5 : -0.5);
      sp.set(s, v0.x, v0.y, v0.z);
      sp.setColor(s, hot);
      sp.size[s] = 7 * per0;
      sp.alpha[s] = vis * this.act[A] * P[7] * 0.9;
    }
    sp.geometry.instanceCount = s;
    sp.material.uniforms.uOpacity.value = 1;
    sp.flush();
  }

  private readonly pg = new Float32Array(8);
  private grow = 1;
  private since = 0;
  private time = 0;
  private ptr = { x: 0, y: 0 };

  /** Page i's frame this frame → out: x, y (px), z, width, height (px), yaw, pitch, intro. */
  private readonly pageOf = (i: number, out: Float32Array) => {
    const ac = this.act[i];
    const lay = this.lay;
    const e = expo(clamp01((this.since - 0.12 * i) / 1.1));
    const h = lay.hs * (1 + (this.grow - 1) * ac) * (0.35 + 0.65 * e);
    const u = Math.max(-1, Math.min(1, (this.X[i] - this.W / 2) / (this.W / 2)));
    out[0] = this.X[i];
    out[1] = lay.rail - lay.bandH * 0.035 * ac - h / 2 + Math.sin(this.time * 0.8 + i * 1.9) * 2.5 * (1 - ac);
    out[2] = 0.6 * ac - 0.3 * (1 - ac);
    out[3] = h * (ASPECT + (OPEN - ASPECT) * ac);
    out[4] = h;
    out[5] = -0.42 * u * (1 - ac) + this.ptr.x * 0.12;
    out[6] = -0.06 + this.ptr.y * 0.06;
    out[7] = e;
  };

  /** Append one quad instance (px frame lifted into the world). */
  private readonly put = (cx: number, cy: number, z: number, wpx: number, hpx: number, yaw: number, pitch: number, kind: number, seed: number, l: number, act: number, alpha: number, label: number, fade: number) => {
    const a = this.q.a;
    const k = this.k++;
    this.lift(cx, cy, z, v0);
    const pz = this.per(z);
    const sy = Math.sin(yaw);
    const cy2 = Math.cos(yaw);
    const sp = Math.sin(pitch);
    a.C.setXYZ(k, v0.x, v0.y, v0.z);
    a.X.setXYZ(k, cy2 * wpx * pz, 0, -sy * wpx * pz);
    a.Y.setXYZ(k, sy * sp * hpx * pz, Math.cos(pitch) * hpx * pz, cy2 * sp * hpx * pz);
    a.K.setXYZW(k, kind, seed, l, act);
    a.M.setXYZW(k, alpha, label, fade, 0);
  };

  /** Point (qx, qy) on a page frame (sheet-height units from its centre) → v0 (world). */
  private corner(P: Float32Array, qx: number, qy: number) {
    const h = P[4];
    const pz = this.per(P[2]);
    const sy = Math.sin(P[5]);
    const cy = Math.cos(P[5]);
    const sp = Math.sin(P[6]);
    this.lift(P[0], P[1], P[2], v0);
    const x = qx * h * pz;
    const y = qy * h * pz;
    v0.x += cy * x + sy * sp * y;
    v0.y += Math.cos(P[6]) * y;
    v0.z += -sy * x + cy * sp * y;
    return v0;
  }

  dispose() {
    this.mark(-1);
    this.layer?.dispose();
    this.layer = null;
    this.q.dispose();
    this.sp.dispose();
  }
}
