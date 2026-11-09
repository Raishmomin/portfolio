/**
 * Site-wide scroll/motion system — the contract for every lane.
 *
 * Mounted once in app/layout.tsx (<MotionProvider />). Nothing to import in pages: add
 * the data attributes below to server-rendered markup. All of it is progressive
 * enhancement. The server HTML is final and fully visible without JS, under reduced
 * motion and with the header's 3D/motion toggle off.
 *
 * WHEN IT RUNS
 *   The motion preference is tri-state: html[data-motion]="on" overrides the OS
 *   reduced-motion setting, "off" disables everything, and no attribute follows
 *   prefers-reduced-motion. It changes live through the window "cp:3d" event. While
 *   motion is allowed, gsap + ScrollTrigger (~48 KB gzip, never in the initial JS) load
 *   after `load` + idle. html.motion-live is set while the runtime is active. Content
 *   that was already on screen when the runtime bound it never re-animates. Turning
 *   motion off reverts every hook and restores the original DOM.
 *
 * HOOKS
 *   [data-reveal]               Fade + rise when ~15% of the element is in view. CSS + the
 *                               head script (components/reveal.tsx), so it works before
 *                               gsap loads. Siblings entering together are staggered
 *                               70 ms apart (max 8 steps).
 *     data-reveal-delay="<ms>"  extra delay before it plays
 *     data-reveal-y="<px>"      rise distance (default 16; negative drops from above)
 *     The head script adds data-in before hydration, so the element needs
 *     suppressHydrationWarning. revealProps() from components/reveal.tsx adds it:
 *     {...revealProps({ delay: 0.1, y: 24 })}. Never put it on the h1, the hero
 *     subtitle or intro text (LCP).
 *
 *   [data-split]                h2/h3 only (ignored on h1 and inside h1). Words rise out
 *                               of a slight blur with a stagger on enter. Server HTML
 *                               stays plain text; the split exists only while waiting or
 *                               animating. The accessible name is unchanged: a heading
 *                               gets aria-label + aria-hidden words, or, when it wraps a
 *                               link/button, keeps its words exposed.
 *
 *   [data-parallax="-1..1"]     Scrubbed translateY (up to ±70px) while it crosses the
 *                               viewport. Positive = foreground (faster than the page),
 *                               negative = background. Decorative elements only. GSAP
 *                               owns `transform` on it, so don't put CSS transforms there.
 *
 *   [data-count]                Counts up from 0 to the number already in the server
 *                               HTML ("50+", "3x", "1,200", "4.5") on enter. Width is locked
 *                               to the final number (no layout shift), with no live region.
 *                               The original text node returns afterwards. Add
 *                               `tabular-nums` on the element.
 *
 *   [data-pin]                  Desktop ≥1024px only. CAUTION: a ScrollTrigger pin is
 *                               position:fixed, which Chrome reports as a ~1.0 layout shift
 *                               where it starts and ends (CLS). Prefer [data-deck] or
 *                               [data-hscroll] (sticky). Pins the element while its
 *                               [data-step] descendants are stepped through, then releases
 *                               it. data-pin="<n>" sets the scroll length per step in % of
 *                               the viewport height (default 70). Exposed state:
 *                                 element:   --pin-progress (0..1), data-pin-step="<i>",
 *                                            data-pinned while pinned
 *                                 [data-step]: data-active (current), data-past (earlier),
 *                                            --step-progress (0..1)
 *                                 event:     "cp:pin" (bubbles) detail { progress, step, steps }
 *                               Mobile, no-JS and motion off show every step as a
 *                               normal list, so never hide steps by default. The
 *                               .pin-dim utility dims inactive steps only while pinned.
 *
 *   [data-tilt]                 Pointer:fine only. 3D tilt toward the pointer, a 14px
 *                               lift and a glare highlight (an aria-hidden
 *                               span.tilt-glare appended inside; the element gets
 *                               position:relative if it was static). data-tilt="<deg>"
 *                               sets the max angle (default 6). Use it on cards
 *                               (article/div/a/li), not on a <ul>. GSAP owns `transform`
 *                               on it, so don't add CSS hover transforms there.
 *
 *   [data-magnetic]             Pointer:fine only. Leans toward the pointer (max 12px)
 *                               and eases back on leave. For primary CTAs. GSAP owns
 *                               `transform` on it.
 *
 *   CARD HOOKS (shared tokens: expo.out = cubic-bezier(.16,1,.3,1) for entrances; 0.9–1.2 s;
 *   stagger 60–90 ms, max 8 steps; perspective 1200px). Ownership: GSAP owns `transform` on
 *   [data-card], [data-tilt], [data-parallax] and [data-magnetic], so never put two of them
 *   on one element; nest instead (<li data-card><article data-tilt data-spotlight>).
 *   Never combine [data-card] with [data-reveal] (both drive opacity).
 *
 *   [data-card]                 3D entrance from depth when it enters (top at 88% of the
 *                               viewport), once. Values: "rise" (default:
 *                               translate3d(0,48px,-140px) rotateX(14deg)), "flip" (falls
 *                               open from its top edge, rotateX(-70deg); short cards/rows),
 *                               "swing" (door-swing in from the right, rotateY(-22deg)),
 *                               "zoom" (scale .88 from z -220px). Phones get shallower poses.
 *                               Cards already on screen when motion starts never re-animate.
 *     [data-card-part]          Inside a card: rises in after the card lands, cascading in
 *                               DOM order (title, then text, then chips…).
 *     [data-card-part="pop"]    Its CHILDREN pop in (scale .6 → 1, back.out; 35 ms apart,
 *                               the 9th+ land together). For chip/pill lists.
 *
 *   [data-card-group]           Container. Its [data-card]s enter as a wave: cards entering
 *                               together are staggered by grid distance (row + column) from
 *                               the first. Sets perspective on the container while bound.
 *                               Nested groups own their own cards.
 *
 *   [data-deck]                 Desktop ≥1024 only. Its direct [data-card] children become a
 *                               sticky stack: each card sticks at top 88px + i·14px and the
 *                               next slides over it while the covered card scales to .92
 *                               and dims (--deck 0..1, scroll-linked). Native sticky, no pin.
 *                               The shrink applies to the card's first child (its surface),
 *                               so wrap the content: <li data-card><article>…</article></li>.
 *                               Keep each card ≤ 70vh. Exposed: data-deck-live (deck),
 *                               data-deck-index, data-deck-top (the card on top), and a
 *                               bubbling "cp:deck" event { index, count, id } where id is the
 *                               top card's data-focus-id. Focusing a covered card scrolls it
 *                               back on top. Mobile, no-JS and motion off: a normal list.
 *                               Combine with data-card-group for the entrance wave.
 *
 *   [data-hscroll]              Desktop ≥1024 and ≥640px tall only. The section grows by the
 *     [data-hscroll-track]      track's overflow and the track's PARENT (a wrapper such as the
 *                               container, never the section itself) becomes a sticky
 *                               100svh frame while vertical scroll drives the track sideways
 *                               (scrubbed). Native position:sticky, not a ScrollTrigger pin:
 *                               no layout shift, compositor scrolling. While live:
 *                               data-hscroll-live on the section, data-hscroll-frame on the
 *                               wrapper, the track is one row (app/globals.css) and each
 *                               child's width comes from style="--hs-w: 30rem". The frame
 *                               runs full-bleed and fades the track out at the viewport edges
 *                               (the first / last item rest fully visible at the ends). Cards on
 *                               the first screen rise in with the section, the rest swing in
 *                               from depth as the track brings them in (put data-card-group on
 *                               the track; on phones the group's wave takes over). The reading
 *                               line sits at 50% of the viewport and sweeps to 92% over the last
 *                               part of the journey. Exposed on the section: --hscroll-progress
 *                               (0..1), --hscroll-fill (share of the track behind the line),
 *                               --hscroll-line (the line, px from the viewport's left) — these
 *                               three change every tick and are registered non-inherited (read
 *                               them on the section itself, e.g. its inline style),
 *                               --hscroll-band (px of free frame above the track),
 *                               --hscroll-edge (px faded at each edge); on track children
 *                               data-lit once the line passes their start and --hs-lit (0..1,
 *                               how far the line has crossed them); and a bubbling
 *                               "cp:hscroll" event { progress, line }. Keyboard focus
 *                               inside the track scrolls the page so the item is centred;
 *                               in-page links to the section land at the journey's start.
 *                               Without it (phones, no-JS, motion off) the track is your
 *                               static layout: every item stays in the DOM and focusable.
 *                               Binds only while the section is still below the fold (a
 *                               reader landing on a later #hash keeps the static layout, so
 *                               nothing moves under them). At most one per page.
 *
 *   [data-spotlight]            Pointer:fine only. A soft light follows the pointer inside
 *                               the element (under its content, so contrast is unchanged)
 *                               and along its 1px border, and one light sweep runs round the
 *                               border on enter. Writes --mx/--my (px). Works on the same
 *                               element as data-tilt. The element gets position:relative +
 *                               isolation; it uses ::before/::after, so not with .border-glow.
 *
 *   [data-draw]                 On an <svg> (its path/line/polyline/circle/rect) or a single
 *                               shape: the stroke draws with scroll (scrubbed, top 85% →
 *                               bottom 55%). Fully drawn without motion.
 *
 *   [data-marquee]              Endless ticker. Its first child is the row (e.g. a <ul>);
 *                               the row's items are cloned once at runtime (aria-hidden +
 *                               inert), the row slides at ~45px/s on the compositor, pauses
 *                               on hover/focus and offscreen, and gets a Pause button
 *                               (WCAG 2.2.2). Give items right padding, not a flex gap, so
 *                               the loop is seamless. Static: a centred, wrapping row (also
 *                               kept when the ticker was already on screen at bind time).
 *
 *   Chrome, always on while motion runs: a 2px scroll-progress hairline at the top
 *   (.motion-progress) and a soft cursor glow in the AI accent (.motion-glow, pointer:fine).
 *
 *   [data-section]              While motion runs, sections outside the viewport (±10%) get
 *                               data-offscreen and their decorative CSS loops (.status-dot,
 *                               .ai-pulse, .exp-node, .stage-chip::after) pause. Add any new
 *                               infinite decorative loop to that rule in app/globals.css.
 *
 * DESIGN TOKENS AND UTILITIES (app/globals.css, tailwind.config.js)
 *   --ai / Tailwind `ai`       AI accent: dark #7C9CFF (7.4:1 on ink), light #3F5BD9
 *                              (5.1:1 on paper). Text-safe on bg and panels in both themes:
 *                              text-ai, border-ai/30, bg-ai/10, shadow glows.
 *   .panel                     bg-background/85, 1px border, rounded-xl. Text panel / card
 *                              surface over the 3D stage. No backdrop-filter.
 *   .panel-ai                  .panel with an AI-tinted border and a soft outer glow.
 *   .glow-ai                   Soft AI halo (box-shadow only).
 *   .border-glow               1px gradient border (AI → primary) on a positioned element,
 *                              via an ::after mask. Content is untouched.
 *   .scrim-l / .scrim-b        Readability gradients for text over the canvas (left → right,
 *                              bottom → top). Use behind hero copy.
 *   .scrim-c                   Centred radial scrim for data-stage="full" sections (content
 *                              floating over the centred scene).
 *   .ai-pulse                  Slow glow pulse for "live"/AI indicators. Motion-gated like
 *                              .status-dot.
 *   .pin-dim                   Put it on a [data-pin] element to dim its inactive
 *                              [data-step]s while pinned.
 */
export { MotionProvider } from "./motion-provider";
