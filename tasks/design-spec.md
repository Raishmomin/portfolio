# Design Spec — "Control Plane"

Raish Momin's portfolio is redesigned as a living Kubernetes control plane. Instanced "pods" (rounded cubes) get scheduled into formations built from Raish's real data as you scroll. All words are server-rendered HTML; the 3D is decoration that can be switched off.

Sources: 2,095-portfolio scan, Analyst A (20 immersive 3D sites) and Analyst B (20 crafted sites), and the SEO/GEO rulebook (`seo-audit.md`). Both analysts independently recommended this concept: A's "Control Plane" and B's "Scheduler". We borrow patterns only and never clone any single site.

Borrowed patterns:
- Decorative WebGL behind server-rendered type (hamishw.com)
- Restraint with one shader or one object (p5aholic)
- Workspace-as-navigation with an HTML legend (carlos-rojas)
- Sticky rail with scroll-spy (brittanychiang)
- Spec-sheet annotations (chanh-dai)
- The site as a running system (carlton-lindsay)
- Motion toggle used as the low-end fallback (pavithran26)

Anti-patterns we explicitly avoid:
- Loaders or game gates
- Content inside the canvas
- Multiple WebGL contexts
- Animated LCP text
- Spline runtime
- Multi-MB assets
- Missing h1
- Buzzword marquees

---

## 1. Non-negotiables (from `seo-audit.md` §6 — these win every conflict)

1. **Server-rendered content:** pages and layouts are Server Components. Client code lives only in leaf islands that get data via props, and no page content is fetched on the client.
2. **No content in the canvas:** no drei `<Text>`/`<Html>` carrying copy. Any clickable 3D thing has a DOM link or button equivalent.
3. **LCP element:** the home h1 or the intro paragraph. Never animate the h1, the display line or the intro text (no opacity, clip-path or translate). No loaders, no Suspense fallback hiding text.
4. **Mounting the 3D:** one `<Canvas>` per page, mounted via `next/dynamic({ ssr:false })` inside a `'use client'` island, after `load` plus `requestIdleCallback` (1.5s `setTimeout` fallback), and only while its box is in view.
5. **Capability gate:** the canvas never mounts with
   - `prefers-reduced-motion: reduce`
   - Save-Data
   - `deviceMemory ≤ 4` or `hardwareConcurrency ≤ 4`
   - no WebGL2
   - the 3D toggle off

   In each of those cases the server-rendered SVG poster stays.
6. **CLS:** the canvas sits in a pre-sized box (`contain: strict`) over the poster and fades in with opacity only. Target CLS ≤ 0.02.
7. **Budgets:**
   - Initial JS for `/` ≤ 150KB gzip; other routes ≤ 130KB.
   - Lazy 3D chunk ≤ 250KB gzip (three + R3F v9 + named drei v10 imports + maath).
   - 3D assets: 0 GLTF and at most one ≤ 16KB texture.
8. **Lighthouse mobile** on `/`, `/about`, `/projects`, `/blog`, one service and one post: Perf ≥ 95, SEO 100, A11y ≥ 95, BP 100, LCP < 2.5s (target ≤ 2.0s), CLS < 0.1, TBT < 200ms.
9. **Runtime:**
   - `frameloop="demand"` + `invalidate()`; pause offscreen and on `document.hidden`.
   - dpr `[1,1.5]` desktop, `[1,1]` mobile; `antialias:false`, `powerPreference:'low-power'`.
   - `<PerformanceMonitor>` falls back to the poster.
   - Handle `webglcontextlost` by showing the poster; dispose on unmount.
   - No setState in `useFrame`, no per-frame allocations.
10. **Accessibility:**
    - The canvas wrapper is `aria-hidden`, `role="presentation"` and `tabIndex={-1}`.
    - Text contrast ≥ 4.5:1 in both themes, visible focus rings, and the skip link targets `#main`.
    - No scroll-jacking, no smooth-scroll library.
11. **No-JS view is complete:** reveal animations apply only when an inline head script has added `html.js` and the user allows motion.
12. **URLs and SEO assets:**
    - Every baseline URL still returns 200 (or a deliberate 301 to a 200).
    - Exactly one h1 per page.
    - `buildMetadata()` on every route.
    - Keep all JSON-LD @ids, OG routes, feed, llms files and the Search Console file.
    - Indexable routes stay static/ISR.
13. **Identity facts** come only from `app/lib/profile.ts`, and content only from real DB data via `app/lib/data.ts`. **Never invent metrics, clients or claims.**

## 2. Visual system

### Palette (CSS variables; Tailwind reads them)

| Token | Dark (default) | Light |
|---|---|---|
| `--bg` | `#0E0F11` ink | `#F5F3EE` paper |
| `--panel` | `#16181C` | `#FFFFFF` |
| `--hairline` | `#26292F` | `#E2DED5` |
| `--fg` | `#ECE7DC` bone | `#141518` |
| `--muted` | `#8E9097` | `#5F6368` |
| `--accent` | `#FF5B1F` safety orange (active, focus, primary CTA) | `#D9480F` (verify ≥ 4.5:1 on paper for text; use darker if needed) |
| `--ok` | `#3BD68F` "Running" / ready (status only) | `#1F8A5B` |

- **Rule:** one accent family. Orange marks active and focus states, green is used only for status. No blue K8s cliché, no neon glow, no gradients on text.
- **Dark default:** keep `next-themes` with system preference respected. `SITE.themeColor` becomes `{ light: "#F5F3EE", dark: "#0E0F11" }`.

### Type (via `next/font/google`, self-hosted, `display: swap`, Latin subset)
- **Display and UI: Geist.** Display 600 at `clamp(44px, 7vw, 104px)`, tracking −0.035em, line-height 0.95. Body 400 at 17/28.
- **Mono: Geist Mono.** Kickers, the proof ticker, captions and dates, at 12–13px uppercase, tracking 0.14em, `tabular-nums`.
- **Accent: Instrument Serif Italic.** Exactly one clause per headline, never body copy.
- Remove Inter.

### Layout
- 12-column grid, max-width 1280px, gutters 16px (mobile) and 32px (desktop). Sections separated by 1px hairlines.
- **Desktop ≥ 1024px home:** content scrolls in the left 7/12. The right 5/12 is a sticky "cluster monitor" panel: top 96px, height `calc(100vh − 128px)`, 1px hairline frame, with a mono caption bar under it (see §4). It must never overlap text; test 1024–1280px.
- **Below 1024px:** the monitor is an aspect-[16/10] band under the hero only. Phones get the SVG poster; the canvas loads only when the gate passes.

### Motion
- **Durations:** hover 160ms, UI 240ms, reveal 420ms, camera 900–1400ms.
- **Easing:** reveal `cubic-bezier(0.22,1,0.36,1)`, camera `cubic-bezier(0.65,0,0.35,1)`.
- **Reveals:** CSS-first (`animation-timeline: view()` inside `@supports`, otherwise IntersectionObserver adding a class), gated by `html.js` + `prefers-reduced-motion: no-preference`.
- **framer-motion:** remove where CSS suffices. If kept, use `LazyMotion` + `m` + `domAnimation` only.
- **Remove:**
  - the SVG `feTurbulence` noise overlay
  - letter-by-letter h1 animation
  - magnetic and tilt effects on large areas (a small magnetic CTA is fine if it costs < 1KB and is skipped under reduced motion)
  - the scroll-progress bar, if it costs main-thread time

## 3. Information architecture and copy (all server-rendered from real data)

### Header (every page)
- **Wordmark:** `raish.momin` in mono, linking to `/`.
- **Nav (real `<a>`):** Work (`/#work`, or `/projects` on subpages), Experience, Services, Blog, About, Contact.
- **Controls:** theme toggle and 3D toggle (`aria-pressed`, persisted in localStorage inside try/catch; it also disables reveal animations).
- **Active state:** `aria-current` via one IntersectionObserver scroll-spy on home, or by pathname on subpages. The active nav item gets an orange 1px rule that grows 16→40px.
- **Command palette (⌘K, Ctrl+K or "/"):** pages, featured projects, latest posts, copy email, toggle 3D, toggle theme. Lazy-loaded on first use; the trigger is a real `<button>`. Priority P2: build it only if everything else is green.

### Home `/`, in order

1. **Hero** (left 7/12; the monitor shows the `hero` formation)
   - Mono eyebrow: `FULL STACK DEVELOPER · DEVOPS ENGINEER`
   - **h1:** `Raish Momin`, followed by a visually smaller second line in the same h1: `Full-Stack & DevOps Engineer`. Plain text, no per-letter spans.
   - Display `<p>`: "I build web products — *and the pipelines that ship them.*" (italic clause in Instrument Serif)
   - Intro `<p>`: a real `main_desc` from the DB, normalized (years from `experienceLabel()`, location from profile)
   - Status line: `● Open to senior full-stack / DevOps roles and freelance` (green dot; pulse disabled under reduced motion)
   - Mono proof ticker, server-rendered from data: `5+ yrs · 21 shipped projects · Next.js · Node · MongoDB/Postgres · Docker · Kubernetes · AWS` (counts and skills computed, never typed)
   - CTAs (≥ 44px tall):
     - primary "Email me" (`mailto:` from PROFILE)
     - ghost "Copy email" (tiny island; shows "Copied ✓" with `aria-live="polite"`)
     - ghost "Résumé ↗" (DB `resume_link`)
   - Meta line: `Ahmedabad, IN · IST (UTC+5:30)`. The server renders the label; a tiny island adds HH:MM with no layout shift (fixed-width `tabular-nums` slot).
2. **#about** — kicker `01 · about`. Short bio from the DB, plus 3 server-rendered stat items (years, projects shipped, technologies) computed from data. No count-up from 0 in the HTML.
3. **#stack** — kicker `02 · stack`. A "stack map" replaces percentage bars: groups Frontend / Backend / Data / DevOps (existing FILTERS ids). Each item shows "used in N projects", computed from `projects[].technologies` (omit the count when it is 0). Monitor formation: `stack`.
4. **#experience** — kicker `03 · experience`. A timeline where each row has:
   - a mono date column (`DEC 2022 — FEB 2024`)
   - `Role · Company`
   - real description bullets, with real numbers from the DB bolded (never invented)

   Monitor formation: `experience`.
5. **#work** — kicker `04 · work`.
   - Six featured case-study cards (DB order, first 6), each with:
     - a mono kicker (domain · stack)
     - the title
     - a one-line description
     - tech pills
     - Live ↗ (if present) and a link to its anchor on `/projects`
   - Then a **numbered archive index** `<ol>` of the rest: number, title, category, stack, ↗.
   - Hovering or focusing a row dims its siblings to 0.45 with CSS `:has()` and nudges the arrow 2px.
   - Hovering or focusing a featured card sets `focusProject` in the scene store.

   Monitor formation: `work`.
6. **#services** teaser — the 4 services from `app/lib/services.ts` as linked rows to `/services/<slug>` (internal links for SEO).
7. **#writing** — the 4 latest non-redirected posts (title, date, read time) linking to `/blog/<slug>`, plus "All posts →".
8. **#faq** — 5 concise, quotable Q&As from `app/lib/faqs.ts`, visible in the DOM (`<details>` is fine). Keep the FAQPage JSON-LD in sync.
9. **#contact** — "Have a product to ship? *Let's talk.*" Email, copy email, availability, timezone and socials (from PROFILE), plus the existing contact form (client island). Monitor formation: `contact`.

Footer: wordmark, page links (every PAGES entry), socials, RSS link, the "Built with Next.js · React Three Fiber" line, and ©.

### Subpages
`/about`, `/projects`, `/skills`, `/experience`, `/contact`, `/services`, `/services/[slug]`, `/blog`, `/blog/[slug]`.

- **Same design system:** header, footer, type, hairlines, kickers.
- **h1:** each page has a real one: the page title, with the existing heading text where SEO depends on it. Keep each page's existing metadata and JSON-LD untouched unless fixing a bug.
- **No canvas:** subpages show a small static SVG cluster motif from the poster renderer (decorative, `aria-hidden`).
- **`/projects`:** every project with an `id` anchor (so home cards can link to `/projects#<slug>`), the filter chips as a client island, and all project text in the HTML even when filtered (filtering hides with the `hidden` attribute and never removes content from the server HTML).
- **Blog post:** readable measure (68ch), Geist body 18/30, code blocks styled with mono on `--panel`, plus the existing TOC and author bio.

## 4. The 3D layer — Cluster Monitor

**Module:** `components/cluster/` (owned by the 3D engineer).

### Files

| File | Kind | Purpose |
|---|---|---|
| `formations.ts` | pure TS, no three import, shared by server and client | Builds per-section target positions (Float32Array, xyz per instance) and status colours from real data |
| `poster.tsx` | Server Component | Draws an isometric SVG of a formation, about 200 three-tone hex-face paths, for the poster and subpage motifs |
| `store.ts` | vanilla `zustand/vanilla` `createStore` | `{ section, focusProject, focusGroup, enabled }`, read in `useFrame` via `getState()` with no React re-renders |
| `cluster-monitor.tsx` | `'use client'` island | Layout box, poster underlay, capability gate, idle mount, in-view gating, 3D toggle wiring, mono caption bar |
| `scene.tsx` | lazy | The R3F `<Canvas>` and scene |
| `section-spy.tsx` | `'use client'` | One IntersectionObserver (rootMargin `-45% 0px -50% 0px`) over `[data-section]` elements. Writes `store.section` and sets `aria-current` on the matching nav link |

**`formations.ts` signature:**
```ts
type FormationData = {
  skills: { group: 'frontend'|'backend'|'database'|'devops'; count: number }[];
  experience: { company: string; months: number }[];
  projects: { slug: string; techCount: number }[];
};
buildFormations(data: FormationData, count: number): Record<FormationKey, { positions: Float32Array; status: Uint8Array }>
```
`FormationKey` is `'hero' | 'about' | 'stack' | 'experience' | 'work' | 'contact'`.

### Formations (derived, never hand-typed)
| Formation | Layout |
|---|---|
| `hero` | 3 node slabs of 8×8 cells, node-3 half full ("capacity available") |
| `about` | Same as hero, camera eased closer |
| `stack` | 4 clusters sized by the skill count of each group |
| `experience` | One timeline segment per company, length proportional to months worked |
| `work` | One column per featured project, height = its tech count |
| `contact` | Every pod converges into one ring that pulses green once |

### Scene
- **Camera and canvas:** `<Canvas orthographic camera={{ position:[12,10,12], zoom:56 }} dpr={[1,1.5]} frameloop="demand" gl={{ antialias:false, powerPreference:'low-power', alpha:true }}>`. Mobile preset zoom is about 44.
- **Pods:** one `instancedMesh` of `RoundedBoxGeometry(0.8,0.8,0.8,2,0.12)` (three-stdlib) with 200 instances (120 when `hardwareConcurrency ≤ 6` or the viewport is < 1280px), and `instanceColor` for status.
- **Material:** `MeshMatcapMaterial` with a matcap generated at runtime on a 256px `CanvasTexture`, so there are no network assets. The alternative is `MeshStandardMaterial` with one hemisphere light and one directional light, with no shadows either way.
- **Grounding:** drei `<ContactShadows frames={1}>` baked once and re-baked on theme change, or a static radial-gradient plane.
- **Motion:**
  - Every instance damps toward its formation target with `maath/easing.damp3` (λ ≈ 0.18) plus a 6ms per-index stagger.
  - `instanceMatrix.needsUpdate` is set, and `invalidate()` is called only while any delta exceeds 0.001, so the GPU idles once settled.
  - ±0.5 pointer parallax on `pointer: fine`.
  - Idle "reschedule" every ~2.4s: a few pods hop with status colours going orange (Pending) then green (Running). This is off under reduced motion, which never mounts anyway.
- **Theme:** colours are read from CSS variables on mount and on theme change.
- **Resilience:**
  - `<PerformanceMonitor onDecline={() => setDpr(1)} onFallback={showPoster}>`
  - `webglcontextlost` shows the poster
  - `frameloop` goes to `"never"` when offscreen or hidden
  - everything is disposed on unmount
- **Caption bar (DOM, `aria-hidden`):** the server renders the default `kubectl get pods -A · 200/200 Running`. The island updates the text per section, e.g. `kubectl get pods -l section=work · 6 deployments`.
- **Interaction:** hovering or focusing a DOM project card raises its column by 0.3 and tints it orange. Hovering a stack group lifts its cluster. The DOM "Reschedule" button in the caption bar scatters and regroups the pods.

## 5. Ownership and order (build workflow)

| Order | Agent | Owns |
|---|---|---|
| 1 | **UI-1** (design system and home) | `app/globals.css`, `tailwind.config.js`, `app/layout.tsx` (fonts, `html.js` script, header/footer mount), the header, footer and section components, the home `app/page.tsx` composition, `components/ui/*` primitives. Leaves a `<ClusterMonitor …/>` slot using the contract in §4 (a temporary poster-only stub is fine) |
| 2 | **3D engineer** | `components/cluster/*`, three/R3F/drei/maath deps, wiring the monitor into the slot |
| 3 | **UI-2** (subpages) | Every subpage and its components on the new system; blog and services styling |
| 4 | **SEO/GEO guardrail engineer** | Re-runs the rulebook. Fixes any redesign regressions (metadata, h1, JSON-LD sync with the new visible FAQ/services/writing, internal links, llms facts) |
| 5 | **Verification panel** | 5 independent lenses: crawler/SEO parity, performance/CWV, accessibility + no-JS + reduced motion, visual design vs this spec (screenshots), code health. A fixer loop runs until there are no blocker or major findings |

## 6. Done means
- Every §1 rule and every `seo-audit.md` §9 check is green. `tsc`, `lint` and `build` are clean.
- Lighthouse thresholds are met (median of 3 runs on an idle machine).
- Screenshots of desktop 1440 and mobile 390, dark and light, home and 3 subpages, match this spec. With the 3D on, it renders a real WebGL scene (verified with `getContext('webgl2')`, never `--use-gl=swiftshader`).
- With reduced motion, JS off, or the 3D toggle off, the poster appears and every word is still there.
