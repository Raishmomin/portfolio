# 3D Portfolio Redesign — Plan (awaiting approval)

Source of inspiration: https://github.com/emmabostian/developer-portfolios
Rule: borrow patterns, never clone any single portfolio's design, copy, or assets.

## Phase 0 — Prep (lead)
- [ ] Commit current WIP on main (19 files) or move it to its own branch
- [ ] Create branch `redesign-3d`
- [ ] Upgrade Next 14.0.0 -> latest 14.2.x (security patches); keep React 18
- [ ] Baseline snapshot of current site: Lighthouse, page HTML with JS off, JSON-LD, sitemap, all URLs

## Phase 1 — Research (4 agents, parallel)
- [ ] Scout: parse README, scan every link (alive, three.js/R3F/WebGL/GSAP/Spline, meta/JSON-LD) -> ranked shortlist of ~40
- [ ] Design analyst A: open shortlist 1-20 in a real browser, screenshots, record hero/nav/3D/motion/layout patterns
- [ ] Design analyst B: same for shortlist 21-40
- [ ] SEO/GEO auditor: audit current site + best-practice gaps -> non-negotiable checklist

## Gate 1 — Design spec (lead -> user approval)
- [ ] Synthesize findings -> `tasks/design-spec.md` (3D concept, palette, type, motion, section-by-section layout, perf budget)
- [ ] User approves spec before any build work

## Phase 2 — Build (3 agents, strict file ownership)
- [ ] 3D/motion engineer: R3F scene + scroll motion, lazy-loaded, reduced-motion + low-end/mobile fallback
- [ ] UI engineer: redesign all sections/pages on top of existing content
- [ ] SEO/GEO engineer: keep + upgrade metadata, JSON-LD, llms.txt, sitemap, robots, OG images

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
