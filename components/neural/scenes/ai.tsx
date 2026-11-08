"use client";
// AI scene: the active AI project drawn as a working AI system, built from its real data
// (NeuralData.ai[i].stages, and the models / vector store / agent framework in its stack).
// Each stage is its own object: a chat window (or code, or a voice waveform) where the
// prompt is typed, a vector store whose nearest matches light for the query, an agent
// calling its tools in turn, a dense neural core (one orbit ring per model provider) that
// streams the answer token by token, and an answer card whose lines assemble. One request
// runs through the system on a clock; the stage chips of the project's DOM card light in
// sync (data-ai-lit / data-ai-done, and a bubbling "cp:ai-stage" event), and the shown
// card is marked (data-ai-shown); hovering a stage chip (with a mouse) holds the request in
// that stage. The project comes from a hovered or focused card, else the top card of the AI
// deck ("cp:deck"), else the card nearest the viewport's centre (phones: the first card
// while the section's opening is in view); switching projects rebuilds the system (shared
// stages glide, others grow or dissolve). The system is fitted at full size into its free
// area (phones: the section's opening above the heading) and is attached to its section
// like content: it scrolls in and away with the section and fades as it leaves the
// viewport, so it never shrinks into a corner or draws over the neighbouring content.
// Names are aria-hidden labels in the shared layer that duplicate the DOM cards (phones,
// where the layer shows none: the section's aria-hidden caption under the opening).
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Vector3, type Camera } from "three";
import { fitFree, framing, sceneFrames } from "../framing";
import type { SceneProps } from "../types";
import { buildModel } from "./ai/layout";
import { AiRig, type AiRegistry } from "./ai/rig";
import { smooth } from "./ai/shared";
import { LabelLayer, type Align } from "./stack/labels";

/** A section that shows this scene (home: data-section="ai"; subpages: data-scene="ai"). */
const AI_SECTION = '[data-section="ai"], [data-scene="ai"]';
/** Largest world units per layout unit, and the smallest frame (px) worth fitting into. */
const CAP = 1.25;
const MIN_RECT = 140;
/** Phones: the smallest opening (px) a reduced system still draws into (short screens). */
const PHONE_MIN = 64;
/** How far the nearest parts come toward the camera (layout units), for the perspective fit. */
const NEAR_Z = 1.3;
/** Clearance (px) kept between the system and its section's top / bottom edge. */
const EDGE = 28;
/** Leaving at the top, the system fades as its foot rises from FADE[1] to FADE[0] px (under
 *  the header); entering, as its top rises FADE[2] px into the viewport. */
const FADE = [80, 300, 160] as const;
const BELOW: Align = { x: -0.5, y: 0 };
const ABOVE: Align = { x: -0.5, y: -1 };

const v0 = new Vector3();
const v1 = new Vector3();
/** World point on the z = 0 plane under a canvas pixel (out = [x, y]). */
function toWorld(camera: Camera, px: number, py: number, w: number, h: number, out: number[]) {
  v0.set((px / w) * 2 - 1, 1 - (py / h) * 2, 0.5).unproject(camera);
  v1.copy(camera.position);
  v0.sub(v1);
  const t = Math.abs(v0.z) > 1e-6 ? -v1.z / v0.z : 0;
  out[0] = v1.x + v0.x * t;
  out[1] = v1.y + v0.y * t;
}

type Labels = { layer: LabelLayer; name: number[]; chip: HTMLElement[]; tech: HTMLElement[]; title: number[]; plan: number; lit: number };
type Chips = { project: number; lit: number; els: HTMLElement[]; sections: HTMLElement[] };
/** The driving section's edges and the foot of its phone opening (canvas px: above the
 *  caption, else the heading), its first card's project and the card nearest the centre's. */
type Sec = { el: HTMLElement | null; ok: boolean; top: number; bottom: number; open: number; first: number; near: number };

export default function AiScene({ data, progress, weight, pointer, focus, palette, quality }: SceneProps) {
  const model = useMemo(() => buildModel(data.ai ?? [], data.work ?? []), [data.ai, data.work]);
  const rig = useMemo(() => new AiRig(model), [model]);
  useEffect(() => () => rig.dispose(), [rig]);
  useEffect(() => rig.setPalette(palette), [rig, palette]);
  useEffect(() => rig.setQuality(quality), [rig, quality]);
  const active = weight > 0;
  const reg = useRef<AiRegistry>({ root: null, inner: null });

  // The card on top of the AI deck (desktop [data-deck] emits "cp:deck"); read per frame
  // only while its deck is live (it reverts on phones). Only the AI section's deck counts.
  const deck = useRef<{ el: Element; id: string | null } | null>(null);
  useEffect(() => {
    const onDeck = (e: Event) => {
      const id = (e as CustomEvent<{ id?: string }>).detail?.id ?? null;
      if (e.target instanceof Element && e.target.closest(AI_SECTION) && id && model.index.has(id)) deck.current = { el: e.target, id };
    };
    document.addEventListener("cp:deck", onDeck);
    const live = document.querySelector<HTMLElement>(`:is(${AI_SECTION}) [data-deck-live][data-deck-index]`);
    const top = live?.querySelector<HTMLElement>("[data-deck-top]");
    const id = top?.dataset.focusId ?? top?.querySelector<HTMLElement>("[data-focus-id]")?.dataset.focusId;
    if (live && id && model.index.has(id)) deck.current = { el: live, id };
    return () => document.removeEventListener("cp:deck", onDeck);
  }, [model]);

  // The section in view: flagged by scroll / resize (they fire before the frame) and read
  // at most once per frame, at its start, so the fit follows the page without a frame of
  // lag; only while this scene shows. The card at the viewport's centre line comes from an
  // IntersectionObserver (no per-card rects).
  const gl = useThree((s) => s.gl);
  const sec = useRef<Sec>({ el: null, ok: false, top: 0, bottom: 0, open: 0, first: -1, near: -1 });
  const dirty = useRef(true);
  const measure = useMemo(
    () => () => {
      const st = sec.current;
      const own = sceneFrames.ai.el;
      const el = own?.isConnected ? own : document.querySelector<HTMLElement>(AI_SECTION);
      st.el = el;
      if (!el) {
        st.ok = false;
        st.near = st.first = -1;
        return;
      }
      const c = gl.domElement.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      st.ok = r.height > 0;
      st.top = r.top - c.top;
      st.bottom = r.bottom - c.top;
      st.first = model.index.get(el.querySelector<HTMLElement>("[data-focus-id]")?.dataset.focusId ?? "") ?? -1;
      if (st.near < 0) st.near = st.first;
      const cap = el.querySelector<HTMLElement>("[data-ai-caption]")?.getBoundingClientRect();
      const head = el.querySelector<HTMLElement>("h2")?.getBoundingClientRect();
      st.open = (cap && cap.height > 0 ? cap.top - 6 : head ? head.top - 28 : r.bottom) - c.top;
    },
    [gl, model],
  );
  useEffect(() => {
    const flag = () => {
      dirty.current = true;
    };
    const ro = new ResizeObserver(flag);
    ro.observe(document.body);
    window.addEventListener("scroll", flag, { passive: true });
    window.addEventListener("resize", flag, { passive: true });
    // The card crossing the viewport's centre line (kept while the line is between cards).
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const j = model.index.get((e.target as HTMLElement).dataset.focusId ?? "");
          if (e.isIntersecting && j !== undefined) sec.current.near = j;
        }
      },
      { rootMargin: "-50% 0px -50% 0px" },
    );
    document.querySelectorAll<HTMLElement>(`:is(${AI_SECTION}) [data-focus-id]`).forEach((card) => io.observe(card));
    return () => {
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("scroll", flag);
      window.removeEventListener("resize", flag);
    };
  }, [model]);

  // A stage chip (data-ai-stage inside a project's card) under the pointer holds the request
  // there. Chips are not focusable (no nested interactives in the /projects card links); a
  // focused card still picks its project through the stage's focus delegation.
  const hold = useRef<{ slug: string; stage: string } | null>(null);
  useEffect(() => {
    const chipOf = (t: EventTarget | null) => (t instanceof Element ? t.closest<HTMLElement>("[data-ai-stage]") : null);
    const enter = (e: Event) => {
      const chip = chipOf(e.target);
      if (!chip || !chip.closest(AI_SECTION)) return;
      const slug = chip.closest<HTMLElement>("[data-focus-id]")?.dataset.focusId;
      const stage = chip.dataset.aiStage;
      if (slug && stage && model.index.has(slug)) hold.current = { slug, stage };
    };
    const leave = (e: Event) => {
      const from = chipOf(e.target);
      if (from && from !== chipOf((e as PointerEvent).relatedTarget) && hold.current?.stage === from.dataset.aiStage) hold.current = null;
    };
    document.addEventListener("pointerover", enter, { passive: true });
    document.addEventListener("pointerout", leave, { passive: true });
    return () => {
      document.removeEventListener("pointerover", enter);
      document.removeEventListener("pointerout", leave);
    };
  }, [model]);

  // The DOM side of the clock: the shown project's card (data-ai-shown) and its stage chips
  // (data-ai-stage="<name>"), in its card and in the phone caption (data-ai-caption="<slug>").
  const chips = useRef<Chips>({ project: -1, lit: -1, els: [], sections: [] });
  const syncChips = useMemo(
    () => (project: number, lit: number) => {
      const st = chips.current;
      if (project === st.project && lit === st.lit) return;
      st.project = project;
      st.lit = lit;
      const plan = project >= 0 && !model.generic ? model.plans[project] : undefined;
      for (const el of st.els) {
        el.removeAttribute("data-ai-lit");
        el.removeAttribute("data-ai-done");
        el.removeAttribute("data-ai-shown");
      }
      st.els.length = 0;
      if (!plan) {
        for (const s of st.sections) s.removeAttribute("data-ai-sync");
        st.sections.length = 0;
        return;
      }
      const slug = CSS.escape(plan.slug);
      document.querySelectorAll<HTMLElement>(AI_SECTION).forEach((sec) => {
        if (!sec.hasAttribute("data-ai-sync")) {
          sec.setAttribute("data-ai-sync", "");
          st.sections.push(sec);
        }
        const card = sec.querySelector<HTMLElement>(`[data-focus-id="${slug}"]`);
        if (card) {
          card.setAttribute("data-ai-shown", "");
          st.els.push(card);
        }
        sec.querySelectorAll<HTMLElement>(`[data-focus-id="${slug}"], [data-ai-caption="${slug}"]`).forEach((scope) =>
          plan.stages.forEach((name, j) => {
            if (j > lit) return;
            const chip = scope.querySelector<HTMLElement>(`[data-ai-stage="${CSS.escape(name)}"]`);
            if (!chip) return;
            chip.setAttribute(j === lit ? "data-ai-lit" : "data-ai-done", "");
            st.els.push(chip);
          }),
        );
        if (card && lit >= 0) card.dispatchEvent(new CustomEvent("cp:ai-stage", { bubbles: true, detail: { slug: plan.slug, stage: plan.stages[lit], index: lit } }));
      });
    },
    [model],
  );
  useEffect(() => () => syncChips(-1, -1), [syncChips]);

  // Labels: each stage's name with its technology line, and each project's title, in the
  // shared screen-space layer (active scene only, hidden over content, clamped).
  const host = useThree((s) => s.gl.domElement.parentElement);
  const labels = useRef<Labels | null>(null);
  useEffect(() => {
    if (!host || model.generic) return;
    const layer = new LabelLayer(host);
    const chip: HTMLElement[] = [];
    const tech: HTMLElement[] = [];
    const name = model.slots.map((s) => {
      const id = layer.add("", "", "flex flex-col items-center gap-1", BELOW);
      const el = layer.el.children[id] as HTMLElement;
      const c = document.createElement("span");
      c.className = "rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase leading-none tracking-[0.14em]";
      c.textContent = s.name;
      const t = document.createElement("span");
      t.className = "font-mono text-[10.5px] leading-none tracking-[0.02em]";
      Object.assign(t.style, { color: palette.muted, textShadow: `0 0 8px ${palette.bg}, 0 0 3px ${palette.bg}` });
      el.append(c, t);
      chip.push(c);
      tech.push(t);
      layer.style(id, {});
      return id;
    });
    const title = model.plans.map((p) => {
      const id = layer.add(`● ${p.title}`, "", "font-mono text-xs uppercase tracking-[0.16em]", { x: 0, y: 0 });
      layer.style(id, { color: palette.fg, textShadow: `0 0 10px ${palette.bg}, 0 0 4px ${palette.bg}` });
      return id;
    });
    labels.current = { layer, name, chip, tech, title, plan: -1, lit: -2 };
    return () => {
      labels.current = null;
      layer.dispose();
    };
  }, [host, model, palette]);

  const titleO = useRef<Float32Array>(new Float32Array(0));
  const pt = useMemo(() => [0, 0], []);
  const at = useMemo(() => new Float32Array(3), []);
  const live = useRef({ project: 0 });
  const lastFit = useRef({ x: 0, y: 0, scale: 0 });

  // Whether the system is drawn at all (data-ai-drawn on the AI sections; change-gated, with
  // hysteresis): the phone caption names the system only while it is there.
  const drawn = useRef(false);
  const setDrawn = useMemo(
    () => (on: boolean) => {
      if (on === drawn.current) return;
      drawn.current = on;
      document.querySelectorAll<HTMLElement>(AI_SECTION).forEach((s) => s.toggleAttribute("data-ai-drawn", on));
    },
    [],
  );
  useEffect(() => () => setDrawn(false), [setDrawn]);

  useFrame((state, delta) => {
    const ids = labels.current;
    if (!active) {
      ids?.layer.hideAll();
      syncChips(-1, -1);
      setDrawn(false);
      return;
    }
    // A paused and resumed frameloop may hand over an odd delta: never step backwards.
    const dt = Math.min(Math.max(delta, 0), 0.1);
    const { camera, size } = state;
    const n = model.plans.length;
    if (dirty.current || !sec.current.el?.isConnected) {
      dirty.current = false;
      measure();
    }
    // Which project: hover/focus wins, then the live deck's top card, then (phones) the
    // first card while its opening is on screen (the caption names it), then the card
    // nearest the viewport's centre, else equal scroll slices.
    const d = deck.current;
    const deckId = d && d.el.hasAttribute("data-deck-live") ? d.id : null;
    const st = sec.current;
    const sf = sceneFrames.ai;
    const H = size.height;
    const opening = framing.phone && st.ok && st.open > 0 && st.top < H && st.first >= 0;
    const picked = (focus ? model.index.get(focus) : undefined) ?? (deckId ? model.index.get(deckId) : undefined) ?? (opening ? st.first : st.near >= 0 ? st.near : undefined);
    live.current.project = picked ?? Math.min(n - 1, Math.floor(Math.max(0, Math.min(1, progress)) * n));

    // Where: the scene's own free rect (unblended, from the director; phones: the section's
    // whole opening, where it is on the page), fitted at full size. The system is attached
    // to its section like content: when a section edge reaches it, it scrolls away (or in)
    // with the page instead of shrinking, and fades as it leaves the viewport.
    const box = rig.box[2] > 0 ? rig.box : model.plans[live.current.project].box;
    const hw = box[2];
    const hh = box[3];
    const rl = sf.rect.l * size.width;
    const rw = (sf.rect.r - sf.rect.l) * size.width;
    let rt = sf.rect.t * H;
    let rb = sf.rect.b * H;
    if (framing.phone && st.ok) {
      rt = st.top + 8;
      rb = st.open;
    }
    const rh = rb - rt;
    const fit = lastFit.current;
    let room = framing.phone && !st.ok ? 0 : 1;
    let clip = framing.phone;
    // A free area taller than the system's shape spreads its stages vertically (up to 1.45×).
    const own = model.plans[live.current.project].box;
    const stretch = rw > 0 && rh > 0 ? Math.max(1, Math.min(1.45, own[2] / own[3] / (rw / rh))) : 1;
    // Phones fit any opening of PHONE_MIN px or more (a short screen draws a smaller system).
    if (sf.el && rw >= MIN_RECT && rh >= (framing.phone ? PHONE_MIN : MIN_RECT)) {
      camera.updateMatrixWorld();
      let cy = rt + rh / 2;
      toWorld(camera, rl + rw / 2, cy, size.width, size.height, pt);
      const x = pt[0];
      const y = pt[1];
      toWorld(camera, rl, rt, size.width, size.height, pt);
      const s = Math.min(CAP, (Math.abs(x - pt[0]) * 0.9) / hw, (Math.abs(pt[1] - y) * 0.94) / hh);
      // The system's half height on screen (px), and the section edges it keeps inside.
      const hpx = (s * hh * rh) / 2 / Math.max(1e-6, Math.abs(pt[1] - y));
      if (st.ok && !framing.phone) {
        const down = st.top + EDGE - (cy - hpx);
        const up = st.bottom - EDGE - (cy + hpx);
        if (up < 0) cy += up;
        else if (down > 0) cy += down;
        clip = up < 0 || down > 0;
      }
      // Fades over at most about 60% of its own height (a small phone system fades sooner).
      const fx = Math.min(FADE[1] - FADE[0], 1.2 * hpx);
      const fe = Math.min(FADE[2], 1.2 * hpx);
      room = Math.min(room, smooth(FADE[0], FADE[0] + fx, cy + hpx), 1 - smooth(H - fe, H, cy - hpx));
      toWorld(camera, rl + rw / 2, cy, size.width, size.height, pt);
      fit.x = pt[0];
      fit.y = pt[1];
      const dist = Math.max(4, camera.position.z);
      fit.scale = (s * dist) / (dist + NEAR_Z * s);
    } else if (framing.phone) {
      room = 0;
    } else {
      fit.x = fit.y = 0;
      const s = fitFree(camera, size, hw, hh, CAP, CAP) * 0.94;
      const dist = Math.max(4, camera.position.z);
      fit.scale = (s * dist) / (dist + NEAR_Z * s);
    }
    // A held chip of the shown project: its stage index.
    const h = hold.current;
    const plan0 = rig.cur >= 0 ? model.plans[rig.cur] : null;
    const held = h && plan0 && plan0.slug === h.slug ? plan0.stages.indexOf(h.stage) : -1;
    rig.frame(state, dt, { project: live.current.project, weight, room, stretch, pointer, x: fit.x, y: fit.y, scale: fit.scale, clip, hold: held }, reg.current);
    syncChips(rig.cur, rig.lit);
    const shown = weight * room;
    setDrawn(rig.cur >= 0 && (drawn.current ? shown > 0.03 : shown > 0.1));

    const r = reg.current;
    if (!ids || !r.inner || rig.cur < 0) return;
    const { layer } = ids;
    if (!layer.begin(weight)) return;
    if (room < 0.05) {
      layer.hideAll();
      return;
    }
    const plan = model.plans[rig.cur];
    // After a project switch: technology lines, label sides.
    if (ids.plan !== rig.cur) {
      ids.plan = rig.cur;
      ids.lit = -2;
      model.slots.forEach((_, g) => {
        const text = plan.tech[g];
        const t = ids.tech[g];
        if (t.textContent !== text) t.textContent = text;
        t.style.display = text ? "" : "none";
        const up = plan.label[g] > 0;
        (layer.el.children[ids.name[g]] as HTMLElement).style.flexDirection = up ? "column-reverse" : "column";
        layer.setAlign(ids.name[g], up ? ABOVE : BELOW);
        layer.style(ids.name[g], {});
      });
    }
    // The stage the request is in: its chip lights (the Work labels' dark plate and 1 px
    // border, lit in the stage's colour; orange only for the answer).
    const litSlot = rig.lit >= 0 ? plan.steps[rig.lit].slot : -1;
    if (litSlot !== ids.lit) {
      model.slots.forEach((s, g) => {
        const on = g === litSlot;
        const tint = s.kind === "output" || s.kind === "tts" ? palette.accent : s.kind === "rag" ? palette.ok : palette.ai;
        Object.assign(ids.chip[g].style, {
          color: on ? tint : palette.fg,
          background: `color-mix(in srgb, ${palette.bg} 80%, transparent)`,
          borderColor: on ? tint : `color-mix(in srgb, ${tint === palette.accent ? palette.muted : tint} 50%, transparent)`,
          boxShadow: on ? `0 0 12px color-mix(in srgb, ${tint} 45%, transparent)` : "none",
        });
      });
      ids.lit = litSlot;
    }
    const W = size.width;
    // rig.frame just moved the root: refresh it too, or labels trail their objects by a frame.
    r.inner.updateWorldMatrix(true, false);
    const M = r.inner.matrixWorld;
    for (let g = 0; g < model.slots.length; g++) {
      const pr = rig.presence[g];
      if (pr < 0.05) {
        layer.hide(ids.name[g]);
        continue;
      }
      rig.labelAt(g, plan.label[g] > 0 ? 1 : -1, at);
      layer.place(ids.name[g], at[0], at[1], at[2], M, camera, W, H, pr * pr * room);
    }
    const k = Math.min(1, dt * 6);
    const B = rig.box;
    if (titleO.current.length !== n) titleO.current = new Float32Array(n);
    const tO = titleO.current;
    for (let j = 0; j < n; j++) {
      tO[j] += ((j === rig.cur ? 1 : 0) - tO[j]) * k;
      if (tO[j] < 0.02) layer.hide(ids.title[j]);
      else layer.place(ids.title[j], B[0] - B[2], B[1] + B[3], 0, M, camera, W, H, tO[j] * room);
    }
  });

  return (
    <group
      ref={(g) => {
        reg.current.root = g;
      }}
      visible={active}
    >
      <group
        ref={(g) => {
          reg.current.inner = g;
        }}
      >
        <mesh geometry={rig.gl.glows.geometry} material={rig.gl.spriteMat} frustumCulled={false} renderOrder={0} />
        <mesh geometry={rig.gl.panels.geometry} material={rig.gl.panelMat} frustumCulled={false} renderOrder={1} />
        <mesh geometry={rig.gl.links.geometry} material={rig.gl.linkMat} frustumCulled={false} renderOrder={2} />
        <mesh geometry={rig.gl.sprites.geometry} material={rig.gl.spriteMat} frustumCulled={false} renderOrder={3} />
      </group>
    </group>
  );
}
