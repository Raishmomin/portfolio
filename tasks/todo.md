# 3D Portfolio Redesign — Plan (approved: 8 agents, commit WIP, upgrade to latest)

Source of inspiration: https://github.com/emmabostian/developer-portfolios
Rule: borrow patterns, never clone any single portfolio's design, copy, or assets.

## Phase 0 — Prep (lead)
- [x] Create branch `redesign-3d`, commit WIP (dee9f64)
- [x] Baseline snapshot of current site (68 URLs 200, HTML, JSON-LD, sitemap, robots, llms.txt, Lighthouse)
- [x] Upgrade Next 14.0.0 -> 16.4.5, React 18 -> 19.3.1, ESLint 9 flat config
  - [x] async `params` in 5 dynamic routes; `revalidateTag(tag, { expire: 0 })`
  - [x] drop deprecated edge runtime on OG/Twitter/apple icons (now static)
  - [x] build + typecheck clean; all 68 URLs 200; titles/descriptions/canonicals/JSON-LD identical (home canonical drops trailing slash — equivalent URL)
  - [ ] Lighthouse A/B baseline vs upgrade on an idle machine (first run invalid: machine under capture load)
  - [ ] 10 pre-existing lint errors from stricter React 19 rules (navbar, projects, count-up, any-types) — fix during build phase

## Phase 1 — Research (4 agents, parallel)
- [x] Scan all 2,095 README entries: 1,877 alive, 103 three.js, 106 WebGL, 204 GSAP, 159 Lenis, 756 with basic SEO
- [x] Scout: curate (alive, three.js/R3F/WebGL/GSAP/Spline, meta/JSON-LD) -> ranked shortlist of ~40
- [x] Design analyst A (immersive 3D, 20 sites): patterns, anti-patterns, 3 concepts — recommends 'Control Plane'
- [x] Design analyst B (crafted, 20 sites): IA/copy/motion skeleton, 3 concepts — recommends 'Scheduler' (same idea)
- [x] SEO/GEO auditor: 4 P0 / 8 P1 / 10 P2 gaps, guardrails, QA checklist (scratchpad data/seo-audit.md, checker data/seo_check.py)

## Owner decisions (2026-11-05)
- Email: rjmomin.rj@gmail.com · LinkedIn: /in/raish-momin-ba8927253 (no UTM) · X: @RWankanery · GitHub: Raishmomin
- Years derived from career start Sept 2021 ("5+"); location "Ahmedabad, Gujarat, India"
- Blog: pause auto-gen cron + consolidate near-duplicates with 301s — code-only, no MongoDB writes
- AI crawlers (search + training) explicitly allowed
- Headshot: not provided yet -> Person.image stays OG card (TODO)

## Phase 1.5 — SEO/GEO foundation (design-independent, started early)
- [x] app/lib/profile.ts single source of identity facts; config.ts reads it
- [x] Impl A: server-render all content (kill client /api/skils fetch, loader, "0 +" stats)
- [ ] Impl B: JSON-LD escaping + Person/ProfilePage, robots AI groups, per-route OG, RSS alternates, services schema, experience dates, sitemap lastmod, llms.txt + llms-full route, skip link, manifest icons
- [ ] Impl C: pause cron, cluster + 301 duplicate posts, exclude from sitemap/RSS/llms, sanitize markdown, one h1 per post
- [ ] 4-lens verification panel + fix loop until no blocker/major

## Gate 1 — Design spec (lead -> user approval)
- [x] Synthesize findings -> `tasks/design-spec.md` — concept "Control Plane" (K8s scheduler pods from real data)
- [x] User said "yes start" — build proceeds straight after foundation (no approval stop)

## Phase 2 — Build (PARALLEL: 4 lanes in git worktrees, user-approved for speed)
- [x] Foundation verified (3 rounds) + checkpoint commit 57c8d76 (local, not pushed)
- [x] Lead pre-built shared pieces: palette tokens, Geist/Geist Mono/Instrument Serif, components/ui/primitives.tsx, cluster contract (types, toFormationData, stub API), slugify
- [x] lane-ui: header/footer shell + home page (wt-ui)
- [x] lane-3d: Cluster Monitor R3F module + SVG poster (wt-3d)
- [x] lane-pages-a: /about /skills /experience /contact (wt-pages-a)
- [x] lane-pages-b: /projects /services /blog /404 (wt-pages-b)
- [x] Lead merges lanes -> redesign-3d, build
- [x] Parallel verification (crawler/SEO, perf/CWV, a11y+no-JS+reduced-motion, visual vs spec, code health) + 2 parallel fixers (fix-3d, fix-ui), merged into redesign-3d

## Recovery after reboot (2026-11-06)
- [x] Branches intact (integration b84fcc4); rulebook + checker recovered from agent transcripts -> tasks/seo-audit.md, tasks/qa/seo_check.py
- [x] Worktrees, tools, baseline snapshot (68 × 200) rebuilt; verification panel relaunched

## Phase 3 — QA (1 agent + lead)
- [ ] build, lint, typecheck clean
- [ ] Playwright screenshots desktop + mobile, light + dark
- [ ] Lighthouse >= 95 perf/SEO/a11y/best-practices; LCP < 2.5s, CLS < 0.1, INP < 200ms
- [ ] Every baseline URL still 200, content present in HTML with JS disabled
- [ ] JSON-LD valid; sitemap/robots/llms.txt correct
- [ ] Diff vs baseline snapshot

## Gate 2 — User review on localhost before any commit/push

## SEO / GEO non-negotiables (checked at every phase)
- No URL removed or renamed without a 301
- All text content server-rendered; 3D canvas is decoration only (dynamic import, ssr:false), never holds content
- 3D must not be the LCP element and must not block first paint
- Per-page title/description/canonical/OG/Twitter kept (app/lib/seo.ts)
- JSON-LD kept: Person, WebSite, BreadcrumbList, FAQPage, Service; add ProfilePage
- GEO: llms.txt + llms-full.txt updated, explicit allow for GPTBot/ClaudeBot/PerplexityBot/Google-Extended, quotable facts + FAQ blocks
- Keep public/google797364b8fd6f1221.html (Search Console verification)
- Semantic HTML, one h1 per page, alt text, keyboard nav, prefers-reduced-motion

## Review (2026-11-06)
Branch `redesign-3d` (local, not pushed) = verified integration build + docs. tsc, eslint, build clean; indexable routes static/ISR.

| Check | Original (dee9f64) | Redesign |
|---|---|---|
| Old URLs | 68 × 200 | 68 OK (29 × 200, 39 duplicate posts 301 -> canonical 200) |
| seo_check, 7 user agents (incl. GPTBot/ClaudeBot/PerplexityBot) | 38/68 pages with hard failures | 0 hard failures on all 24 live pages |
| Words visible to non-JS crawlers | / 275, /projects 88, /skills 73, /experience 64 | / 1500, /projects 2777, /skills 382, /experience 337 |
| Lighthouse mobile median (perf / LCP / CLS / TBT), home | 90 / 3.0s / ≤0.137 / 200ms | 97 / 2.2s / 0 / 140ms |
| /projects | 88 / 3.0s / 0.142 / 140ms | 93 / 2.1s / 0 / 290ms (TBT up: 21 projects now server-rendered in full) |
| /services/nextjs-development | 96 / 2.3s / 0 / 170ms | 97 / 2.0s / 0.013 / 150ms |
| Blog post | 89 / 2.5s / 0 / 320ms | 96 / 2.1s / 0 / 200ms |
| Lighthouse a11y / BP / SEO | 96–100 / 100 / 100 | 100 / 100 / 100 everywhere; axe: 0 violations in 60 runs |
| Initial JS gzip | / 165 KB, subpages 153–157 KB | / 145 KB, subpages 138 KB (3D chunk 254 KB lazy, capable devices only) |

Open / owner follow-ups:
- [x] Headshot: studio-retouched photo in public/images, Person ImageObject, OG/Twitter card (author bio + home/about placement after the neural lanes merge)
- [ ] Review/rewrite the 12 remaining AI-written blog posts (some technically wrong); cron is paused (BLOG_AUTOGEN_ENABLED)
- [ ] Confirm Cybersurf role title (DB vs description mismatch flagged by verifiers)
- [ ] Phone number is now server-rendered on /contact (was client-only before) — keep or remove
- [ ] /projects TBT 290ms: consider collapsing feature lists or paginating
- [ ] Budgets re-baselined: subpage JS 138 KB vs 130 KB target (framework floor ~136 KB on Next 16/React 19); 3D chunk 254 KB vs 250 KB spec (rulebook 300 KB)
- [ ] After deploy: Search Console + Bing Webmaster sitemap resubmit, Rich Results test, watch field CWV for 28 days
- [ ] ⌘K command palette (P2) not built


## Phase 4 — Neural redesign (owner feedback 2026-11-06: make it understandable, AI-themed, fully animated)
- [x] Contract (components/neural/types.ts, neural-data.ts), stubs, spec (tasks/neural-spec.md) — commit 48e4abe
- [x] 6 parallel lanes: engine+hero, scenes-a (stack, experience), scenes-b (ai, work, contact), motion (GSAP scroll system), home, pages
- [x] Merge lanes -> delete components/cluster -> build (redesign-3d d64d5a9)
- [x] Verify on owner-like hardware (4 threads, real GPU, no spoofing): scenes switch per section, 1 canvas, 0 errors
- [x] SEO: 68 old URLs OK, 0 hard failures for default/Googlebot/GPTBot/ClaudeBot/PerplexityBot, 1 h1, facts + headshot ImageObject in HTML
- [x] Fixes found in QA: scenes framed in the free right side on desktop; software WebGL rejected (lab TBT 6.6 s -> 0.3-0.55 s)
- [ ] Follow-up: home lab perf 85-91 (was 97 before the full-animation rebuild) — HTML parse + hydration of the bigger page; trim if needed
- [ ] Follow-up: experience label for the current role clips at the right edge on 1440px
- [x] Photo placed: hero avatar, /about portrait card, blog author avatar
- [ ] Owner: add the AI tutor (live speaking) project to MongoDB `projects` (category ["AI"], technologies incl. speech/TTS) — it appears in the AI section automatically

## Phase 5 — Full-motion redesign (owner feedback 2026-11-06: "animation only one side", "design not match", "animate the content cards")
Spec: tasks/fullmotion-spec.md (diagnosis from a Playwright audit, art direction, lane contract)
- [x] Playwright audit of every home section + page (desktop, mobile) -> 7 issues
- [x] Research (2 agents): visual 3D/motion patterns; technical recipes + root causes (scratchpad data/fm/research-*.md)
- [x] Build (3 senior 3D/motion designer lanes): fm-stage (full-bleed data-stage framing, ambient scene, label occlusion, multi-page stage), fm-home (card motion system: data-card/-group/deck/hscroll/spotlight/draw/marquee; varied home compositions; dev-error fix), fm-pages (all subpages on the same language + stage + card motion)
- [x] QA automation agent: tools/fm-tour.cjs (checks a-k)
- [x] 2 integration designers (home, pages) + lead fix (tall cards stayed invisible: pose pivots on top edge)
- [x] Merged -> redesign-3d 8b30c47 (fast-forward)

### Review (2026-11-06)
- fm-tour full run on the production build: a-k all PASS (0 errors; 1 canvas; no two neighbouring sections share a composition; scene matches every centred section; 0 labels over text/clipped; cards animate and land visible; motion-off/reduced-motion static; no mobile overflow; anchors; light theme).
- fps while scrolling each home section (1440, real GPU): 53-60, quality high, canvas kept. The tour's mid-page poster fallback only happens under heavy machine load (load avg 7-8, swapping); the frame monitor now needs 4 slow seconds in a row at low quality.
- SEO: 63/63 old paths reach 200; 1 h1 per page; seo_check default + GPTBot 0 hard failures on / and 12 subpaths; routes still static/ISR; JSON-LD unchanged.
- Initial JS +4.1 KB home / +3.9 KB subpages; GSAP 44.7 KB + motion runtime 6.3 KB (lazy); 3D chunk ~278 KB gzip (lazy).
- [ ] Lighthouse home on an IDLE machine (under load: median 79, one run at load 3.7 scored 95; a11y/bp/seo 100)
- [ ] Polish: work scene mostly hidden behind the dense 3-column grid; contact scene hidden behind the full-width form until the end
- [ ] Polish: tall-card IntersectionObserver should ideally test the layout box (pose fix covers today's cards)

## Phase 6 — Owner feedback round 2 (2026-11-06/07)
Asked: no "Want a 3D site?" question, remove the photo, no 3D button (motion for everyone), better hero, per-project tech-stack animation for ALL projects, experience 3D was hidden behind cards.
- [x] Lead: photo removed everywhere (hero, /about, author box, OG card -> neural SVG, Person.image -> OG card; files deleted); 3D toggle removed, html[data-motion]=on for everyone (cp:3d=off = hidden QA switch); 3D-site question section removed
- [x] fm2-hero: 3D brain of ~9.4k particle-neurons (intro assembly, cursor focus, scroll-out stream), 3 draw calls, ~60 fps @1920x915; matching SVG poster
- [x] fm2-work: every one of 21 projects gets its own architecture from its real stack (client/server/data/infra/AI tiers, morphing between projects); zig-zag Work section around a clear scene window; /projects cards drive it; 60 fps
- [x] fm2-exp: career path above the cards, milestones on the rail dots (<=0.3px settled), clean track edges, measured band framing for every band section; /experience + /about too
- [x] Reboot wiped /tmp mid-phase: recovered tools/research from transcripts into tasks/qa + tasks/research; lanes moved to /home/raish/raish/.my-app-lanes; WIP commits every 15 min
- [x] Integration (fm2-int -> redesign-3d 3b32de8): fm-tour a-k all PASS; 23/23 sitemap URLs 200; 39/39 old blog URLs 301 -> 200; 1 h1 per page; 0 photo refs; owner-viewport frames (1536x732 @1.25) reviewed
- [ ] Lighthouse on an idle machine
