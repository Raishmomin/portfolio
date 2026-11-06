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
- [ ] Parallel verification (crawler/SEO, perf/CWV, a11y+no-JS+reduced-motion, visual vs spec, code health) + fixer

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

## Review
_(filled in after QA)_
