# Neural redesign — spec for the parallel lanes

**Owner feedback (2026-11-06).** The cluster/pods visual was abstract and not connected to sections. The owner wants:
- a fully animated 3D site that impresses visitors and makes them want a 3D site of their own
- AI / neural-network themed
- on-scroll effects everywhere
- every visual obviously related to the section it sits in

## Concept

One fixed, full-viewport 3D stage sits **behind** the home page and changes scene as you scroll. Every scene shows what its section is about, and the section text explains it in plain words.

| Section (`data-section`) | Scene file | What it shows (must be understandable without explanation) |
|---|---|---|
| `hero` | scenes/hero.tsx | A glowing 3D neural network: 4–5 layers of nodes, connections, and signal pulses travelling input→output. The network leans toward the pointer, and the nodes nearest the cursor brighten. |
| `stack` | scenes/stack.tsx | Raish's real skills as a constellation. Nodes are clustered by layer (frontend, backend, data, devops, ai) and sized by `uses`. Edges = `links`, drawn brighter with weight. The hovered skill (`focus`) lights up its edges. Short aria-hidden labels (drei `<Html>`) appear on the top ~12 skills. |
| `experience` | scenes/experience.tsx | A glowing 3D timeline path with one milestone per company (oldest→newest), segment length ∝ months. The camera dollies along the path with `progress`, and the current role pulses. |
| `ai` | scenes/ai.tsx | An AI pipeline. Stage nodes (from `data.ai[i].stages`, e.g. Input → Speech-to-text → Retrieval → LLM → Text-to-speech → Output) are linked by a flow tube with particles streaming through it. `progress` steps through `data.ai` projects; `focus` selects one. Stage names are aria-hidden `<Html>` labels. |
| `work` | scenes/work.tsx | One floating 3D card per featured project, in a gentle arc. Cards assemble from scattered as `progress` goes 0→0.3, and the focused card lifts forward. AI projects get a small neural glyph on their card. |
| `contact` | scenes/contact.tsx | The whole network converges into one bright node, with a line drawn out to the viewer ("let's connect"). |

Sections without a scene (services, writing, faq, cta) keep the previous scene, dimmed.

## Layout and readability
- Content scrolls over the stage. Long text sits on panels: `bg-background/80`, a 1px border, rounded corners. Do not use backdrop-filter over the canvas, because it is too expensive.
- The hero is full viewport. The h1, subtitle and CTAs go on the left over a calm area of the network, and the network fills the rest.
- Contrast must be ≥ 4.5:1 on every panel in both themes.

## Visual language
- Same tokens as before: ink/bone, orange = primary/active, green = status/ok. Add an **AI accent**, cyan-violet `--ai` (dark `#7C9CFF`, light `#3F5BD9`), for neural/AI glows only.
- Glow comes from additive blending and soft sprite textures generated at runtime. No postprocessing package, no network assets, no GLTF.

## Motion (every page)
GSAP + ScrollTrigger are **lazy-loaded after `load`**, or CSS scroll-driven animations with an IntersectionObserver fallback. Hooks:
- `[data-reveal]` (+ `data-reveal-delay`): fade/slide in.
- `[data-split]`: headings h2/h3 split into words and staggered. **Never the h1**, the hero subtitle or intro text, because they are LCP candidates.
- `[data-parallax="-1..1"]`: parallax.
- `[data-count]`: number counters. The **server HTML must contain the final number**; animation is enhancement only.
- `[data-pin]`: the AI section pins on desktop and steps through the AI projects.
- Also: a scroll progress hairline, a cursor glow and magnetic primary buttons on `pointer:fine`, and hover tilt on project cards.

No scroll-jacking and no smooth-scroll libraries. Anchors and keyboard scrolling must keep working.

### The motion/3D preference (keep exactly)
- localStorage `cp:3d` = `on` | `off` | absent (= auto).
- `html[data-motion]` is set before paint by the head script; window event `cp:3d`.
- Auto follows the OS `prefers-reduced-motion`. An explicit `on` overrides it for both 3D and motion; `off` disables both.

## Non-negotiables (SEO/GEO — tasks/seo-audit.md §6)
- Every word is server-rendered HTML; the canvas carries no content. `<Html>` labels duplicate DOM text and are `aria-hidden`.
- The h1 and intro are never animated or hidden. Nothing is hidden without JS (`opacity:0` only under `html.js`).
- One `<Canvas>` per page, mounted after `load` + idle, behind the motion gate, and only on capable devices. The gate rejects only software WebGL, `hardwareConcurrency < 4` or `deviceMemory < 4` (in auto mode also reduced motion and Save-Data). A runtime frame monitor drops quality, then falls back to the poster. `frameloop="demand"` or pause when the tab is hidden; dispose everything on unmount; one WebGL context only.
- Budgets:
  - lazy 3D chunk ≤ 300 KB gzip in total
  - GSAP chunk ≤ 50 KB gzip, lazy
  - initial JS must not grow more than 10 KB versus today
  - CLS ≤ 0.02, and the LCP element stays the h1/intro
- Keep every URL, one h1 per page, every metadata/JSON-LD block, and the static/ISR route types.
- Only real data. AI positioning must be factual: derive it from AI projects in the DB, never invent claims.

## Lanes (each in its own git worktree, strict file ownership)

| Lane | Owns |
|---|---|
| engine | `components/neural/**` EXCEPT scenes/{stack,experience,ai,work,contact}.tsx and the two contract files, which stay as they are. Builds `NeuralStage` (the stage, scene director and blending, gate, palette, focus delegation, poster SVG per scene, frame monitor) and `NeuralMotif`, plus `scenes/hero.tsx`. May add deps. |
| scenes-a | `components/neural/scenes/stack.tsx`, `components/neural/scenes/experience.tsx` (+ private helpers under `components/neural/scenes/stack/**` and `components/neural/scenes/experience/**`) |
| scenes-b | `components/neural/scenes/ai.tsx`, `work.tsx`, `contact.tsx` (+ helpers under `components/neural/scenes/{ai,work,contact}/**`) |
| motion | `components/motion/**`, `app/globals.css`, `app/layout.tsx`, `components/reveal.tsx`, `tailwind.config.js`, `package.json` deps for gsap |
| home | `app/page.tsx`, `components/home/**` |
| pages | every other `app/**/page.tsx` + `components/pages/**`, `components/service-page.tsx`, `author-bio`, `related-posts`, `toc` |

Scene lanes test their scenes in a temporary harness route (e.g. `app/neural-lab/page.tsx` with range sliders for progress/weight). **They delete it before committing.**

**Ports:** engine 3901, scenes-a 3902, scenes-b 3903, motion 3904, home 3905, pages 3906.
