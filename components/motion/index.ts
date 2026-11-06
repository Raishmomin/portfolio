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
 *   [data-pin]                  Desktop ≥1024px only. Pins the element while its
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
 *   Chrome, always on while motion runs: a 2px scroll-progress hairline at the top
 *   (.motion-progress) and a soft cursor glow in the AI accent (.motion-glow, pointer:fine).
 *
 * DESIGN TOKENS AND UTILITIES (app/globals.css, tailwind.config.js)
 *   --ai / Tailwind `ai`       AI accent: dark #7C9CFF (7.4:1 on ink), light #3F5BD9
 *                              (5.1:1 on paper). Text-safe on bg and panels in both themes:
 *                              text-ai, border-ai/30, bg-ai/10, shadow glows.
 *   .panel                     bg-background/80, 1px border, rounded-xl. Text panel over the
 *                              3D stage. No backdrop-filter.
 *   .panel-ai                  .panel with an AI-tinted border and a soft outer glow.
 *   .glow-ai                   Soft AI halo (box-shadow only).
 *   .border-glow               1px gradient border (AI → primary) on a positioned element,
 *                              via an ::after mask. Content is untouched.
 *   .scrim-l / .scrim-b        Readability gradients for text over the canvas (left → right,
 *                              bottom → top). Use behind hero copy.
 *   .ai-pulse                  Slow glow pulse for "live"/AI indicators. Motion-gated like
 *                              .status-dot.
 *   .pin-dim                   Put it on a [data-pin] element to dim its inactive
 *                              [data-step]s while pinned.
 */
export { MotionProvider } from "./motion-provider";
