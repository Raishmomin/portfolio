# Full-motion: technical research (implementation + code audit)

I wrote this to /tmp/claude-1000/-home-raish-raish-my-app/ffd02af8-1b89-4a04-a12d-8deb02a3d03d/scratchpad/data/fm/research-tech.md. It is about 2,470 words by `wc`, over the 1,600-word limit; most of the excess is code and CSS.

The evidence comes from a Playwright probe on `fm-stage` `next dev` :3919, using the real GPU, 1440×900 and 390×844, with `cp:3d=on`. The probe script is /tmp/claude-1000/-home-raish-raish-my-app/ffd02af8-1b89-4a04-a12d-8deb02a3d03d/scratchpad/tools/rt-probe.cjs. The server is stopped and the worktree is clean.

## 1. Root causes

| # | Symptom | Root cause (file:line) | Fix |
|---|---|---|---|
| 1 | Work titles bleed through the panels in services, cta, writing and faq | `director.ts:43` sets `INHERIT=0.5`. At `:70`, `key = scene ? raw : prev`, so non-scene sections give **work** a weight of 0.5. The probe confirmed `data-scene="work"` on all four. The titles are drei `<Html>` (`work.tsx:61`), faded by `f.weight` (`work/rig.ts:317`), so their opacity is about 0.5. They render inside the `-z-10` stage (`index.tsx:25`), under `bg-background/85` panels (`ui.tsx:14`), so 15% shows through and they show fully in the gaps. | Use `ambient` instead of `prev`, and drop `INHERIT`. Delete the Work `<Html>` titles, because the DOM cards already carry them. Occlude every remaining label (§3). |
| 1b | Experience labels sit over the panel | `LabelLayer.place` (`stack/labels.ts:176`) does no occlusion test. The probe found 2 labels over panel text ("Fahm Technologies · 2021–2022", "Frontend Developer"). | Occlusion (§3). |
| 2 | Work cards overlap the Work panel | `work.tsx:29` fits the wall to the full `viewport.width`, with 3 columns because `columns(6)=3`. `stage.tsx:148-150` then shifts the view by 21% of the width at zoom 0.82, so the wall spans about 30–112% of the width. The panel ends at about 59% (848px). | Fit scenes to the **free rect** that the stage exposes (§3), not to `viewport`. |
| 3 | Inherited scene | Same as #1 (`director.ts:42-43,70,76`). | Resolve the scene as `el.dataset.scene ?? (isScene(section) ? section : "ambient")`. Add `ambient` to `SCENE_KEYS` (`types.ts:151-152`) and to `SCENES` (`stage.tsx:30`). |
| 4 | Mobile is noisy | Below 1024px the framing is off (`stage.tsx:143-144`), so scenes sit full-screen and centred behind the body text. Labels are never gated: the probe counted **16 stack labels visible at 390px**. | Use the phone treatment (§3). |
| 5 | The current-role label clips | Labels are centred with `translate:-50%` (`experience/rig.ts:419-420`) inside a layer with `overflow:hidden` (`labels.ts:150`), and `place()` never clamps (`labels.ts:187-192`). The view offset pushes the newest ring to the right edge. The probe saw the clip at experience progress 0–0.2 ("Fahm Technologies · 2024–now" plus the role). | Cache each label's width once (`offsetWidth` after `document.fonts.ready`, and again on restyle). Clamp `px` to `[12+w/2, W-12-w/2]` and `py` to the same range. |
| NEW | **The AI scene's progress freezes while the section is pinned** | `ai.tsx:22` sets `data-pin`, so ScrollTrigger pins the section. `director.ts:72-74` reads the section's own rect, which stays at `top=0` while pinned. The probe showed director progress stuck at **0.424** while `--pin-progress` moved 0 → 0.48. | Measure the `.pin-spacer` instead (§2 hscroll). |
| 7a | `Cannot read properties of undefined (reading 'map')` | **Not reproduced.** 10 routes were cold-compiled in dev and 4 client navigations followed: 0 pageerrors, and only warnings (`images.qualities` is missing 85, and `THREE.Clock` is deprecated). The most likely trigger is Fast Refresh of the lazy stage chunk while the page is open: new scene code runs against the **old** `data` prop from the earlier RSC payload, and some `.map` hits a field that is missing. Candidates: `stack/layout.ts:51,89` (`data.skills/links.map`), `experience/path.ts:102`, `ai/pipeline.ts:54`. R3F rethrows errors from the Canvas reconciler into the parent tree, and **there is no error boundary anywhere** (no `app/error.tsx`, no ErrorBoundary). | (a) Add a class ErrorBoundary around `<Stage>` at `stage-island.tsx:117`, with `componentDidCatch → onFallback()` so the poster stays. (b) Add `app/error.tsx`, a segment boundary under the root layout. (c) Have the scenes guard data, for example `if (!data.skills?.length) return null`. |
| 7b | React says "Encountered a script tag" at `layout.tsx:133` | This is a consequence of 7a. The error escapes to the root, Next's default root boundary re-renders `<html><head>` on the client, and React 19 then creates the inline `<script>` on the client and warns. | Items (a) and (b) above remove it. **Keep the raw inline script.** `next/script beforeInteractive` in the App Router runs after the bootstrap, which would cause a theme flash. |

## 2. Hook recipes (`components/motion/bindings.ts`, registered in `BINDERS`)

Keep `seen()`, `gsap.context` and `matchMedia` as they are. The runtime already slices binding into 8 ms chunks (`runtime.ts:165`) and refreshes once (`:121`).

**Rule:** an element with `data-card` must not carry `data-reveal`, because the CSS reveal (`globals.css:171-192`) also drives opacity. In `work.tsx`, put `data-card` on the `<li>` in place of `reveal()`, and keep `data-tilt` on the inner `<article>`.

**data-card-group / data-card** (a standalone `data-card` binder skips cards inside a group):
```ts
const FROM = { rise:{y:48,z:-140,rotationX:14}, flip:{y:24,z:-120,rotationY:-22}, zoom:{z:-180,scale:.86} };
function cardGroup(g: HTMLElement): Binding {
  const cards = [...g.querySelectorAll<HTMLElement>("[data-card]")]
    .filter(c => c.closest("[data-card-group]") === g && !seen(c));
  if (!cards.length) return NOOP;
  g.style.perspective = "1200px";
  const ctx = gsap.context(() => {
    for (const c of cards) {
      gsap.set(c, { ...(FROM[c.dataset.card as keyof typeof FROM] ?? FROM.rise), opacity: 0, transformOrigin: "50% 100%" });
      gsap.set(c.querySelectorAll("[data-card-part]"), { y: 14, opacity: 0 });
    }
    ScrollTrigger.batch(cards, { start: "top 88%", once: true, interval: 0.1, batchMax: 8,
      onEnter: (batch) => {
        const rs = batch.map(c => c.getBoundingClientRect());          // reads first
        const o = rs[0];
        batch.forEach((c, i) => {
          const d = Math.min(8, Math.round(Math.hypot((rs[i].left-o.left)/o.width, (rs[i].top-o.top)/o.height)));
          gsap.timeline({ delay: d * 0.075 })
            .to(c, { y:0, z:0, rotationX:0, rotationY:0, scale:1, opacity:1, duration:1.1, ease:"expo.out", clearProps:"transform,opacity" })
            .to(c.querySelectorAll("[data-card-part]"), { y:0, opacity:1, duration:.8, ease:"expo.out", stagger:.07, clearProps:"transform,opacity" }, .15);
        });
      } });
  }, g);
  return { revert() { ctx.revert(); g.style.removeProperty("perspective"); } };
}
```

**data-deck: use CSS sticky, not pins.** Pins add one pin-spacer per card, rewrite the layout on refresh, and risk CLS and anchor drift. Sticky stays native and keeps every slot in the flow. The card scales with the **individual `scale` property** and dims with a pseudo-element's opacity, so it never fights GSAP's `transform`:
```css
@media (min-width:1024px){
 html.motion-live [data-deck]>[data-card]{position:sticky;top:calc(88px + var(--i)*14px);scale:calc(1 - .08*var(--deck,0))}
 html.motion-live [data-deck]>[data-card]::after{content:"";position:absolute;inset:0;border-radius:inherit;background:hsl(var(--background));opacity:calc(.45*var(--deck,0));pointer-events:none}}
```
```ts
cards.slice(0,-1).forEach((c,i)=>ScrollTrigger.create({ trigger: cards[i+1], start:"top bottom", end:()=>`top ${88+(i+1)*14}px`,
  scrub:.4, onUpdate:s=>c.style.setProperty("--deck",s.progress.toFixed(3)) }));  // + set --i per card; revert removes vars
```

**data-hscroll** (inside `mm.add(DESKTOP)`):
```ts
const track = el.querySelector<HTMLElement>("[data-hscroll-track]")!;
const dist = () => Math.max(0, track.scrollWidth - el.clientWidth);
const tw = gsap.to(track, { x: () => -dist(), ease: "none", scrollTrigger: {
  trigger: el, start: "top top", end: () => `+=${dist()}`, pin: true, scrub: .6, anticipatePin: 1, invalidateOnRefresh: true,
  onUpdate: s => { el.style.setProperty("--hscroll-progress", s.progress.toFixed(4));
    el.dispatchEvent(new CustomEvent("cp:hscroll", { bubbles: true, detail: { progress: s.progress } })); } } });
const onFocus = (e: FocusEvent) => {                       // keyboard: bring the focused card into view
  const c = (e.target as HTMLElement).closest<HTMLElement>("[data-card]") ?? (e.target as HTMLElement);
  const st = tw.scrollTrigger!, p = clamp((c.offsetLeft - (el.clientWidth - c.offsetWidth) / 2) / (dist() || 1), 0, 1);
  window.scrollTo({ top: st.start + p * (st.end - st.start), behavior: "instant" });
};
el.addEventListener("focusin", onFocus);
```
**Director with pins** (`director.ts:72`). Measure the spacer, and compute progress over the pin distance:
```ts
const box = el.parentElement?.classList.contains("pin-spacer") ? el.parentElement : el;
const r = box.getBoundingClientRect();
const p = box !== el ? clamp01(-r.top / Math.max(1, r.height - vh)) : clamp01((c - r.top) / r.height);
```
Use the spacer rect for the crossfade `f` as well.

**data-spotlight.** If the element also has `data-tilt`, reuse its `--gx/--gy`, because tilt already writes them (`bindings.ts:246`). Otherwise use a light binder: cache the rect on `pointerenter`, then write `--gx/--gy` in rAF.
```css
@property --sweep{syntax:"<angle>";inherits:true;initial-value:0deg}
html.motion-live [data-spotlight]{position:relative}
html.motion-live [data-spotlight]::before{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;opacity:0;transition:opacity .3s;
  background:radial-gradient(360px circle at var(--gx,50%) var(--gy,50%),hsl(var(--primary)/.10),transparent 60%)}
html.motion-live [data-spotlight]::after{content:"";position:absolute;inset:0;padding:1px;border-radius:inherit;pointer-events:none;opacity:0;
  background:conic-gradient(from var(--sweep),transparent 0 70%,hsl(var(--primary)) 82%,var(--ai) 90%,transparent);
  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude}
html.motion-live [data-spotlight]:hover::before,html.motion-live [data-spotlight]:hover::after{opacity:1}
html.motion-live [data-spotlight]:hover::after{animation:sweep 2.4s linear infinite}
@keyframes sweep{to{--sweep:360deg}}
```
Do not combine it with `.border-glow`, which also uses `::after`. The `--sweep` animation repaints on the main thread, which is acceptable because it only runs on hover and on one card at a time.

**data-draw:**
```ts
const paths = el instanceof SVGPathElement ? [el] : [...el.querySelectorAll<SVGGeometryElement>("path,line,polyline,circle")];
const prev = paths.map(p => p.getAttribute("pathLength"));
paths.forEach(p => p.setAttribute("pathLength", "1"));
const ctx = gsap.context(() => gsap.fromTo(paths, { strokeDasharray: 1, strokeDashoffset: 1 }, { strokeDashoffset: 0, ease: "none",
  scrollTrigger: { trigger: el, start: "top 85%", end: "bottom 55%", scrub: .5 } }));
return { revert() { ctx.revert(); paths.forEach((p, i) => prev[i] == null ? p.removeAttribute("pathLength") : p.setAttribute("pathLength", prev[i]!)); } };
```
Do not skip seen elements here: a scrub draws them fully once you are past them.

**data-marquee.** The binder clones the track's children with `aria-hidden` plus `inert`, so the server HTML never duplicates text, and `revert()` removes the clones. The animation is pure CSS on the compositor. An IntersectionObserver toggles `data-off` while it is offscreen.
```css
html.motion-live [data-marquee]>*{display:flex;width:max-content;animation:mq var(--mq,40s) linear infinite}
[data-marquee]:hover>*,[data-marquee]:focus-within>*,[data-marquee][data-off]>*{animation-play-state:paused}
@keyframes mq{to{transform:translateX(-50%)}}   /* static: flex-wrap */
```
`relevant()` (`runtime.ts:198`) must ignore the clones (`.mq-clone`), just as it ignores split words.

## 3. Stage recipes (`stage.tsx` Rig)

- **Framing.** In `measure()`, accumulate a weight for each layout (`left|right|full|band`), read from `section.dataset.stage ?? "left"` with the same `f*norm` as the scenes, and set `data-stage-layout` next to `data-scene` (`director.ts:126`). The Rig blends a frame vector per layout, eased with `CAMERA_TAU`. This replaces the hero special case at `:116-118`, where hero gets `ox=0` because its camera already frames itself:

  | Layout | `ox` | `oy` | `zoom` | `dim` | Free rect |
  |---|---|---|---|---|---|
  | `left` | +0.21 | 0 | 0.82 | 1 | x 0.5–1 |
  | `right` | −0.21 | 0 | 0.82 | 1 | x 0–0.5 |
  | `full` | 0 | 0 | 1 | 0.55 (behind a CSS scrim) | — |
  | `band` | 0 | +0.18 | 0.9 | 1 | — |

  Apply it as `setViewOffset(W,H,-W*ox,-H*oy,W,H)` and `zoom`. Publish `freeRect` (px) on the store. Scenes fit with `worldW = 2*tan(fov/2)*dist*aspect/zoom * freeRect.w/W`, which fixes #2.
- **Ambient (2 draw calls).** (1) A `Points` field with a ShaderMaterial: about 1400 points on high quality, 600 on low, in a static buffer. Drift and twinkle happen in the vertex shader from `uTime` and sin noise, with no CPU work per frame. (2) `LineSegments` for precomputed k=2 nearest links, also static, with alpha from a slow travelling "wave" plane in the shader. Uniforms: `uOpacity=weight`, `uDim`. Set `visible=false` when the weight is 0.
- **Label occlusion.** Cache occluder rects in **document coordinates** from offsets (the `offsetTop/Left` chain ignores entrance transforms) for `.panel, [data-card], [data-occlude], main h2, main p`. Recompute them on the ResizeObserver, on `ScrollTrigger` `refresh` and on `document.fonts.ready`. Sort them by y. Each frame, take the occluders in the viewport (binary search on `scrollY`) and test them against each label's projected box, using the cached label size. Hide a label on overlap with a quick fade. The cost is about 20×15 comparisons per frame. The rule from the contract still applies: no labels below an active weight of 0.6.
- **Multi-page.** Keep the stage mounted per page, because the contract mounts it as the first child of `<main>`. The `contextOwner` handshake (`runtime.ts:275`) already serialises navigations. Subpages use `data-section="projects" data-scene="work"`. Don't hoist the stage into the root layout, which would mean DB queries on every route.
- **Phone (<1024px).** Gate labels off by skipping `place()` and calling `hideAll()`. Force `band` behaviour: full strength only while a section opening (the `pt-[38svh]` window) or a `[data-stage-band]` is in view, and `uDim≈0.25` behind text. Turn pointer parallax off. Use DPR 1.
- **drei `<View>` inside cards: NO.** (1) The canvas is fixed at `-z-10` behind 85%-opaque panels, so a View would render *under* the card unless the card punches a transparent hole. (2) Each View is an extra scissored render pass with its own camera, and the cost grows with the number of visible cards. (3) View reads `getBoundingClientRect` for each view every frame. That fights GSAP and tilt transforms, causing layout reads and a 1-frame lag that misaligns tilted cards. (4) Its events need canvas pointer events, but ours is `none`. **Alternatives:** animated SVG micro-visuals in the cards (reuse the poster's `nw-flow` keyframes; no GPU, no JS), plus `full`-layout sections where the stage scene is framed *around* the cards.

## 4. Performance (4 threads, integrated GPU)

- **Budgets for home:**
  - At most 70 ScrollTriggers at bind. `once` triggers are killed after they fire.
  - At most 10 scrubbed triggers active at the same time.
  - At most 2 pins per page (AI plus one hscroll).
  - At most 120 draw calls in the stage. Ambient is 2.
  - DPR is capped at 1.25 while the `full` layout dominates, because of fill rate.
- **`will-change`.** Only GSAP's force3D should apply it during a tween, removed again with `clearProps`. Never apply it permanently to cards. `labels.ts:159` puts `will-change` on every label (about 35 layers), so set it only while a label is visible.
- **Layout thrash:**
  - `director.ts:72` reads every section rect on each scroll frame, interleaved with ScrollTrigger's writes. Switch to cached document offsets plus `scrollY`, so there are zero reads per frame.
  - The tilt (`bindings.ts:240`) and magnetic (`:280`) binders read the rect on every `pointermove`. Cache it on `pointerenter`.
  - Card batches must do all their reads first and their writes after (the recipe above does this).
- **INP and TBT:**
  - Keep the 8 ms drain.
  - Run one sorted refresh after the drain (that already exists), and expect 10–20 ms with about 70 triggers.
  - Use `ScrollTrigger.config({ limitCallbacks: true })`.
  - Don't use `invalidateOnRefresh` on non-scrubbed tweens.
  - Pause the marquee and ambient when they are offscreen or idle (the stage idle pause exists at `stage.tsx:353`).

## 5. SEO, CLS and accessibility risks

| Hook | Risk | Mitigation |
|---|---|---|
| card | Content hidden from crawlers | Hide only after the bind, and only cards that are not `seen()`. Googlebot's tall viewport means everything counts as seen. Never hide in CSS. Transforms are not CLS. |
| deck | Anchors land under the stacked cards | `scroll-margin-top: calc(88px + var(--i)*14px)`. Apply sticky only under `html.motion-live` at ≥1024px. |
| hscroll and pin | A spacer inserted while the user is below the section shifts the content; hash links drift | Bind pins on the first idle pass before the user scrolls. Assert CLS ≤ 0.02 with a `layout-shift` PerformanceObserver in Playwright. Use `focusin` scroll-sync (recipe). Leave arrow keys and Page Up/Down native. On mobile, use a vertical stack, or a scroll-snap row with `tabindex=0` only when it has no focusable children. |
| spotlight | None (decorative) | Pseudo-elements with `pointer-events:none`. Keep text contrast inside the 10% glow. |
| draw | None | Fully drawn without motion (the binder adds `pathLength` only at runtime). |
| marquee | WCAG 2.2.2 (moving content) and duplicate text | Pause on hover and focus, plus a visible pause button. Make the clones JS-only, `aria-hidden` and `inert`. Static with wrapping when motion is off. |
| all | Motion off or reduced | `stop()` reverts every binding (`runtime.ts:226`). Gate all CSS under `html.motion-live`. |