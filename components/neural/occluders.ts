// Label occlusion (lazy 3D chunk): the boxes of content near the viewport that a 3D
// label must never show over: panels, cards, [data-occlude] blocks and text. Rects are
// read in one batch (at most every REFRESH_MS while labels are in use) and shifted by
// the scroll delta in between, so per-frame tests cost no layout reads.
const BLOCK = ".panel, [data-card], [data-occlude]";
const TEXT = "main :is(h1, h2, h3, h4, p, li, dt, dd, a, button, blockquote, figcaption, label, form, table, pre)";
const REFRESH_MS = 120;
const RESCAN_MS = 1000;
const PAD = 6; // px of clearance around content

/**
 * The page scroll, snapshotted once per frame by the director before any scene runs
 * (perf P5). Scenes read it in place of window.scrollX/Y: in Chromium every scrollY read
 * after a DOM write forces a style and layout pass, and the label and clearRect scenes
 * write DOM every frame. `live` while a stage keeps it current.
 */
export const scroll = { x: 0, y: 0, live: false };

class Occluders {
  private els = new Set<Element>();
  private near = new Set<Element>();
  private io: IntersectionObserver | null = null;
  private mo: MutationObserver | null = null;
  private users = 0;
  private dirty = true;
  private scanned = 0;
  private read = -1e9;
  private readY = 0;
  private readX = 0;
  /** Cached rects (viewport coords at read time): left, top, right, bottom. */
  private rects = new Float32Array(0);
  private count = 0;
  private shiftY = 0;
  private shiftX = 0;

  retain() {
    if (this.users++ > 0) return;
    this.io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) this.near.add(e.target);
          else this.near.delete(e.target);
        }
        this.read = -1e9;
      },
      { rootMargin: "50% 0px 50% 0px" },
    );
    this.mo = new MutationObserver(() => {
      this.dirty = true;
    });
    this.mo.observe(document.body, { childList: true, subtree: true });
    this.dirty = true;
  }

  release() {
    if (--this.users > 0) return;
    this.io?.disconnect();
    this.mo?.disconnect();
    this.io = this.mo = null;
    this.els.clear();
    this.near.clear();
    this.count = 0;
  }

  private rescan(now: number) {
    if (!this.io || !this.dirty || now - this.scanned < RESCAN_MS) return;
    this.dirty = false;
    this.scanned = now;
    const next = new Set<Element>();
    document.querySelectorAll(BLOCK).forEach((el) => {
      if (!el.closest("[data-neural-stage]")) next.add(el);
    });
    // Text inside a block is covered by the block itself.
    document.querySelectorAll(TEXT).forEach((el) => {
      if (!el.closest(BLOCK) && !el.closest("[data-neural-stage]")) next.add(el);
    });
    for (const el of this.els) if (!next.has(el)) {
      this.io.unobserve(el);
      this.near.delete(el);
    }
    for (const el of next) if (!this.els.has(el)) this.io.observe(el);
    this.els = next;
    this.read = -1e9;
  }

  /**
   * Bring the cached rects up to date (cheap when called every frame). `x`/`y` is the
   * frame's scroll; omitted, the snapshot while a stage keeps it current, else the window's.
   */
  sync(x = scroll.live ? scroll.x : window.scrollX, y = scroll.live ? scroll.y : window.scrollY) {
    const now = performance.now();
    this.rescan(now);
    if (now - this.read >= REFRESH_MS && (y !== this.readY || x !== this.readX || now - this.read >= RESCAN_MS)) {
      this.read = now;
      this.readY = y;
      this.readX = x;
      if (this.rects.length < this.near.size * 4) this.rects = new Float32Array(this.near.size * 8);
      let n = 0;
      for (const el of this.near) {
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) continue;
        this.rects[n * 4] = r.left - PAD;
        this.rects[n * 4 + 1] = r.top - PAD;
        this.rects[n * 4 + 2] = r.right + PAD;
        this.rects[n * 4 + 3] = r.bottom + PAD;
        n++;
      }
      this.count = n;
    }
    this.shiftY = this.readY - y;
    this.shiftX = this.readX - x;
  }

  /** Does the viewport box overlap any content? */
  hits(l: number, t: number, r: number, b: number): boolean {
    const R = this.rects;
    const sx = this.shiftX;
    const sy = this.shiftY;
    for (let i = 0; i < this.count; i++) {
      const o = i * 4;
      if (r > R[o] + sx && l < R[o + 2] + sx && b > R[o + 1] + sy && t < R[o + 3] + sy) return true;
    }
    return false;
  }
}

export const occluders = new Occluders();
