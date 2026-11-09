# SEO/GEO Audit + Redesign Rulebook — raish-momin.vercel.app

Audited: repo commit `dee9f64` (Next 14.0.0 / React 18) + baseline production build (`baseline/`, 68 URLs, Lighthouse 12.8.2 mobile simulated).
Target of redesign: Next 16.4.x / React 19.3 + React Three Fiber, branch `redesign-3d`.
Date: 2026-11-05. Author role: SEO/GEO auditor. **This file is the rulebook for builders and QA.**

Companion tool: `/tmp/claude-1000/-home-raish-raish-my-app/ffd02af8-1b89-4a04-a12d-8deb02a3d03d/scratchpad/data/seo_check.py` (stdlib-only checker, see section 9).

---

## 0. TL;DR — the 10 things that matter most

1. **The home page is almost empty to crawlers today.** Bio, years, skills, experience and projects are fetched in the browser from `POST /api/skils`, and `robots.txt` disallows `/api/`. Google can't fetch that endpoint while rendering, and AI crawlers (GPTBot, ClaudeBot, PerplexityBot) don't run JS at all. Server HTML for `/` has 275 words and says "0 + Years experience". `/projects` has 88 words, `/skills` 73 and `/experience` 64, yet their JSON-LD lists 13 projects, 32 skills and 3 roles that are **not visible**. **P0: render all content on the server.**
2. **The home page's LCP of 3.9s and CLS of 0.135 have one root cause.** The LCP element is the hero `<p>` (`main_desc`). It is empty in the server HTML and fills after the client fetch, so render delay is 3,423 ms (88% of LCP), and the hero block shifts by 0.134 when the text arrives. On top of that, a full-screen `BrandLoader` covers the page for 1.6s and 37 elements are server-rendered at `opacity:0`.
3. **TBT of 1.7s comes from the whole home tree being one client component** (`mainComponent.tsx` is `"use client"`), plus framer-motion everywhere, a fixed full-viewport SVG `feTurbulence` noise overlay with `mix-blend-mode`, and scroll-linked transforms. The 3D layer must fit into a budget that **this redesign first frees up**.
4. **JSON-LD is not escaped.** One blog post's JSON-LD is invalid because `articleBody` contains `</script>` from a code sample, and 37 pages carry a raw `<` in JSON-LD. This is also an XSS vector, because the blog content is LLM-generated. Fix it with `.replace(/</g, '\\u003c')` and drop `articleBody`.
5. **Entity facts conflict, which hurts entity SEO and GEO:**
   - Email: the placeholder `raishmomin@example.com` appears in llms.txt, RSS and the AuthorBio `mailto:` on all 51 posts.
   - LinkedIn: two different profile URLs, one with UTM tracking parameters in `sameAs`.
   - Years: "4+" in one place and "5+" in another.
   - Location: misspelled as "Ahemadabad".
   - Stack: copy still says "Next.js 14 / React 18" after the upgrade.

   Create one source of truth for these facts.
6. **robots.txt has only a `*` group.** Add explicit Allow groups for OAI-SearchBot, GPTBot, ChatGPT-User, ClaudeBot, Claude-SearchBot, Claude-User, PerplexityBot, Perplexity-User, Google-Extended, Applebot-Extended, Bingbot and Applebot. Each group must repeat `Disallow: /api/`.
7. **ProfilePage already exists on `/`, but it is thin.** It duplicates the WebPage node, has no `dateCreated`/`dateModified`, and Person `image` is the generated OG card rather than a photo. Upgrade it per Google's ProfilePage spec.
8. **Per-route OG images are generated but never used.** `buildMetadata` hard-codes `/opengraph-image`, so every blog post and service shares the home card.
9. **Blog quality risk (owner decision).** A cron job auto-generates posts with Llama 3.1 8B. 35 of 51 posts are variants of "Optimizing Next.js 14 Server Components with Edge Runtime for XX% Reduced Initial Payload Size" with invented percentages. This matches Google's *scaled content abuse* example and conflicts with E-E-A-T. Pause the cron and consolidate the variants with 301s. Never delete URLs.
10. **Next 16 streams metadata on dynamically rendered pages** to user agents outside `htmlLimitedBots`, and the default list does **not** include GPTBot, ClaudeBot or PerplexityBot. Keep every indexable page static/ISR, and verify `<title>` is inside `<head>` when fetched with AI-bot user agents.

---

## 1. Baseline numbers (what we must not regress)

| Metric | `/` | `/about` | `/projects` | `/blog` |
|---|---|---|---|---|
| Lighthouse perf (mobile) | **55** | 91 | 87 | 93 |
| SEO / A11y / BP | 100 / 100 / 100 | 100 / 98 / 100 | 100 / 96 / 100 | 100 / 98 / 100 |
| LCP | **3.9 s** (render delay 3,423 ms) | 3.0 s (render delay 2,541 ms) | 3.0 s (2,514 ms) | 2.1 s |
| CLS | **0.135** | 0.002 | 0 | 0 |
| TBT | **1,720 ms** | 200 ms | 350 ms | 290 ms |
| LCP element | hero `p.mt-10` (main_desc, client-fetched) | about `p` (opacity-0 reveal) | section intro `p` | first card `h2` |
| Visible words in server HTML | 275 | 420 | 88 | 2,842 |

Other baseline facts:
- **URLs:** 68 return 200. That is 63 sitemap URLs (8 static pages, 4 services, 51 blog posts) plus `/feed.xml`, `/manifest.webmanifest`, `/opengraph-image`, `/google797364b8fd6f1221.html` and `/llms-full.txt`. `/llms.txt`, `/robots.txt` and `/sitemap.xml` also return 200.
- **Home main thread:** 7.6 s total (Script Evaluation 2.9 s, Other 2.2 s, Style & Layout 1.8 s). JS bootup is 2.9 s, with the largest chunks `307-*.js` (2.1 s total) and `472-*.js` (1.2 s). The `/api/skils` response is 25 KB and finishes at about 1.2 s.
- **`seo_check.py --dir baseline/html`:** 38 of 68 entries have hard failures. 37 pages have a raw `<` in JSON-LD, 1 has invalid JSON-LD, and 12 blog posts have 2–5 `<h1>` tags.

### Comparison with 1,877 live developer portfolios (scan.json, status 200)
| Signal | All portfolios | 3D/WebGL portfolios (n=175) | This site today |
|---|---|---|---|
| meta description | 82.2% | 78.9% | yes (all pages) |
| og:image | 57.3% | 53.7% | yes |
| canonical | 45.2% | 42.9% | yes (self-referencing) |
| any JSON-LD | 36.5% | 36.6% | yes (Person, WebSite, ProfilePage, BreadcrumbList, FAQPage, Service, BlogPosting, ItemList) |
| Person JSON-LD | 34.6% | — | yes |
| ProfilePage JSON-LD | 7.4% | — | yes (thin) |
| all four (desc + og + canonical + JSON-LD) | 30.5% | — | yes |
| exactly one `<h1>` | 54.3% | 41.1% | 51/63 pages (12 blog posts fail) |
| near-empty server HTML (<500 text chars) | 34.8% | **50.9%** | **home/projects/skills/experience are effectively empty of real content** |
| median visible text chars | 1,950 | **388** | — |
| median JS bytes sampled | 462 KB | **909 KB** | 266 KB total transfer (home) |

**Takeaway:** the typical 3D portfolio ships about twice the JS of a typical portfolio and half of them ship near-empty HTML. Only 29 of 175 3D portfolios had ≥1,500 text chars plus description, canonical and JSON-LD together. The opportunity is to be in that group: a 3D look with full server-rendered text.

---

## 2. Inventory: SEO/GEO assets that exist today (KEEP — must survive the redesign)

| Asset | File(s) | What it does / state |
|---|---|---|
| Root metadata | `app/layout.tsx` | `metadataBase`, title template `%s \| Raish Momin`, default OG/Twitter, robots meta (`max-image-preview: large`, `max-snippet: -1`), `alternates.types` RSS, `verification.google` from env `GOOGLE_SITE_VERIFICATION` (rendered as `<meta name="google-site-verification" content="u7N0PqMr…">`), icons, viewport themeColor, `<html lang="en">`, skip link |
| Metadata builder | `app/lib/seo.ts` | `buildMetadata()` (title, description, keywords, canonical, OG, Twitter, article times/tags), `breadcrumbList()`, `webPageSchema()`, `faqPageSchema()`, `serviceSchema()` |
| Site facts | `app/lib/config.ts` | `SITE_URL`, `SITE` (name, title, description, jobTitle, email, twitter, github, linkedin, locale, themeColor), `NAV_SECTIONS`, `PAGES` |
| FAQs | `app/lib/faqs.ts` | 8 FAQs on `/about`, 5 on `/contact`, rendered visibly by `components/faq-section.tsx` (`<details>`, h3 questions) and as FAQPage |
| Services content | `app/lib/services.ts`, `components/service-page.tsx`, `app/services/page.tsx`, `app/services/[slug]/page.tsx` | 4 service landing pages (~1,000–1,130 words each, server-rendered), Service + FAQPage + BreadcrumbList |
| Internal linking | `app/lib/internal-links.ts` (autolink up to 2 links per rule into blog prose), `components/author-bio.tsx`, `components/related-posts.tsx`, footer `PAGES` sitemap nav, service pages → related posts | |
| Person + WebSite JSON-LD | `components/json-ld.tsx` (in layout, every page) | Person `@id https://raish-momin.vercel.app#person` (name, jobTitle, description, email, address, sameAs, knowsAbout), WebSite `#website` (+ SearchAction) |
| Page JSON-LD | `components/page-json-ld.tsx` + each `page.tsx` | `/`: WebPage + ProfilePage + BreadcrumbList; `/about`: AboutPage + FAQPage; `/contact`: ContactPage + FAQPage; `/projects`: CollectionPage + ItemList(CreativeWork ×13); `/skills`: WebPage + ItemList(DefinedTerm ×32); `/experience`: CollectionPage + ItemList(OrganizationRole ×3); `/services`: CollectionPage + ItemList(Service ×4); `/services/*`: Service ×2 + FAQPage; `/blog`: Blog (10 BlogPosting); `/blog/*`: BlogPosting/Article |
| Blog | `app/blog/page.tsx`, `app/blog/[slug]/page.tsx` (`generateStaticParams`, `generateMetadata`, ISR 3600, TOC, author bio, related posts), `components/toc.tsx` | 51 posts, all 200 |
| Sitemap | `app/sitemap.ts` (single sitemap; **there is no `app/sitemaps/` directory at dee9f64**) | 8 static + 4 service + 51 blog URLs, revalidate 3600 |
| Robots | `app/robots.ts` | `User-Agent: *` Allow `/`, Disallow `/api/`, `Host`, `Sitemap` |
| RSS | `app/feed.xml/route.ts` | RSS 2.0, 50 latest posts, atom self link |
| Manifest | `app/manifest.ts` | name, short_name, colors, icons |
| OG/Twitter/icon images | `app/opengraph-image.tsx`, `app/twitter-image.tsx`, `app/apple-icon.tsx`, `app/icon.svg`, `app/favicon.ico`, `app/blog/[slug]/opengraph-image.tsx`, `app/services/[slug]/opengraph-image.tsx` | 1200×630 generated cards |
| llms.txt | `app/llms.txt/route.ts` | generated: about, links, services, key pages, 20 recent posts, resources, citation guidance |
| llms-full.txt | `public/llms-full.txt` | static long-form profile (94 lines) |
| Search Console verification | `public/google797364b8fd6f1221.html` (content: `google-site-verification: google797364b8fd6f1221.html`) **and** the meta tag via env | both methods must stay |
| Cache/revalidation | `app/lib/cache-tags.ts`, `app/api/revalidate/route.ts` | on-demand ISR keeps blog/sitemap/llms/feed fresh |
| Headings | every page has 1 `<h1>` from the page component (`headingAs="h1"` on section pages); home h1 = "Hi, I'm Raish Momin" | 12 blog posts break this via raw HTML in content |

---

## 3. 2026 best practice (researched, with sources)

**Google Search, AI Overviews and AI Mode**
- There are no extra requirements for AI features. Pages must be indexed and snippet-eligible, crawlable, linked internally, with important content available as text ([AI features and your website](https://developers.google.com/search/docs/appearance/ai-features)).
- Google's AI optimization guide says to "Continue prioritizing foundational SEO best practices" and to create "unique, expert-led content". It also says "You don't need to create new machine readable files, AI text files, markup, or Markdown" and "Structured data isn't required for generative AI search". Track results with the Search Console *Generative AI performance* report ([AI optimization guide](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)).
- JS SEO: "Google Search won't render JavaScript from blocked files or on blocked pages". "server-side or pre-rendering is still a great idea… not all bots can run JavaScript" ([JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)). **This is why `/api/skils` plus `Disallow: /api/` is fatal for the home page.**
- Spam: *scaled content abuse* is "many pages are generated for the primary purpose of manipulating search rankings", "no matter how it's created". The policy's example is "Using generative AI tools… to generate many pages without adding value for users" ([Spam policies](https://developers.google.com/search/docs/essentials/spam-policies)).
- E-E-A-T (Who/How/Why): add accurate bylines, and disclose AI or automation use "when it would be reasonably expected" ([Creating helpful content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)).
- ProfilePage requires `mainEntity` (Person/Organization) with `name`. Recommended properties are `dateCreated`, `dateModified`, and on the Person `alternateName`, `description`, `identifier`, `image` ("Don't add placeholder images"), `sameAs`, `interactionStatistic` and `agentInteractionStatistic`. Eligibility: "The primary focus of the page must be a single person or organization that is affiliated with the overall website". Valid examples include an "About Me" page ([ProfilePage docs](https://developers.google.com/search/docs/appearance/structured-data/profile-page)).
- The sitelinks search box was retired on 2024-11-21. Leftover SearchAction markup is harmless, but WebSite markup is still used for site names ([coverage](https://ppc.land/google-to-remove-sitelinks-search-box/)).
- Google-Extended controls Gemini training and grounding. It "does not impact a site's inclusion in Google Search" and "is not used as a ranking signal" ([Google common crawlers](https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers)).
- Core Web Vitals "good" thresholds at p75 are LCP ≤ 2.5 s, INP ≤ 200 ms and CLS ≤ 0.1. INP replaced FID in March 2024 ([web.dev thresholds](https://web.dev/articles/defining-core-web-vitals-thresholds)).
- LCP candidates are img, svg `<image>`, video, `url()` backgrounds and block-level text. **`<canvas>` is not a candidate.** Elements with opacity 0 are excluded until they become visible ([web.dev LCP](https://web.dev/articles/lcp)). So WebGL can't *be* the LCP element, but it can delay it by blocking the main thread, and opacity-0 reveal animations push LCP out.

**ChatGPT search (OpenAI)** — [Overview of OpenAI crawlers](https://developers.openai.com/api/docs/bots)
- `OAI-SearchBot` is the search crawler: "Sites that are opted out of OAI-SearchBot will not be shown in ChatGPT search answers".
- `GPTBot` crawls for training.
- `ChatGPT-User` makes user-initiated fetches, and robots.txt may not apply to it.
- Each setting is independent, and changes take about 24 hours to apply.

**Claude (Anthropic)** — [Anthropic crawler help article](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler)
- `ClaudeBot` crawls for training.
- `Claude-SearchBot` indexes for search quality ("Disabling it may reduce a site's visibility in search results").
- `Claude-User` makes user-directed fetches.

**Perplexity** — [Perplexity bots](https://docs.perplexity.ai/guides/bots)
- `PerplexityBot` surfaces and links sites in results, and Perplexity recommends allowing it.
- `Perplexity-User` makes user-initiated fetches and "generally ignores robots.txt".

**Apple**
- `Applebot` crawls for Siri, Spotlight and Safari.
- `Applebot-Extended` is a control token for generative AI training only and doesn't affect search ([summary](https://trakkr.ai/bots/applebot-extended); verify against Apple's Applebot docs).

**Bing / Copilot**
- Bing and Copilot share Bing's crawl, index and ranking foundation.
- The Feb 2026 Webmaster Guidelines added GEO and grounding guidance (one topic per URL, key facts near the top) and a **"Prompt Injection and AI Manipulation"** section. That is relevant to our llms-full.txt "Citation guidance for LLMs" block ([SEJ coverage](https://www.searchenginejournal.com/bing-adds-geo-to-official-guidelines-expands-ai-abuse-definitions/)).
- Use Bing Webmaster Tools, its AI Performance report and IndexNow.

**llms.txt**
- John Mueller said in 2025 that no AI system currently uses llms.txt, and in 2026 called it "purely speculative" ([SER](https://seroundtable.com/google-ai-llms-txt-39607.html), [SEJ](https://www.searchenginejournal.com/google-says-llms-txt-is-purely-speculative-for-now/575026/)).
- None of the major AI providers has publicly confirmed using it.
- **Verdict:** keep it because it's cheap, make it accurate and factual, and don't invest beyond that.

**Next.js / R3F specifics**
- **JSON-LD:** Next.js says "`JSON.stringify`… does not sanitize malicious strings used in XSS injection… replac[e] the character, `<`, with its unicode equivalent, `<`" ([Next.js JSON-LD guide](https://nextjs.org/docs/app/guides/json-ld)).
- **Streaming metadata (15.2+):** bots matching `htmlLimitedBots` get blocking metadata. The default list covers Google, Bing, social and messaging bots, but **not** GPTBot, OAI-SearchBot, ClaudeBot or PerplexityBot. Setting the option **replaces** the default list ([htmlLimitedBots](https://nextjs.org/docs/app/api-reference/config/next-config-js/htmlLimitedBots), [html-bots.ts](https://github.com/vercel/next.js/blob/canary/packages/next/src/shared/lib/router/utils/html-bots.ts)).
- **Lazy loading:** "`ssr: false` isn't supported in Server Components". Put `dynamic(..., { ssr:false })` in a `'use client'` wrapper ([Lazy loading](https://nextjs.org/docs/app/guides/lazy-loading)).
- **R3F performance:** use `frameloop="demand"` with `invalidate()`, drei `PerformanceMonitor` to scale `dpr` and fall back, and on-demand rendering ([R3F scaling performance](https://r3f.docs.pmnd.rs/advanced/scaling-performance)).

---

## 4. Home page performance diagnosis (why 55 / LCP 3.9 s / CLS 0.135 / TBT 1.7 s)

Evidence comes from `baseline/lighthouse/index.json` and `baseline/html/index.html`, read against the code at dee9f64.

1. **LCP = hero description `<p>` with render delay 3,423 ms.**
   - The text comes from `value?.personalData?.[0]?.main_desc` (`components/hero.tsx`), loaded by the zustand store via `fetch("/api/skils", {method:"POST"})` (`app/lib/zutand.tsx`). That fetch is triggered by `usePersonalDataLoader()` inside `components/navbar.tsx` **after hydration**.
   - Server HTML renders an empty `<p>`, so the LCP candidate doesn't exist until about 1.2 s (fetch end on simulated mobile) plus hydration plus a framer-motion fade (`delay 0.6s`, `duration 0.7s`).
   - TTFB is only 479 ms, so this is purely client-side.
2. **The full-screen loader hides everything.** `components/loader.tsx` (`BrandLoader`) is server-rendered as `fixed inset-0 z-[80] bg-background` with `opacity:1`, and `components/mainComponent.tsx` removes it after `setTimeout(1600)` plus a 0.5 s exit fade. Nothing under it can be LCP until then.
3. **37 elements are server-rendered with `opacity:0`.** These come from framer-motion `initial` props: hero letters (`y:"100%", opacity:0`), the eyebrow, CTA row, every `Section` (`components/section.tsx`) and the `RevealHeading` clip-path. `useReducedMotion()` returns null on the server, so the hidden state is always shipped. With JS off the page is mostly invisible, and LCP waits for hydration plus animation. `/about` and `/projects` have LCP render delays of 2.5 s for the same reason.
4. **CLS of 0.1347 comes from `section#home > div.relative` alone.**
   - The hero is `min-h-screen flex items-center`. When the empty `<p>` (0 px) becomes 130 px of text, the vertically centred block moves and shifts the h1 and CTAs.
   - The resume button also appears late (`resume_link` from the same fetch), as do the navbar GitHub/LinkedIn icons.
   - The navbar padding animates between 24 and 12 px (tiny shift: 0.0005).
5. **TBT 1,720 ms, bootup 2.9 s, main thread 7.6 s.**
   - `MainComponent` is `"use client"`, so the **entire home** (Hero, About, Skills, Experience, Projects, Contact, Footer, Navbar) hydrates as one client tree with framer-motion (`useScroll`/`useTransform` scroll-linked parallax, `Magnetic` buttons, `Tilt`, `CountUp`, `layoutId` springs).
   - "Style & Layout 1.8 s" and "Other 2.2 s" come from:
     - `components/noise.tsx` plus `.noise` in `app/globals.css`: a fixed, full-viewport SVG `feTurbulence` data-URI background with `mix-blend-mode: overlay`, repainted and composited on every scroll frame.
     - `backdrop-blur-xl` on the fixed navbar.
     - `animate-ping` loops.
     - Clip-path reveals.
   - `fetchIPInfo()` fires `POST /api/info` on every visit, which adds a server-side ipapi.co lookup. That is not a big CPU cost, but it is an extra request and a privacy concern.
6. **Contrast with other pages.** Service and blog pages are server components with server-rendered text, and they score 87–93 with near-zero CLS. The fix pattern already exists in the codebase.

**Fix order (the redesign must do all of these before adding 3D):**
1. Make `app/page.tsx` a Server Component that fetches personal, skills, experience and projects on the server. Reuse the `unstable_cache` getters already in `app/projects/page.tsx`, `app/skills/page.tsx` and `app/experience/page.tsx`, plus a `getPersonal()` like the one in `components/json-ld.tsx`. Pass the data as props.
2. Delete `BrandLoader` from the home page.
3. Keep the hero h1 and intro text visible in the first paint (no opacity, clip or translate entrance on LCP text).
4. Make sections server components with small client islands (only the contact form, theme toggle and mobile menu need JS).
5. Replace the noise overlay with a static tiled PNG/AVIF, or drop it.
6. Use `LazyMotion` + `m` + `domAnimation` (or CSS) for the remaining motion.
7. Drop the 1.6 s timers.

---

## 5. Gaps — prioritized, with exact files and concrete fixes

### P0 — blocking (redesign cannot ship without these)

**P0-1. Content is client-fetched and invisible to crawlers.**
- Files: `components/mainComponent.tsx`, `components/hero.tsx`, `components/about.tsx`, `components/skills.tsx`, `components/experience.tsx`, `components/projects.tsx`, `components/navbar.tsx`, `components/footer.tsx`, `app/lib/zutand.tsx`, `app/api/skils/route.ts`, `app/page.tsx`, `app/about/page.tsx`, `app/projects/page.tsx`, `app/skills/page.tsx`, `app/experience/page.tsx`.
- Fix: fetch on the server in each `page.tsx` (reuse the existing `getProjects` / `getSkillNames` / `getExperience` and add a cached `getPersonal`), render the text in Server Components, and keep `revalidate` (ISR) so pages stay static. Client islands get data via props only.
- Rules:
  - Never fetch page content from `/api/*` on the client.
  - The JSON-LD lists (projects, skills, roles) and the visible HTML must come from **the same server data**, so structured data matches visible content.
- Keep `/api/skils` responding (no removal needed), but nothing should depend on it.

**P0-2. LCP/CLS killers in the hero and above the fold.**
- Files: `components/loader.tsx`, `components/mainComponent.tsx`, `components/hero.tsx`, `components/section.tsx`, `components/navbar.tsx`.
- Fix:
  - Remove `BrandLoader` and the 1.6 s timer.
  - Hero h1 and intro `<p>` are server-rendered, with no `initial={{opacity:0}}`, letter-split `y:"100%"` or clip-path on LCP text.
  - Reserve space for anything late (resume button, social icons): render them on the server from the same data.
  - Reveal-on-scroll for below-the-fold content must be progressive enhancement. Apply the hidden state only under `html.js` plus `@media (prefers-reduced-motion: no-preference)`, so content is visible without JS.

**P0-3. JSON-LD escaping and payload.**
- Files: `components/page-json-ld.tsx`, `components/json-ld.tsx`, `app/blog/[slug]/page.tsx`.
- Fix: `dangerouslySetInnerHTML={{ __html: JSON.stringify(block).replace(/</g, "\\u003c") }}` in **both** components. Remove `articleBody: post.content` from BlogPosting. It duplicates the whole post inside the HTML, and it is what broke `/blog/optimizing-next-js-14-server-components-with-edge-runtime-for-50-reduced-initial-payload-size-by-implementing-code-splitting-lazy-loading-and-adaptive-resource-scheduling` (its `</script>` sample terminated the block). After the fix, `seo_check.py` must report 0 JSON-LD failures.

**P0-4. Home JS and main-thread budget.**
- Files: `components/mainComponent.tsx` (`"use client"` root), `components/noise.tsx`, `app/globals.css` (`.noise`), `app/layout.tsx` (`<Noise/>`, `<ScrollProgress/>`), `components/magnetic-button.tsx`, `components/tilt-card.tsx`, `components/count-up.tsx`.
- Fix: pages are Server Components and client code is limited to leaf islands. Budgets are in section 6.4.
- Lab target before the 3D layer lands: home TBT ≤ 150 ms and LCP ≤ 2.0 s on Lighthouse mobile. The 3D layer then must not push TBT above 200 ms or LCP above 2.5 s.

### P1 — high (do in this redesign)

**P1-1. One source of truth for entity facts.**
- Files: `app/lib/config.ts` (`email: "raishmomin@example.com"`, `linkedin: …/in/raish-momin/`), `components/json-ld.tsx` (uses DB `linkdin` = `…/in/raish-momin-ba8927253?utm_source=share&utm_campaign=…`, DB `location` = "Ahemadabad, Gujarat, India"), `app/llms.txt/route.ts`, `app/feed.xml/route.ts` (`managingEditor`/`webMaster` = placeholder), `components/author-bio.tsx` (`mailto:raishmomin@example.com` on all 51 posts), `app/lib/faqs.ts` ("4+ years", "Next.js 14"), `app/lib/services.ts` ("Next.js 14 (App Router)", "React 18 + Server Components", "Next.js 14 freelancer"), `public/llms-full.txt` ("Next.js 14").
- Fix: create `app/lib/profile.ts` (server-only) with the canonical facts: name, givenName, familyName, jobTitle, a one-sentence bio, location (Ahmedabad, Gujarat, IN), start of career (2021-09) and a derived years figure, availability, public email, canonical `sameAs` URLs with no query strings, stack, services, and `updatedAt`. Every surface reads from it: JSON-LD, hero/about, FAQs, llms.txt, llms-full, RSS, AuthorBio and OG images.
- Owner must confirm: real public email, which LinkedIn URL is canonical, whether the Twitter/X handle `@raishmomin` exists (else remove `twitter:creator`), and the "4+ vs 5+ years" claim.

**P1-2. Upgrade Person and ProfilePage.**
- Files: `app/page.tsx`, `components/json-ld.tsx`, `app/about/page.tsx`.
- Fix (see snippet 8.2):
  - Merge the home `WebPage` (`/#webpage`) and `ProfilePage` (`#profilepage`) into **one** node `@type: "ProfilePage"`, `@id: ${SITE_URL}/#webpage`, with `dateCreated: "2025-06-04T16:29:27+05:30"` (first portfolio commit), `dateModified` from `profile.updatedAt`, `mainEntity: {"@id": "${SITE_URL}#person"}`, `isPartOf` the website and `inLanguage`.
  - Person: add `givenName`, `familyName`, `alternateName` (GitHub handle "Raishmomin"), and a **real headshot** `image` (ImageObject, ≥ 400×400, in `/public`, not the OG card). Use the canonical `sameAs`. Add `homeLocation`/`address` with `addressLocality: "Ahmedabad"`, `addressRegion: "Gujarat"`, `addressCountry: "IN"`. Add `hasOccupation` (Occupation, name = jobTitle, skills), `worksFor`/`alumniOf` if public, and `knowsLanguage`.
  - Keep `@id` values exactly as they are today (`${SITE_URL}#person`, `${SITE_URL}#website`) so existing references stay valid.
  - `/about`: keep `AboutPage` but add `mainEntity: {"@id": person}`.

**P1-3. Explicit crawler allowlist in robots.**
- File: `app/robots.ts`. Fix: snippet 8.1.
- A UA-specific group overrides `*` entirely for that bot, so **each group must repeat `disallow: ["/api/"]`**. Keep `sitemap`. `host` is non-standard and can stay or go.

**P1-4. Wire per-route OG images.**
- Files: `app/lib/seo.ts` (`const image = input.image || "/opengraph-image"`), `app/blog/[slug]/page.tsx`, `app/services/[slug]/page.tsx`.
- Fix: pass `image: \`/blog/${slug}/opengraph-image\`` and `image: \`/services/${slug}/opengraph-image\``, or omit `openGraph.images` when a route has a file-based image. The baseline proves every post's `og:image` and `twitter:image` is the home card.
- The JSON-LD `image` already points at `${url}/opengraph-image`; keep the two consistent.
- Re-check after Next 16, since file-based vs config precedence must be verified with curl.

**P1-5. Blog renderer safety and heading hygiene.**
- File: `app/blog/[slug]/page.tsx` (`renderMarkdown` + `dangerouslySetInnerHTML`).
- Fix: HTML-escape the markdown source **before** applying transforms (code fences are already escaped, but inline raw HTML like `<h1>Home Page</h1>` passes through), or switch to `remark` + `rehype-sanitize`. Map `#` to `<h2>`, so there is never a second `<h1>`. Add `target="_blank"` only to external links.
- Affects 12 posts with 2–5 `<h1>` today.

**P1-6. Blog quality and scaled-content risk (owner decision; builders must not delete URLs).**
- Files: `vercel.json` (cron `0 5 * * 1,3,5`), `app/api/cron/generate-blog/route.ts` (Llama 3.1 8B, auto-publish).
- Facts: 35 of 51 posts are near-duplicate "Optimizing Next.js 14 Server Components…" variants. 37 titles carry made-up "XX% reduced" claims under Raish's byline. Titles run 77–210 chars, and descriptions of up to 273 chars appear in quoted form.
- Recommendation:
  1. Pause the cron, or switch it to draft-only (`published:false`) with human review.
  2. Pick 1–3 strongest posts per cluster and **301** the rest to them through `redirects()` in `next.config` (`statusCode: 301`). Remove them from the sitemap, llms.txt and RSS at the same time.
  3. Add an AI-assistance disclosure on posts that keep generated text.
  4. Add a `seoTitle` ≤ 60 chars.

  This is compatible with the "no broken links" rule.

**P1-7. Rebuild llms.txt and llms-full.txt from facts.**
- Files: `app/llms.txt/route.ts`, `public/llms-full.txt` (convert to `app/llms-full.txt/route.ts`, keeping the URL `/llms-full.txt`).
- Fix:
  - Use `profile.ts`.
  - Add a "Key facts" list of short, quotable sentences, each a standalone claim with a link.
  - Add an FAQ (reuse `FAQS`).
  - List services, the curated best posts (not 20 near-duplicates), and a link to `/llms-full.txt`.
  - Remove the "If you are an LLM-powered search assistant… cite…" instruction block (it risks being treated as AI manipulation under Bing's guidelines) and replace it with neutral facts.
  - Keep `Content-Type: text/plain; charset=utf-8`.

**P1-8. Next 16 streaming metadata and AI crawlers.**
- Files: `next.config.*`, every route with `generateMetadata`.
- Fix: keep all indexable routes static or ISR, with no `cookies()`, `headers()` or `searchParams` in pages. QA must confirm `<title>`, description and canonical sit inside `<head>` when fetched as GPTBot, ClaudeBot and PerplexityBot (`seo_check.py --ua GPTBot`).
- If any page has to be dynamic, set `htmlLimitedBots` to a regex that copies the default list from the installed `next/dist/.../html-bots` **plus** `GPTBot|OAI-SearchBot|ChatGPT-User|ClaudeBot|Claude-SearchBot|Claude-User|PerplexityBot|Perplexity-User`. Overriding replaces the defaults, so the defaults must be included.

**P1-9. Experience structured data is invalid.**
- File: `app/experience/page.tsx`.
- `e.period?.split("—")` splits on an em dash, but the data uses `"Sept 2021 - Dec 2022"`, so `startDate` holds the whole range and `endDate` is undefined.
- Fix: parse with `/\s*[-–—]\s*/` into ISO `YYYY-MM`, map "Present" to omitting `endDate`, and link the roles to the Person (`hasOccupation` or `worksFor` with `@type: "EmployeeRole"`).

### P2 — medium/low (do if time allows; never at the cost of P0/P1)

- **P2-1. RSS discovery link lost on every page.**
  - Files: `app/lib/seo.ts`, `app/layout.tsx`.
  - Cause: page-level `alternates: { canonical }` replaces the layout's `alternates.types`. Baseline has no `<link rel="alternate" type="application/rss+xml">` anywhere.
  - Fix: add `types: { "application/rss+xml": \`${SITE_URL}/feed.xml\` }` inside `buildMetadata().alternates`.
- **P2-2. Sitemap `lastmod` is fake.**
  - File: `app/sitemap.ts`. Static and service URLs get `new Date()` at generation time (12 URLs share one timestamp).
  - Fix: use real last-edit dates (a constant per page, `profile.updatedAt`, or the latest project/experience doc date). Only include canonical, 200, indexable URLs.
- **P2-3. Duplicate Service entity.**
  - Files: `app/services/[slug]/page.tsx`, `app/lib/seo.ts`.
  - Cause: `webPageSchema({type:"Service"})` creates a second Service node with `@id …#webpage`, and `priceRange` isn't a Service property.
  - Fix: type `WebPage` with `mainEntity: {"@id": …#service}`, and model price as `offers: {"@type":"Offer", priceSpecification:{"@type":"UnitPriceSpecification", price:2500, priceCurrency:"USD", unitText:"week"}}`.
- **P2-4. Dead SearchAction.**
  - File: `components/json-ld.tsx`. `potentialAction` points to `/blog?q=`, which `/blog` doesn't implement.
  - Fix: remove `potentialAction`. Keep WebSite with `name` and `alternateName` for site names.
- **P2-5. Skip link is broken on 62 of 63 pages.**
  - File: `app/layout.tsx` links to `#home`, which exists only on `/`.
  - Fix: add `id="main"` and `tabIndex={-1}` on every `<main>`, and point the skip link to `#main`.
- **P2-6. Home h1 is split into letters.**
  - File: `components/hero.tsx`. The h1 is built from `aria-hidden` letter spans plus `aria-label`.
  - Fix: a plain-text h1 that includes the entity and role, for example "Raish Momin, Full Stack Developer & DevOps Engineer" (role visually smaller is fine). Animate a wrapper with transform only, never on the LCP text.
- **P2-7. Blog titles are too long.**
  - File: `app/blog/[slug]/page.tsx`.
  - Fix: add `seoTitle` (≤ 60 chars) in the DB and fall back to a truncated title; use `{absolute}` to avoid the long `| Raish Momin` suffix.
- **P2-8. Blog index is 378 KB of HTML.**
  - File: `app/blog/page.tsx` renders all 51 cards plus the RSC payload.
  - Fix: paginate (`/blog/page/2`, each with a self-canonical) or render the first 12 with "load more" as a real `<a href>` to a paginated URL.
- **P2-9. Thin internal links from home.**
  - The home navbar uses only `#anchors`.
  - Fix: add in-content `<a href>` links from home sections to `/projects`, `/services/*`, `/blog` and `/about`. Keep the footer sitemap nav.
- **P2-10. Visible FAQ on home.** Add 4–6 Q&As (who, what stack, availability, rates, location/time zone, how to hire) rendered as visible HTML plus FAQPage. FAQ rich results are limited to authoritative government/health sites since 2023, so this is for AI answers and semantics, not rich results.
- **P2-11. Manifest icons.** File: `app/manifest.ts`. Add 192 and 512 PNG icons (cosmetic).
- **P2-12. Visitor logging.** File: `app/lib/ipInfo.tsx` → `app/api/info/route.ts` sends a visitor-IP geo lookup to ipapi.co on every page view. Consider Vercel Analytics instead, for privacy and one fewer request.
- **P2-13. Off-site work.**
  - Verify the site in Bing Webmaster Tools, submit the sitemap, and add IndexNow on publish.
  - In Search Console, watch the Generative AI performance report.
  - Long term, a custom domain such as `raishmomin.dev` improves the brand entity. That requires a full-site 301 migration, so it is out of scope for this redesign.

---

## 6. Guardrails for the React Three Fiber 3D layer (non-negotiable)

### 6.1 Text and SSR
1. Every word of page content is rendered on the server in normal semantic HTML (`header`, `nav`, `main`, `section` with h2s, `article`, `footer`). **No content inside the canvas**: no drei `<Text>`/`<Text3D>`/`<Html>` carrying copy that isn't duplicated in the DOM. The scene is decoration.
2. Page files (`app/**/page.tsx`) stay **Server Components**. Never put `"use client"` at page or layout level. Client code lives in leaf islands.
3. Keep exactly **one `<h1>` per page**, server-rendered and visible at first paint. The home h1 contains "Raish Momin" and the role. Section headings are `<h2>`, sub-items `<h3>`. No skipped levels.
4. No UA sniffing to serve different content to bots (cloaking). Bots get the same HTML; they simply don't run the 3D.
5. Page navigation uses real `<a href>` / `next/link`. A clickable 3D object must have an equivalent DOM link or button. Never put routing only in raycast `onClick`.

### 6.2 Loading the 3D
6. Load it like this:
   ```tsx
   // components/three/scene-loader.tsx
   'use client';
   import dynamic from 'next/dynamic';
   const Scene = dynamic(() => import('./scene'), { ssr: false, loading: () => null });
   ```
   Import `SceneLoader` from the Server Component page. `ssr:false` is only legal inside a client file.
7. Mount the scene **only after** `window.load`, then `requestIdleCallback` (with a `setTimeout(…, 1500)` fallback), **and** only while the hero container is in view (IntersectionObserver). Never preload three.js or model assets in `<head>`, and never at a higher priority than the LCP text, font or CSS. Fetch assets with `fetchPriority="low"`.
8. Capability gate: do **not** mount the canvas, and show the static poster instead, if any of these hold:
   - `matchMedia('(prefers-reduced-motion: reduce)').matches`
   - `navigator.connection?.saveData`
   - `(navigator.deviceMemory ?? 8) <= 4`
   - `(navigator.hardwareConcurrency ?? 8) <= 4`
   - no WebGL2 (`canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: true })` returns null)

   Re-evaluate on `change` of the reduced-motion media query.
9. Provide a visible, keyboard-reachable **"Reduce motion / turn off 3D"** toggle. Keep its state in `localStorage`, inside try/catch.

### 6.3 LCP and CLS
10. The LCP element must be server-rendered **text** (the h1 or intro paragraph) or a small optimized poster. `<canvas>` can't be LCP, but it can delay it. Use no splash screen, no loader overlay, no `Suspense` fallback that hides text, and no opacity, clip-path or translate entrance on the LCP element.
11. The canvas lives in a **pre-sized** container: `position:absolute; inset:0` behind the hero, or a fixed `aspect-ratio` box, with `contain: strict` and `pointer-events:none` unless it is interactive. Fade it in with `opacity` only, which never causes CLS. Never insert or resize DOM above existing content after hydration.
12. The poster/fallback is either a CSS gradient (not an LCP candidate) or an AVIF/WebP image of ≤ 60 KB with explicit width and height through `next/image`. If the poster is the largest above-the-fold image, give it `priority`.
13. Fonts: `next/font` with `display:"swap"` and `adjustFontFallback` (the default). For any 3D text font, self-host and subset it and load it only with the scene.

### 6.4 Budgets (enforced in QA)
| Item | Budget |
|---|---|
| Initial JS for `/` (gzip, excluding the lazy 3D chunk) | ≤ 150 KB |
| Initial JS for other routes | ≤ 130 KB |
| Lazy 3D chunk (three + R3F + used drei parts) | ≤ 300 KB gzip; named drei imports only; no `three/examples/*` barrel imports |
| 3D assets (glTF + textures + env) | ≤ 1.5 MB desktop, ≤ 600 KB mobile; glTF with Draco/Meshopt; KTX2 or WebP textures ≤ 1024 px (512 on mobile); HDR/env ≤ 500 KB, **self-hosted** (drei `Environment preset` fetches from an external CDN; don't use it) |
| Lighthouse mobile (every audited page) | Perf ≥ 95, SEO 100, A11y ≥ 95 (aim 100), BP 100 |
| Lab vitals | LCP < 2.5 s (aim ≤ 2.0 s), CLS < 0.1 (aim ≤ 0.02), TBT < 200 ms |
| Field (after deploy, p75) | LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 |
| Long tasks from 3D in the first 5 s | none > 50 ms on mobile emulation |

### 6.5 Runtime and INP
14. Use `<Canvas frameloop="demand">` (call `invalidate()` when something changes), or `"always"` only while visible. Switch to `frameloop="never"` when offscreen (IntersectionObserver) or when `document.hidden` is true.
15. Set `dpr={[1, 1.5]}` and wrap with drei `PerformanceMonitor` to lower `dpr` and drop effects on decline, with `onFallback` switching to the poster. Skip heavy post-processing on mobile.
16. Never call `setState` per frame. Mutate refs in `useFrame`. Keep pointer handlers cheap: raycast against few objects and throttle `onPointerMove`. Scroll-linked motion uses passive listeners or `useScroll` motion values, not React state.
17. No scroll-jacking. If Lenis or another smooth-scroll library is used, it must be disabled under reduced motion and must keep native keyboard scrolling, anchor links (`scroll-margin-top`) and focus scrolling working.
18. Dispose geometries, materials and textures on unmount. Handle `webglcontextlost` by falling back to the poster.

### 6.6 Accessibility and no-JS view
19. Canvas wrapper: `aria-hidden="true"`, `tabIndex={-1}`, `role="presentation"`. Focus must never get trapped in the canvas.
20. With JS disabled the page must be fully readable: no `opacity:0` server-rendered on content. Reveal animations apply only when an inline head script has set `document.documentElement.classList.add('js')` **and** the reduced-motion media query allows them. A `<noscript><style>` override is an acceptable backup.
21. Respect `prefers-reduced-motion` site-wide, not only in 3D: no parallax, auto-playing loops or letter animations. The existing global CSS rule in `app/globals.css` stays.
22. Keep the skip link (fixed to `#main`), visible focus styles, colour contrast of at least 4.5:1 over any 3D background (add a scrim behind text), and touch targets of at least 44 px.

### 6.7 URLs, metadata and files
23. **Every one of the 68 baseline paths keeps returning 200** (`baseline/status.txt`), or returns a 301 to its replacement via `next.config` `redirects()` with `statusCode: 301` (`permanent:true` emits 308, which is also fine for Google). No URL is replaced by a hash-only section.
24. Every route keeps using `buildMetadata()` from `app/lib/seo.ts`: unique title (≤ 60 chars for static pages), description of 70–160 chars, self-referencing absolute canonical, OG and Twitter. Do not remove the file-based OG and icon routes.
25. Keep all JSON-LD (Person, WebSite, ProfilePage, BreadcrumbList on every non-home page, FAQPage, Service, Blog/BlogPosting, ItemList) and keep the existing `@id` strings unchanged.
26. Keep `public/google797364b8fd6f1221.html` byte-for-byte, and keep the `GOOGLE_SITE_VERIFICATION` env var in Vercel.
27. Keep `app/robots.ts`, `app/sitemap.ts`, `app/feed.xml/route.ts`, `app/manifest.ts`, `app/llms.txt/route.ts` and `/llms-full.txt` working at the same URLs.
28. Next 16 migration notes for SEO files:
    - `params` is async: `const { slug } = await params` in `generateMetadata` and pages.
    - Keep `generateStaticParams` plus `revalidate` so blog and services stay ISR.
    - Redirect or rewrite logic moves from `middleware.ts` to `proxy.ts` if any is added.
    - `next lint` is gone (use ESLint CLI).

---

## 7. What "done" looks like per page (SSR, JS off)

| Route | Must contain in server HTML | JSON-LD |
|---|---|---|
| `/` | h1 with name and role; 1–2 sentence bio; years and location; availability; top skills list; 3–6 featured projects (title, one line, stack, link); experience summary (company, role, dates); services links; contact CTA; visible FAQ (P2-10); ≥ 600 words | Person, WebSite, ProfilePage (merged), BreadcrumbList; FAQPage if a FAQ is added |
| `/about` | h1; full bio from DB `about_desc`; real stats (no "0 +"); FAQ (8) | AboutPage (mainEntity person), FAQPage, BreadcrumbList, Person, WebSite |
| `/projects` | h1; every project (13) with title, description, tech, category, live link | CollectionPage, ItemList, BreadcrumbList |
| `/skills` | h1; all 32 skills grouped by category | WebPage, ItemList, BreadcrumbList |
| `/experience` | h1; all roles with company, dates, description | CollectionPage, ItemList (valid ISO dates), BreadcrumbList |
| `/services`, `/services/*` | unchanged content (already server-rendered) | CollectionPage/ItemList; WebPage + Service + FAQPage + BreadcrumbList |
| `/blog`, `/blog/*` | unchanged (server-rendered); exactly one h1 | Blog; BlogPosting (no articleBody, escaped) + BreadcrumbList |
| `/contact` | h1, form with labels, FAQ (5) | ContactPage, FAQPage, BreadcrumbList |

---

## 8. Ready-to-use snippets

### 8.1 `app/robots.ts`
```ts
import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/config";

// Search + answer engines and AI user-agents we explicitly welcome.
// A UA-specific group replaces the "*" group for that bot, so repeat the /api/ disallow.
const NAMED_BOTS = [
  "Googlebot", "Bingbot", "Applebot", "DuckDuckBot",
  "OAI-SearchBot", "ChatGPT-User", "GPTBot",
  "Claude-SearchBot", "Claude-User", "ClaudeBot",
  "PerplexityBot", "Perplexity-User",
  "Google-Extended", "Applebot-Extended",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/api/"] },
      { userAgent: NAMED_BOTS, allow: "/", disallow: ["/api/"] },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
```

### 8.2 Home ProfilePage (replaces the separate WebPage and ProfilePage nodes in `app/page.tsx`)
```ts
{
  "@context": "https://schema.org",
  "@type": "ProfilePage",
  "@id": `${SITE_URL}/#webpage`,
  url: `${SITE_URL}/`,
  name: SITE.title,
  description: SITE.description,
  inLanguage: "en-US",
  isPartOf: { "@id": `${SITE_URL}#website` },
  dateCreated: "2025-06-04T16:29:27+05:30",
  dateModified: PROFILE.updatedAt,            // last human edit of profile facts (ISO 8601)
  mainEntity: { "@id": `${SITE_URL}#person` },
}
```
Person (in `components/json-ld.tsx`), additions:
```ts
givenName: "Raish", familyName: "Momin", alternateName: "Raishmomin",
image: { "@type": "ImageObject", url: `${SITE_URL}/raish-momin.jpg`, width: 800, height: 800 },
address: { "@type": "PostalAddress", addressLocality: "Ahmedabad", addressRegion: "Gujarat", addressCountry: "IN" },
sameAs: [PROFILE.github, PROFILE.linkedin /* no query string */, /* X, dev.to, etc. if real */],
hasOccupation: { "@type": "Occupation", name: SITE.jobTitle, skills: "React, Next.js, TypeScript, Node.js, MongoDB, Docker, Kubernetes, AWS, CI/CD" },
```
If Google's Rich Results Test does not resolve `mainEntity` by `@id` across script tags, inline `name`, `image` and `sameAs` into `mainEntity`.

### 8.3 Safe JSON-LD component (`components/page-json-ld.tsx`; mirror in `components/json-ld.tsx`)
```tsx
const safe = (o: object) => JSON.stringify(o).replace(/</g, "\\u003c");
export function PageJsonLd({ data }: { data: object | object[] }) {
  const blocks = Array.isArray(data) ? data : [data];
  return <>{blocks.map((b, i) => (
    <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: safe(b) }} />
  ))}</>;
}
```

### 8.4 llms.txt "Key facts" section (generated from `profile.ts`)
```
## Key facts
- Raish Momin is a Full Stack Developer & DevOps Engineer based in Ahmedabad, Gujarat, India, working remotely worldwide.
- Professional experience since September 2021 (5 years): <roles from experience collection>.
- Core stack: Next.js, React, TypeScript, Node.js, MongoDB/PostgreSQL, Docker, Kubernetes, AWS, CI/CD (GitHub Actions).
- Services: Next.js development, MERN stack development, DevOps & AWS consulting, API & backend development (links).
- Availability: <single agreed statement>. Contact: <public email> or https://raish-momin.vercel.app/contact
- Profiles: https://github.com/Raishmomin, <canonical LinkedIn URL>
- Full profile: https://raish-momin.vercel.app/llms-full.txt
```

---

## 9. QA checklist (with commands)

Setup:
```bash
DATA=/tmp/claude-1000/-home-raish-raish-my-app/ffd02af8-1b89-4a04-a12d-8deb02a3d03d/scratchpad/data
BASE=http://localhost:3000
cd /home/raish/raish/my-app && npm run build 2>&1 | tee $DATA/qa-build.log && (npm run start -- -p 3000 &)
awk '{print $2}' $DATA/baseline/status.txt > $DATA/qa-paths.txt   # 68 baseline paths
```

1. **Build is clean.** `npm run build`, `npx tsc --noEmit` and the ESLint CLI must have zero errors. In the route table, `/`, `/about`, `/projects`, `/skills`, `/experience`, `/contact`, `/services`, `/services/[slug]`, `/blog` and `/blog/[slug]` must be Static (○) or SSG/ISR (●), not Dynamic (ƒ).
2. **Every baseline URL returns 200, or a 301 to a 200.**
   `while read p; do echo "$(curl -s -o /dev/null -w '%{http_code}' "$BASE$p") $p"; done < $DATA/qa-paths.txt | grep -v '^200 '` must print nothing, except deliberate 301s listed in the PR.
3. **SEO checker has zero hard failures.**
   - `python3 -I $DATA/seo_check.py --base $BASE --paths $DATA/qa-paths.txt` must exit 0. It checks 200, one h1, title in head, description, self canonical, og:image, valid and escaped JSON-LD, Person, WebSite, BreadcrumbList and home ProfilePage.
   - Visible-word warnings must clear for `/` (≥ 600), `/about`, `/projects`, `/skills` and `/experience`.
   - Baseline for comparison: `python3 -I $DATA/seo_check.py --dir $DATA/baseline/html` (38 failing).
4. **Bots see the same content, with metadata in `<head>`.**
   `for ua in Googlebot Bingbot GPTBot OAI-SearchBot ClaudeBot PerplexityBot; do echo $ua; python3 -I $DATA/seo_check.py --base $BASE --paths $DATA/qa-paths.txt --ua $ua | tail -1; done`: every run shows 0 hard failures.
5. **Key facts are in the server HTML.**
   `for s in "Raish Momin" "Full Stack Developer" "DevOps" "Ahmedabad" "Fahm Technologies" "Cognyx" "Kubernetes" "AWS"; do curl -s $BASE/ | grep -q "$s" && echo "ok $s" || echo "MISSING $s"; done`. Also confirm there is no `0 +` years stat: `curl -s $BASE/ | grep -c '>0<'`, then review the hits.
6. **No placeholder or inconsistent facts.**
   `curl -s $BASE/llms.txt $BASE/feed.xml $BASE/blog/optimizing-api-latency-with-edge-caching-and-kubernetes-ingress | grep -c 'example.com'` must be 0. `curl -s $BASE/ | grep -o 'linkedin.com/in/[^"?<]*' | sort -u` must show exactly 1 URL. `grep -c utm_` on any page must be 0.
7. **robots.txt has every named bot.**
   `R=$(curl -s $BASE/robots.txt); for b in OAI-SearchBot ChatGPT-User GPTBot Claude-SearchBot Claude-User ClaudeBot PerplexityBot Perplexity-User Google-Extended Applebot-Extended Bingbot; do echo "$R" | grep -qi "User-Agent: $b" && echo "ok $b" || echo "MISSING $b"; done`. Also confirm `Sitemap:` is present and `Disallow: /api/` appears in each group.
8. **The sitemap has not shrunk.**
   `diff <(grep -o '<loc>[^<]*' $DATA/baseline/sitemap.xml | sort) <(curl -s $BASE/sitemap.xml | grep -o '<loc>[^<]*' | sort)`. Only additions or deliberate 301 removals are allowed. Every new `<loc>` (rewritten to `$BASE`) must return 200.
9. **llms, feed, manifest and verification work.**
   - `curl -sI $BASE/llms.txt | grep -i 'text/plain'`
   - `curl -s $BASE/llms.txt | grep -q 'llms-full.txt'`
   - `curl -s $BASE/feed.xml | xmllint --noout -` (valid XML)
   - `curl -s $BASE/manifest.webmanifest | python3 -m json.tool >/dev/null`
   - `curl -s $BASE/google797364b8fd6f1221.html` must equal `google-site-verification: google797364b8fd6f1221.html`
   - `curl -s $BASE/ | grep -c 'google-site-verification'` must be ≥ 1
10. **OG images work.**
    - `curl -s -o /dev/null -w '%{http_code} %{content_type}\n' $BASE/opengraph-image` must return `200 image/png`. The same applies to `/blog/<slug>/opengraph-image` and `/services/nextjs-development/opengraph-image`.
    - Each blog post's `og:image` must equal its own `/blog/<slug>/opengraph-image`: `curl -s $BASE/blog/<slug> | grep -o 'og:image" content="[^"]*'`.
11. **RSS alternate link is present.** `curl -s $BASE/about | grep -c 'application/rss+xml'` must be ≥ 1.
12. **Rich results validate (on the Vercel preview URL).**
    - Run the [Rich Results Test](https://search.google.com/test/rich-results) on `/`, which must detect ProfilePage, Breadcrumb and Profile. Also run it on `/about`, `/services/nextjs-development` and one `/blog/<slug>`, with 0 errors.
    - [validator.schema.org](https://validator.schema.org/) must show 0 errors on the same URLs.
13. **Lighthouse thresholds (mobile, run 3 times, take the median).**
    ```bash
    for p in / /about /projects /blog /services/nextjs-development /blog/optimizing-api-latency-with-edge-caching-and-kubernetes-ingress; do
      n=$(echo "$p" | tr '/' '_'); npx -y lighthouse@12.8.2 "$BASE$p" --quiet --chrome-flags="--headless=new" \
        --only-categories=performance,accessibility,best-practices,seo --output=json --output-path="$DATA/qa-lh$n.json"; done
    python3 -I - "$DATA" <<'EOF'
    import json,glob,sys
    bad=0
    for f in sorted(glob.glob(sys.argv[1]+'/qa-lh*.json')):
        d=json.load(open(f)); c=d['categories']; a=d['audits']
        s={k:round(c[k]['score']*100) for k in c}
        lcp=a['largest-contentful-paint']['numericValue']/1000; cls=a['cumulative-layout-shift']['numericValue']; tbt=a['total-blocking-time']['numericValue']
        ok=s['performance']>=95 and s['seo']==100 and s['accessibility']>=95 and s['best-practices']==100 and lcp<2.5 and cls<0.1 and tbt<200
        bad+=not ok; print('OK ' if ok else 'FAIL', f.split('qa-lh')[1], s, f'LCP {lcp:.2f}s CLS {cls:.3f} TBT {tbt:.0f}ms')
    sys.exit(1 if bad else 0)
    EOF
    ```
    In each home report, `largest-contentful-paint-element` must be the h1 or the intro `<p>` (or the poster), with render delay < 1,000 ms. `layout-shifts` must show nothing ≥ 0.02.
14. **Reduced motion and low-end devices (Playwright).**
    - Emulate `reducedMotion: 'reduce'`. On `/`, `document.querySelectorAll('canvas').length === 0` and the poster is shown.
    - Emulate a Moto G Power (4× CPU throttle) and confirm no canvas mounts when `deviceMemory <= 4` (stub `navigator.deviceMemory`).
    - The toggle "turn off 3D" works with the keyboard.
15. **JS-disabled view (Playwright, `javaScriptEnabled: false`).**
    - Take a full-page screenshot of `/`, `/about` and `/projects`. All text must be visible.
    - `getComputedStyle(document.querySelector('h1')).opacity === '1'`.
    - No element with an inline style `opacity:0` contains text.
16. **Keyboard and accessibility.**
    - Tab from the top: the skip link is the first stop and moves focus to `#main`.
    - Every nav link, CTA and form field is reachable with a visible focus ring. The canvas is never focused.
    - There is one h1 per page: `curl -s $BASE$p | grep -o '<h1[ >]' | wc -l` is 1 for every path.
    - axe in Playwright, or Lighthouse a11y, reports 0 serious or critical issues.
17. **3D runtime.**
    - Network panel: three.js and the R3F chunk load **after** the `load` event and stay within budget (`npx next build` output plus `.next/analyze` if `@next/bundle-analyzer` is used).
    - No console errors or hydration warnings.
    - Leaving the hero viewport stops rendering (FPS drops to 0, or the `frameloop` switches).
    - Lose the WebGL context (`WEBGL_lose_context`) and the poster appears.
18. **Production checks after deploy.**
    - `curl -sI https://raish-momin.vercel.app/ | grep -i x-robots-tag` must be empty in production. Preview deployments carry `noindex`, which is expected.
    - Search Console URL Inspection: run a live test on `/` and confirm the rendered HTML contains bio and projects. Resubmit the sitemap. Watch Core Web Vitals and the Generative AI performance report.
    - Field data: Vercel Speed Insights or CrUX p75 must show LCP ≤ 2.5 s, INP ≤ 200 ms and CLS ≤ 0.1 after 28 days.
    - Bing Webmaster Tools: submit the sitemap.

---

## 10. Owner decisions needed (blocking P1 items)
1. Public email for site, llms.txt, RSS and JSON-LD (replace `raishmomin@example.com`).
2. Canonical LinkedIn URL (`/in/raish-momin/` or `/in/raish-momin-ba8927253`).
3. Experience claim: "4+" or "5+" years (career start Sept 2021).
4. A real headshot photo for Person `image`, OG and author bio.
5. Whether X/Twitter `@raishmomin` exists. If not, remove `twitter:creator` and `SITE.twitter`.
6. Blog: pause the auto-generation cron, and approve consolidating the 35 near-duplicate posts with 301s.
7. Confirm you want AI **training** crawlers allowed (GPTBot, ClaudeBot, Google-Extended, Applebot-Extended), as requested. Search and answer bots (OAI-SearchBot, Claude-SearchBot, PerplexityBot) are allowed regardless.

## 11. Sources
- Google: [AI features and your website](https://developers.google.com/search/docs/appearance/ai-features) · [AI optimization guide](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide) · [JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics) · [Spam policies](https://developers.google.com/search/docs/essentials/spam-policies) · [Creating helpful content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) · [ProfilePage structured data](https://developers.google.com/search/docs/appearance/structured-data/profile-page) · [Google common crawlers / Google-Extended](https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers)
- Sitelinks search box retirement: [ppc.land](https://ppc.land/google-to-remove-sitelinks-search-box/), [cmlabs](https://cmlabs.co/en/news/google-to-remove-sitelink-search-box-by-november-21-2024)
- web.dev: [Core Web Vitals thresholds](https://web.dev/articles/defining-core-web-vitals-thresholds) · [LCP](https://web.dev/articles/lcp)
- OpenAI: [Overview of OpenAI crawlers](https://developers.openai.com/api/docs/bots)
- Anthropic: [Does Anthropic crawl data from the web…](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler) · [SER coverage](https://www.seroundtable.com/anthropic-updates-its-crawler-docs-40978.html)
- Perplexity: [Perplexity crawlers](https://docs.perplexity.ai/guides/bots)
- Apple: [Applebot-Extended summary](https://trakkr.ai/bots/applebot-extended) (verify against Apple's Applebot documentation)
- Bing: [SEJ: Bing adds GEO to guidelines, expands AI abuse definitions](https://www.searchenginejournal.com/bing-adds-geo-to-official-guidelines-expands-ai-abuse-definitions/)
- llms.txt status: [SER: Google: No AI system currently uses llms.txt](https://seroundtable.com/google-ai-llms-txt-39607.html) · [SEJ: llms.txt purely speculative](https://www.searchenginejournal.com/google-says-llms-txt-is-purely-speculative-for-now/575026/)
- Next.js: [JSON-LD guide](https://nextjs.org/docs/app/guides/json-ld) · [htmlLimitedBots](https://nextjs.org/docs/app/api-reference/config/next-config-js/htmlLimitedBots) · [html-bots.ts](https://github.com/vercel/next.js/blob/canary/packages/next/src/shared/lib/router/utils/html-bots.ts) · [Lazy loading](https://nextjs.org/docs/app/guides/lazy-loading)
- R3F: [Scaling performance](https://r3f.docs.pmnd.rs/advanced/scaling-performance)
- Data: `baseline/` (html, lighthouse, status, sitemap, robots, llms), `scan.json` (2,095 portfolios, 1,877 with status 200).
