# Full-motion redesign: spec for the 3 designer lanes

**Owner feedback (2026-11-06, after the Neural phase).** Tested in Playwright, the owner reported:
- "All sections and design are not match."
- "Make animation on our content cards."
- "You just set animation in one side. I want full site content with animation."

The team is 2 researchers (visual + technical), whose findings feed 3 senior 3D/motion designers. Each designer works in their own lane.

## Diagnosis (Playwright audit, 1440×900 dark, 3D on; screenshots in scratchpad/audit/)

1. **The 3D always sits on one side.** All 10 home sections share one composition: a bordered panel on the left and the 3D on the right. That repetition is what reads as "animation only on one side".
2. **Content is static.** Cards, lists and rows only fade in, and nothing inside the content moves in depth. The motion lives in the background, never in the cards.
3. **Scenes don't match their sections.**
   - services, cta, writing and faq inherit the Work scene at half weight, so the project windows and their DOM labels ("Qanoni AI – Smart Legal…", "CareerFuse") bleed through the text panels.
   - The Work scene's cards overlap the Work panel.
4. **Subpages don't match the home page.** Subpages have no stage (0 canvases), only a small motif card, and a flatter look. The site doesn't read as one design.
5. **Mobile is noisy.** Scene labels and nodes sit behind the body text.
6. **A label clips.** The current-role label on the experience path is cut off at the right edge at 1440px.
7. **Dev overlay shows "2 Issues".**
   - `Cannot read properties of undefined (reading 'map')`, seen during an on-demand compile in `next dev`.
   - React's "Encountered a script tag while rendering React component" at app/layout.tsx:133. It follows from a client re-render of the root after an error.

## Art direction (one design language for the whole site)

### The stage is full-bleed; content lives inside the scene
Each section declares where its content sits with `data-stage`, and the stage frames its scene around that content. **Consecutive sections must not use the same composition**, so the rhythm alternates:

| Composition | Content | Scene |
|---|---|---|
| `left` | panel on the left | scene framed right |
| `right` | panel on the right | scene framed left |
| `full` | content floats over the scene as separate cards | scene centred, large, behind/around the cards, dimmed under text with a scrim |
| `band` | content below | scene owns a full-width band above the content (no text over it) |

### Every content card moves
- Cards enter from depth with a perspective rise or flip, and their inner parts (title, then text, then chips) cascade.
- Groups enter as a wave, staggered by grid position.
- Experience is a horizontal journey. Work and AI cards stack like a deck while you scroll. Connector lines draw.
- Hover: tilt plus glare plus a pointer spotlight with a light sweep along the border.
- The cards always stay readable.

### Shared tokens (identical in every lane)
- **Easing:** `cubic-bezier(.16,1,.3,1)` (`expo.out`) for entrances, `power2.inOut` for scrubs.
- **Timing:** entrances 0.9–1.2 s; stagger 60–90 ms (max 8 steps).
- **Depth:** perspective 1200px. Entrance-from-depth goes from `translate3d(0,48px,-140px) rotateX(14deg)` at opacity 0 to identity.
- **One panel look:**
  - `.panel` = rounded-xl, 1px border, bg-background/85, no backdrop-filter
  - section padding the same everywhere
  - the same section head everywhere: kicker "0N · NAME", h2 with a serif-italic tail, then the 3D caption chip
- **Colour:** orange = primary/active, green = ok/current, `--ai` = neural glow only.

### What is non-negotiable (tasks/seo-audit.md §6, tasks/neural-spec.md "Non-negotiables")
- Every word stays in server HTML; the canvas carries no content.
- The h1, hero subtitle and intro are never animated or hidden.
- Nothing is hidden without JS (`opacity:0` only under `html.js` while motion is allowed).
- **The tri-state motion contract is unchanged:** `cp:3d`, `html[data-motion]`, the `cp:3d` event.
- **Motion off or reduced:** the static, fully visible layout.
- **The 3D:** one canvas per page, lazy and gated (software WebGL rejected).
- **Native scrolling:** no smooth-scroll library, no scroll-jacking. Pins use ScrollTrigger with native scroll; anchors and keyboard must keep working.
- **Budgets:**
  - initial JS ≤ +10 KB versus today
  - GSAP chunk ≤ 50 KB gzip (lazy)
  - 3D chunk ≤ 300 KB gzip (lazy)
  - CLS ≤ 0.02
  - INP: no long task > 50 ms when motion enables
- **Pages and data:** every URL, metadata/JSON-LD block, one h1, and static/ISR route types stay. Only real data.

## Contract between lanes

### Stage (owned by lane **stage**; used by **home** and **pages**)
- **Mount:** `<NeuralStage data={toNeuralData(...)} />` works on **any** page, as the first child of `<main>`. Signatures of `NeuralStage`, `NeuralMotif`, `toNeuralData` and `isAiProject` stay compatible.
- **Section keys:** `data-section="<name>"` on each section the director tracks. A section whose name is a scene key uses that scene.
- **Scene override:** `data-scene="<SceneKey>"` on a section picks its scene explicitly, which subpages use (e.g. `data-section="projects" data-scene="work"`).
  - Scene keys: `hero | stack | experience | ai | work | contact | ambient`.
  - **`ambient` is new:** a calm, full-bleed drifting neural field for sections without their own visual (services, cta, writing, faq, blog, 404).
  - Sections without a scene key or override get `ambient`, **never** the previous scene.
- **Composition:** `data-stage="left|right|full|band"` (default `left`) on the section frames the camera to the free space. Below 1024px the stage chooses a phone treatment itself: the scene lives in band areas / section openings, and is dimmed behind body text.
- **Focus:** `data-focus-id="<skill id | project slug>"`, unchanged.
- **Labels:** 3D DOM labels may show only for the active scene (weight ≥ 0.6). They must never be visible over a `.panel`, card or text (hide on overlap, or draw them in-canvas behind the content). No clipping at viewport edges.
- **Exposed state:** the stage sets `data-scene` (active) and `data-stage-layout` on `[data-neural-stage]`, for QA and CSS.

### Motion hooks (owned by lane **home** in components/motion; used by **home** and **pages**)
The existing hooks keep working: `data-reveal`, `data-split`, `data-parallax`, `data-count`, `data-pin`/`data-step`, `data-tilt`, `data-magnetic`. These are new:

| Hook | Behaviour | Without motion |
|---|---|---|
| `[data-card]` (`rise` default, `flip`, `zoom`) | 3D entrance from depth (shared tokens) when it enters. Inner `[data-card-part]` elements cascade in DOM order. | Static and visible. |
| `[data-card-group]` | Container. Its `[data-card]`s enter as a wave staggered by grid row/column distance, and sets `perspective`. | n/a |
| `[data-deck]` | Desktop ≥1024 only. Its `[data-card]` children become a sticky stacked deck: each card sticks under the header and the next slides over it, while earlier cards scale to ~0.92 and dim (scroll-scrubbed). | Mobile, no-JS and motion off get a normal list. |
| `[data-hscroll]` | Desktop ≥1024 only. Pins the section and scrubs its `[data-hscroll-track]` horizontally with vertical scroll (native scroll, ScrollTrigger pin). Exposes `--hscroll-progress` and fires the `cp:hscroll` event. | Mobile gets a vertical stack (or a native scroll-snap row); all content stays in the DOM and is focusable. |
| `[data-spotlight]` | Pointer:fine only. A radial light follows the pointer inside the element (CSS vars `--mx/--my`), plus a light sweep on the 1px border on hover. Works together with `data-tilt` (no transform conflict). | n/a |
| `[data-draw]` | On `<svg>` or `path`: the stroke draws on scroll (scrub). | Fully drawn. |
| `[data-marquee]` | An endless ticker. Duplicated content is aria-hidden; it pauses on hover/focus. | Static row, wraps. |

**Ownership rule:** GSAP owns `transform` on `data-card`/`data-tilt`/`data-parallax`/`data-magnetic` elements. Never put two transform hooks on one element; nest wrappers instead. (Exception: `data-tilt` and `data-spotlight` share an element by design.)

## Lanes (strict file ownership; each in its own worktree)

| Lane | Branch / port | Owns |
|---|---|---|
| **stage** (3D Stage Director) | fm-stage / 3911 | `components/neural/**`, including the contract files `types.ts` and `neural-data.ts` (keep the exported function signatures) |
| **home** (Home and Motion Designer) | fm-home / 3912 | `app/page.tsx`, `components/home/**`, `components/motion/**`, `components/reveal.tsx`, `app/globals.css`, `tailwind.config.js`, `app/layout.tsx`, `components/ui/**`, `package.json` (deps) |
| **pages** (Pages Designer) | fm-pages / 3913 | every other `app/**/page.tsx` and `app/not-found.tsx`, `components/pages/**`, `components/service-page.tsx`, `author-bio`, `related-posts`, `toc`, `components/header/**` (the motion-toggle/theme-toggle behaviour stays), `components/footer.tsx`, `components/navbar.tsx` |

Lanes code against this contract and do not wait for each other. A hook or attribute that isn't implemented yet must degrade to the static layout, so it never breaks anything.
