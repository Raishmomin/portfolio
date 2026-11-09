# Visual 3D/motion research: full-site motion

Saved to `/tmp/claude-1000/-home-raish-raish-my-app/ffd02af8-1b89-4a04-a12d-8deb02a3d03d/scratchpad/data/fm/research-visual.md`.

**Sources:** Codrops returned 403, so the Codrops points come from search snippets. The Awwwards pages are video-only, so I could only check their titles and tags, not watch the motion. Everything here is a pattern; nothing is copied.

## 1. Composition rhythm

1. **Use one signature moment, then a quieter supporting cast.** Award juries reward restraint, and "animation with no hierarchy" is the most common failure ([hontran](https://www.hontran.dev/blog/how-to-build-an-award-winning-portfolio-site)).
   - Our signature moments are the hero network and the experience journey.
   - Every other section stays quieter.
2. **Change the layout every section** (left → full → band → right) and alternate density: a dense grid, then an airy statement. Today all 10 sections use a left panel with the 3D on the right, and that repetition is the problem.
3. **Alternate the motion type as well.** After a scrubbed or pinned section, use one where content only animates in. Never put two pins next to each other.
4. **Vary only the layout and keep everything else the same:** `.panel`, section head, easing, depth and colour roles. That is what makes it one design language.
5. **Treat the 3D as one continuous stage that tells a story.**
   - Scenes swap at section boundaries, with a crossfade and an eased camera reframe.
   - DOM and WebGL must run on one clock. HAOQI's one-frame drift came from two separate animation loops, so read `scrollY` inside `useFrame`.
6. **Make the scene react to the content.**
   - A hovered card brings its 3D twin forward.
   - The top card of a deck sets `data-focus-id`.
   - Horizontal-scroll progress moves the camera.
   - This link is what makes the cards themselves feel animated.
7. **Keep one main moving thing per viewport.** While cards animate in or scrub, the scene dims and slows.
8. **Use panels only for dense text.** Elsewhere, cards float over a dark overlay (`full`), so the stage reads as full-bleed rather than boxed.

## 2. Pattern catalog

Home rhythm: hero L · stack F · experience B + horizontal scroll · ai R + deck · work F · services L · cta F · writing B · faq R · contact F. No two neighbouring sections share a layout.

**Conflict with the spec:** the spec makes both AI and Work stacked decks, and they sit next to each other. Two decks in a row repeats the problem we are fixing. I recommend AI keeps the deck (5 cards, each telling one project's story) and Work becomes a grid where cards enter in a wave.

### Home

| Section | Layout | Card motion | 3D | Ref |
|---|---|---|---|---|
| hero | left | h1, subtitle and intro stay static. Stat tiles rise and count up, CTAs follow the cursor (magnetic), and the caption chip pops in last. | The network is framed right and leans toward the cursor. On scroll-out the camera pulls back and hands over to the next scene. | [hontran](https://www.hontran.dev/blog/how-to-build-an-award-winning-portfolio-site) |
| stack | full | Category cards float separately and enter in a wave from the centre. Chips pop in. Hovering a row sets the focus. | The graph is centred and dimmed to about .35 behind a dark overlay. The hovered node and its edges flare. | [Calautti](https://www.awwwards.com/inspiration/cards-parallax-claudio-calautti-portfolio-23) |
| experience | band + horizontal scroll | Role cards sit on a pinned horizontal track and swing in from depth (`rotateY(-18deg)`, `z:-120→0`) using `containerAnimation`. The tenure bar draws. | The career path owns a 40–45vh band. The camera rides the curve as the track scrolls. Labels stay inside the band, which fixes the clipped label. | [Luminar](https://www.awwwards.com/inspiration/career-card-scroll-luminar) |
| ai | right | 5 cards in a sticky deck. Inside each card the pipeline stages pop in, then the connectors draw. | The pipeline is framed left. The top card sets the focus, and the scene rebuilds that project's stages. | [Join Talent](https://www.awwwards.com/inspiration/stacking-cards-on-scroll-join-talent) |
| work | full | One featured card spans two columns, then a grid of cards enters in a wave. Cards are opaque `.panel`s with tilt and a cursor spotlight. | The project windows sit behind a dark overlay. The hovered card's 3D twin moves forward (z +.6) while the others recede. No 3D text labels. | [Cynx](https://www.awwwards.com/inspiration/work-overview-cynx-portfolio-2026) |
| services | left | Rows flip down from their top edge (`rotateX(-70deg)→0`), with a spotlight on each row. The arrow moves 8px on hover. | `ambient`, framed right. | [Closer](https://www.awwwards.com/inspiration/scroll-triggered-animation-closer-cards) |
| cta | full | The large serif lines rise in. A light sweeps the border once on enter. Magnetic CTAs. | `ambient`, centred, with one pulse wave when the section reaches the middle of the screen. | [Codrops cinematic](https://tympanus.net/codrops/2025/11/19/how-to-build-cinematic-3d-scroll-experiences-with-gsap/) |
| writing | band | A scrolling tag ticker runs under the band. The 3 post cards zoom in as a wave. | `ambient` band, 28–32vh, with no text on it. | [Etherfuse](https://www.awwwards.com/inspiration/scrolling-cards-etherfuse) |
| faq | right | Items enter in a wave. Answers open and close in .45s (`grid-template-rows 0fr→1fr`). | `ambient`, framed left. | [cruip](https://cruip.com/how-to-create-a-spotlight-card-hover-effect-with-tailwind-css/) |
| contact | full | The form card zooms in, the fields follow one after another, and the chips pop in. | The contact scene is centred, with a dark overlay under the form. | [HAOQI](https://tympanus.net/codrops/2026/08/15/inside-haoqi-design-letting-dom-and-webgl-share-a-retro-futurist-stage/) |

### Subpages

Every subpage should mount `NeuralStage`. Today they have no 3D canvas at all.

| Page | Layout | Card motion | 3D | Ref |
|---|---|---|---|---|
| about | left hero → band | The photo card flips in, the timeline line draws, and the value cards enter in a wave. | hero → experience | [Dumeme](https://www.awwwards.com/inspiration/about-cards-scroll-dumemearts) |
| skills | full | Category groups enter in a wave, chips pop in, and hover sets the focus. | stack | [Atelier UI](https://tympanus.net/codrops/?p=124298) |
| experience | band + horizontal scroll | The same component as home with every role. Bullet points follow one after another in each card. | experience | [containerAnimation](https://gsap.com/docs/v3/Plugins/ScrollTrigger/) |
| projects | hero right → full grid | Cards enter in a wave on load. When a filter changes, cards slide to their new places (hand-written FLIP, .6s expo.out), and leaving cards shrink to .92 and fade out in .25s. Skip GSAP's Flip plugin to stay under the 50KB GSAP budget. | work, framed left | [Marco Who](https://www.awwwards.com/inspiration/portfolio-cards-its-marco-who) |
| services (and each service page) | left → full | Feature cards enter in a wave, process connectors draw, and pricing cards get the cursor spotlight. | ambient | [ZeroCO2](https://www.awwwards.com/inspiration/services-card-zeroco2) |
| blog index | band → grid | Scrolling tag ticker. Post cards zoom in as a wave. | ambient band | [Kita](https://www.awwwards.com/inspiration/scrolling-cards-kita-sunnastrahl) |
| blog post | band hero only | The h1 and the article text stay static. The table-of-contents line draws as you read. Author box and related posts rise in. | ambient, paused once the hero scrolls past | [hontran](https://www.hontran.dev/blog/how-to-build-an-award-winning-portfolio-site) |
| contact | full | Same as the home contact section. | contact | [HAOQI](https://tympanus.net/codrops/2026/08/15/inside-haoqi-design-letting-dom-and-webgl-share-a-retro-futurist-stage/) |

## 3. Card animation recipes

Shared values: expo.out = `cubic-bezier(.16,1,.3,1)`, perspective 1200px.

- **Rise (default entrance)**
  - From `opacity:0; translate3d(0,48px,-140px) rotateX(14deg)`, origin `50% 100%`, 1.0s expo.out.
  - Trigger at `top 85%` with `once:true`.
  - Each inner part (`[data-card-part]`) moves `y:16→0` over .7s, the first at +.12s and each next one +.08s later.
  - Finish with `clearProps:'transform'` so the hover tilt can take over.
- **Zoom:** from `scale(.88) translateZ(-220px)` at opacity 0, over 1.1s. Never animate `filter`.
- **Flip:** `rotateX(-70deg)` from origin `50% 0`, with `backface-visibility:hidden`, over 1.1s. Use it on short cards only, and never leave text rotated more than 15deg once it has landed.
- **Wave across a grid**
  - Delay = `(row + col) × each`, where `each = min(.09, .56 / steps)`, which caps it at 8 steps.
  - In GSAP: `stagger:{each:.07, grid:'auto', from:'start'}` (or `from:'center'` for clusters).
- **Sticky deck**
  - Cards use CSS `position:sticky; top:calc(88px + i*14px)`, so 14px of each earlier card stays visible.
  - GSAP scrubs only the card being covered: `scale 1→.92`, a dark overlay `0→.5` (not a filter), and a slight `rotateX 0→4deg` tilt back from the top. Use `scrub:true, ease:'none'`.
  - Keep each card at 70vh or less, because tall cards fade before people finish reading them ([Admin Bar](https://theadminbar.com/how-to-create-stacking-cards-with-css-in-generateblocks/)).
  - When a card receives keyboard focus, scroll it into place.
  - The last card does not shrink.
- **Horizontal scroll**
  - `x:()=>-(track.scrollWidth-innerWidth)`, `ease:'none'`, `pin:true`, `scrub:.6`, `invalidateOnRefresh:true`, `anticipatePin:1`.
  - Cards inside the track animate with `containerAnimation`, which needs the linear ease above.
  - Snapping to each card at `1/(n-1)` is optional.
  - On keyboard focus, convert the card's `offsetLeft` into a page scroll position.
  - Keep the pinned distance to 2.5 screen heights or less.
- **Spotlight and border light**
  - One rAF-throttled `pointermove` listener on the group writes `--mx/--my` to each card. Don't keep the pointer position in React state ([21st](https://21st.dev/blog/react-spotlight-effect-components)).
  - Border glow: a `::before` layer with `padding:1px`, `radial-gradient(220px circle at var(--mx) var(--my), hsl(var(--primary)/.55), transparent 60%)`. Mask it so only the 1px border shows (`linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0)`), and fade it in over 300ms.
  - Inner glow: an `::after` layer with a 420px radial gradient at white/.05.
  - Light sweep: animate an `@property --sweep` conic angle from 0 to 360deg over 1.2s, once each time the pointer enters.
- **Tilt:** at most ±6deg, glare at most .12, eases back in .6s. Mouse and trackpad only.
- **Chip pops:** `scale .6→1, y 8→0` over .5s with `back.out(1.6)`, 35ms apart. After 8 chips, the rest land together. This is the only place a bouncy ease is used.
- **Connector lines:** `pathLength="1"`, dasharray 1, dashoffset `1→0`, scrubbed from `top 75%` to `bottom 60%`. Nodes pop in at the matching points.
- **Ticker (marquee):**
  - Duplicate the row, hiding the copy from screen readers, and slide it `translateX(-50%)` at a steady ~50px/s.
  - Fade the edges over 8% on each side.
  - Pause on hover and keyboard focus.
  - Don't let scroll speed skew it.

## 4. Mobile (below 1024px)

- **No pins, decks or horizontal scroll.**
  - Experience and writing become rows you swipe natively: `overflow-x:auto; scroll-snap-type:x mandatory; scroll-padding-inline:16px`, with each card 85vw wide.
  - Decks become a plain list where cards rise in.
- **Lighter entrances:** .7s, `y:32`, `z:-80`, `rotateX` 8deg or less, and at most 4 steps of stagger.
- **3D appears only at section openings.**
  - Show a 40–56svh band above the section head (hero, experience, contact).
  - Behind body text, dim the scene to .2 or less under a solid overlay.
  - No 3D text labels.
  - Cap the pixel ratio at 1.5, pause the scene when it is off-screen, and draw fewer nodes.
  - Use `svh` units, never `vh`.
- **Touch:** no tilt or spotlight. Instead, run one border sweep when a card enters the view, and give taps a 120ms `scale(.98)` press.
- **Data saver or low-memory phones** (`saveData`, low `deviceMemory`) get the static or SVG version.

## 5. What to avoid

- **Things that cause motion sickness:**
  - big zooms
  - camera moves larger than about .3 rad per section
  - text parallax above 10%
  - skewing content with scroll speed
  - constant rotation next to text
- **Unreadable text:**
  - a live scene behind text without a dark overlay of at least .85 (aim for 4.5:1 contrast or better)
  - 3D labels over panels (today the Work labels bleed into Services)
  - text that stays rotated after it lands
- **Jank:**
  - animating `filter`, `box-shadow` or layout properties
  - backdrop-filter on moving cards
  - one listener per card
  - entrances that replay on every scroll pass (use `once`, and keep scrubbing for the deck, horizontal scroll and line draws)
- **Things that hurt trust on a hiring/freelance portfolio:**
  - loading screens
  - replacing the cursor
  - content you can only see on hover
  - typing effects that delay the real text
  - bouncy easing on serious content
  - horizontal scroll everywhere
  - a contact button you can't reach within one screen
  - counters that run again every time you scroll back
- **Too much pinning:**
  - at most one pin per page
  - no more than 3 screen heights of pinned scrolling in total
  - never two scrubbed sections back to back