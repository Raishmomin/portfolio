// Server-rendered SVG posters: what visitors without WebGL (or before the canvas fades
// in, or after a fallback) see behind the page, plus the shared CSS that animates signal
// pulses along their routes. Which poster:
// - without JS: the hero network on pages that open with the hero scene, the ambient
//   field everywhere else (CSS :has());
// - with JS (3D off, or the canvas not live): the stage island marks the section on the
//   viewport's centre line (data-poster = its scene, data-poster-stage = its data-stage)
//   and CSS shows that section's poster on its free side: the hero brain, the contact
//   globe, the services machines, the FAQ rail; the ambient field for the rest. A section
//   that draws its own static poster (the contact lane's .cg-poster) gets none.
// The pulses are stroke-dashoffset keyframes that run only when motion is allowed (the
// tri-state 3D/motion contract, components/reveal.tsx): html.js without
// data-motion="off" under prefers-reduced-motion: no-preference, or an explicit
// html[data-motion="on"].
import type { CSSProperties } from "react";
import { BASE_PITCH, BASE_YAW, brainLayout, COUNTS, KIND, orient, VIEW_HALF } from "./hero-layout";
import { CITY_GEO } from "./scenes/contact/geo";
import { decodeLand, LAND_H, LAND_W } from "./scenes/contact/land";
import type { NeuralData } from "./types";

const RUN = "nw-flow var(--nw-d,3.6s) linear infinite";
const MOTION = "@media (prefers-reduced-motion:no-preference){html.js:not([data-motion=off]) ";
const HERO_SECTION = "[data-section=hero]:not([data-scene]),[data-scene=hero]";
/** Posters a section can pick by its scene (any other scene shows the ambient field). */
const OWN = ["hero", "contact", "services", "faq"] as const;
const shown = [...OWN, "ambient"].map((k) => `[data-poster=${k}] [data-neural-poster=${k}]`).join(",");
const CSS = [
  ":root{--nw-ai:#3F5BD9}.dark{--nw-ai:#7C9CFF}",
  ".nw-e{fill:none;stroke:var(--nw-ai);stroke-opacity:.28}.dark .nw-e{stroke-opacity:.2}",
  ".nw-h{fill:none;stroke:var(--nw-ai);stroke-linecap:round;stroke-opacity:.05}.dark .nw-h{stroke-opacity:.07}",
  ".nw-n{fill:none;stroke-linecap:round}.nw-i{stroke:hsl(var(--foreground))}.nw-a{stroke:var(--nw-ai)}.nw-o{stroke:hsl(var(--primary))}",
  ".nw-p{fill:none;stroke-linecap:round;stroke-dasharray:10 200;stroke-dashoffset:10;opacity:0}",
  ".nw-pa{stroke:var(--nw-ai)}.nw-po{stroke:hsl(var(--primary))}",
  "@keyframes nw-flow{to{stroke-dashoffset:-100}}",
  `${MOTION}.nw-p{opacity:1;animation:${RUN}}}`,
  `html[data-motion=on] .nw-p{opacity:1;animation:${RUN}}`,
  "[data-paused] .nw-p,[data-paused] .nw-k{animation-play-state:paused}",
  ".nw-f{fill:none;stroke:var(--nw-ai);stroke-opacity:.16}.dark .nw-f{stroke-opacity:.12}",
  "[data-neural-poster]>svg{position:absolute;inset:0;width:100%;height:100%}",
  // The hero brain fills the same box as the canvas's core ([data-hero-core] in the home
  // hero): the free right side on desktop, a band above the text on phones.
  "[data-neural-poster=hero]>svg{inset:auto;left:1rem;top:calc(4rem + 1px + 1rem);width:calc(100% - 2rem);height:calc(36svh - 1.5rem)}",
  "@media (min-width:1024px){[data-neural-poster=hero]>svg{left:calc(max(0px,(100% - 1280px)/2) + 47rem);top:calc(4rem + 1px + 1.5rem);width:calc(100% - max(0px,(100% - 1280px)/2) - 48rem);height:calc(100svh - 4rem - 1px - 9.5rem)}}",
  ".nw-g{opacity:.4}.dark .nw-g{opacity:1}",
  ".nw-b{transform-box:view-box;transform-origin:50% 50%}",
  "@keyframes nw-breathe{50%{transform:scale(1.025) rotate(-1deg)}}",
  `${MOTION}.nw-b{animation:nw-breathe 9s ease-in-out infinite}}`,
  "html[data-motion=on] .nw-b{animation:nw-breathe 9s ease-in-out infinite}",
  "[data-paused] .nw-b{animation-play-state:paused}",
  "[data-neural-poster=ambient]>svg{opacity:.6}",
  // Section posters (globe, machines, rail) sit in the section's free side, as the 3D
  // framing does (framing.ts DESKTOP): content left → x 55–99 %, right → 1–45 %, a full
  // composition centred and quiet, a band in the top band; phones: a band above the text.
  "[data-neural-poster]>.nw-side{inset:auto;left:1rem;top:calc(4rem + 1px + 1rem);width:calc(100% - 2rem);height:calc(36svh - 1.5rem);opacity:.4}",
  "@media (min-width:1024px){[data-neural-poster]>.nw-side{left:55%;top:11%;width:44%;height:84%;opacity:1}" +
    "[data-poster-stage=right] [data-neural-poster]>.nw-side{left:1%}" +
    "[data-poster-stage=full] [data-neural-poster]>.nw-side{left:22%;width:56%;top:8%;height:88%;opacity:.4}" +
    "[data-poster-stage=band] [data-neural-poster]>.nw-side{left:4%;width:92%;top:8%;height:39%}}",
  ".nw-gs{fill:var(--nw-ai);fill-opacity:.07}.dark .nw-gs{fill-opacity:.1}",
  ".nw-ok{fill:hsl(var(--ok))}.nw-okr{fill:none;stroke:hsl(var(--ok));stroke-width:2.5;transform-box:fill-box;transform-origin:50% 50%}",
  "@keyframes nw-ping{from{transform:scale(1);opacity:.9}to{transform:scale(3.2);opacity:0}}",
  `${MOTION}.nw-k{animation:nw-ping 2.4s ease-out infinite}}`,
  "html[data-motion=on] .nw-k{animation:nw-ping 2.4s ease-out infinite}",
  ".nw-box{fill:hsl(var(--background));fill-opacity:.55;stroke:var(--nw-ai);stroke-opacity:.55}",
  // Which poster: without JS by the page (CSS :has), with JS by the centred section.
  "[data-neural-poster]{display:none}",
  `main:has(${HERO_SECTION}) [data-neural-stage]:not([data-poster]) [data-neural-poster=hero],main:not(:has(${HERO_SECTION})) [data-neural-stage]:not([data-poster]) [data-neural-poster=ambient]{display:block}`,
  "[data-poster] [data-neural-poster]{display:block;opacity:0;visibility:hidden;transition:opacity .6s,visibility 0s .6s}",
  `${shown}{opacity:1;visibility:visible;transition:opacity .6s}`,
].join("");

/** The posters' stylesheet; React hoists it into <head> once per page (href dedupes it). */
export function NeuralSvgStyle() {
  return (
    <style href="neural-svg" precedence="low">
      {CSS}
    </style>
  );
}

const W = 1600;
const H = 900;
const r1 = (v: number) => Math.round(v);

function dots(pts: { x: number; y: number }[], ids: number[]) {
  return ids.map((i) => `M${pts[i].x} ${pts[i].y}h0`).join("");
}

/** Every poster; CSS shows the one that matches the page or the centred section (aria-hidden by its stage). */
export function NeuralPoster({ data }: { data: NeuralData }) {
  return (
    <div data-neural-posters="" className="absolute inset-0 transition-opacity duration-700">
      <HeroPoster />
      <AmbientPoster />
      <ContactPoster city={data.facts?.city ?? ""} />
      <ServicesPoster count={data.services?.length || 4} />
      <FaqPoster />
    </div>
  );
}

/** mulberry32 (deterministic: the server always draws the same field). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The ambient field as an SVG: drifting-dot neurons, faint synapses, a few running signals. ≈4 KB. */
function AmbientPoster() {
  const rand = rng(23);
  const pts = Array.from({ length: 96 }, () => ({ x: r1(rand() * W), y: r1(rand() * H), z: rand() }));
  let d = "";
  const links: [number, number][] = [];
  pts.forEach((p, i) => {
    const near = pts
      .map((q, j) => ({ j, d: (q.x - p.x) ** 2 + (q.y - p.y) ** 2 }))
      .filter((o) => o.j !== i && o.d < 175 * 175)
      .sort((a, b) => a.d - b.d)
      .slice(0, 2);
    for (const o of near) {
      if (links.some(([a, b]) => (a === o.j && b === i) || (a === i && b === o.j))) continue;
      links.push([i, o.j]);
      d += `M${p.x} ${p.y}L${pts[o.j].x} ${pts[o.j].y}`;
    }
  });
  const near = pts.map((_, i) => i).filter((i) => pts[i].z >= 0.6);
  const far = pts.map((_, i) => i).filter((i) => pts[i].z < 0.6);
  const pulses = links.filter((_, k) => k % 9 === 4).slice(0, 10);
  return (
    <div data-neural-poster="ambient" className="absolute inset-0">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" fill="none">
        <path className="nw-f" strokeWidth="1" d={d} />
        <path className="nw-h" strokeWidth="16" d={dots(pts, near)} />
        {pulses.map(([a, b], i) => (
          <path
            key={i}
            className={`nw-p ${i % 4 === 3 ? "nw-po" : "nw-pa"}`}
            strokeWidth="2"
            pathLength={100}
            d={`M${pts[a].x} ${pts[a].y}L${pts[b].x} ${pts[b].y}`}
            style={{ animationDelay: `${(-i * 0.7).toFixed(1)}s`, "--nw-d": `${(4.2 + (i % 3) * 0.6).toFixed(1)}s` } as CSSProperties}
          />
        ))}
        <path className="nw-n nw-a" strokeOpacity=".55" strokeWidth="4" d={dots(pts, far)} />
        <path className="nw-n nw-a" strokeOpacity=".8" strokeWidth="6" d={dots(pts, near)} />
      </svg>
    </div>
  );
}

/** Local brain units → poster units (the SVG is a 1:100 orthographic view of the resting pose). */
const U = 100;

/** Dots as one path in nearest-neighbour order with relative moves: short deltas, small markup. */
function nearDots(pts: { x: number; y: number }[], ids: number[]) {
  if (!ids.length) return "";
  const left = new Set(ids);
  let cur = ids[0];
  left.delete(cur);
  let d = `M${pts[cur].x} ${pts[cur].y}h0`;
  while (left.size) {
    let best = -1;
    let bd = Infinity;
    for (const j of left) {
      const dd = (pts[j].x - pts[cur].x) ** 2 + (pts[j].y - pts[cur].y) ** 2;
      if (dd < bd) {
        bd = dd;
        best = j;
      }
    }
    const dx = pts[best].x - pts[cur].x;
    const dy = pts[best].y - pts[cur].y;
    d += `m${dx}${dy < 0 ? dy : ` ${dy}`}h0`;
    left.delete(best);
    cur = best;
  }
  return d;
}

/** The hero's neural core as an SVG: the brain's folds and hub neurons, a few synapse arcs and running signals. ≈8 KB, CSS-animated. */
function HeroPoster() {
  const L = brainLayout(COUNTS.poster);
  const n = L.kind.length;
  const pts = Array.from({ length: n }, (_, i) => {
    const [x, y, z] = orient(L.pos[i * 3], L.pos[i * 3 + 1], L.pos[i * 3 + 2], BASE_YAW, BASE_PITCH);
    return { x: r1(x * U), y: r1(-y * U), z };
  });
  const proj = (o: number) => {
    const [x, y] = orient(L.arcs[o], L.arcs[o + 1], L.arcs[o + 2], BASE_YAW, BASE_PITCH);
    return `${r1(x * U)} ${r1(-y * U)}`;
  };
  const arc = (a: number) => `M${proj(a * 9)}Q${proj(a * 9 + 3)} ${proj(a * 9 + 6)}`;
  const ids = (test: (i: number) => boolean) => pts.map((_, i) => i).filter(test);
  const front = (i: number) => pts[i].z >= 0;
  let short = "";
  const long: string[] = [];
  for (let a = 0; a < L.arcKind.length; a++) {
    if (L.arcKind[a]) long.push(arc(a));
    else if (a % 2 === 0) short += arc(a);
  }
  const hw = r1(VIEW_HALF.w * U) + 6;
  const hh = r1(VIEW_HALF.h * U) + 6;
  return (
    <div data-neural-poster="hero" className="absolute inset-0">
      <NeuralSvgStyle />
      <svg viewBox={`${-hw} ${-hh} ${hw * 2} ${hh * 2}`} fill="none">
        <defs>
          <radialGradient id="nw-aura">
            <stop offset="0" stopColor="var(--nw-ai)" stopOpacity=".2" />
            <stop offset="1" stopColor="var(--nw-ai)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle className="nw-g" r={hw} fill="url(#nw-aura)" />
        <g className="nw-b">
          <path className="nw-e" strokeWidth=".5" d={short} />
          {long.map((d, i) => (
            <path key={`l${i}`} className="nw-e" strokeWidth=".4" d={d} />
          ))}
          <path className="nw-n nw-a" strokeOpacity=".4" strokeWidth="1.2" d={nearDots(pts, ids((i) => L.kind[i] === KIND.fold && !front(i)))} />
          <path className="nw-n nw-a" strokeOpacity=".9" strokeWidth="1.5" d={nearDots(pts, ids((i) => L.kind[i] === KIND.fold && front(i)))} />
          <path className="nw-h" strokeWidth="7" d={nearDots(pts, ids((i) => L.kind[i] === KIND.hub))} />
          {long.slice(0, 9).map((d, i) => (
            <path
              key={`p${i}`}
              className={`nw-p ${i % 3 === 1 ? "nw-po" : "nw-pa"}`}
              strokeWidth="1.6"
              pathLength={100}
              d={d}
              style={{ animationDelay: `${(-i * 0.43).toFixed(2)}s`, "--nw-d": `${(2.8 + (i % 4) * 0.4).toFixed(1)}s` } as CSSProperties}
            />
          ))}
          <path className="nw-n nw-i" strokeOpacity=".85" strokeWidth="2.4" d={nearDots(pts, ids((i) => L.kind[i] === KIND.hub))} />
        </g>
      </svg>
    </div>
  );
}

/** Polyline of points as one path of relative moves (dots: "h0" caps). */
function relDots(pts: [number, number][]) {
  if (!pts.length) return "";
  let [cx, cy] = pts[0];
  let d = `M${cx} ${cy}h0`;
  for (let i = 1; i < pts.length; i++) {
    const [x, y] = pts[i];
    const dy = y - cy;
    d += `m${x - cx}${dy < 0 ? dy : ` ${dy}`}h0`;
    cx = x;
    cy = y;
  }
  return d;
}

/**
 * The contact globe as an SVG: a dot-matrix Earth (the contact scene's land mask) turned
 * so the profile city faces the viewer, with its green "available" beacon. ≈3 KB.
 */
function ContactPoster({ city }: { city: string }) {
  const R = 200;
  const ROWS = 40;
  const geo = CITY_GEO[city] ?? { lat: 23, lon: 72.6 };
  const yaw = (-geo.lon * Math.PI) / 180 + 0.5;
  const tilt = (geo.lat * Math.PI) / 180 + 0.12;
  const view = (lat: number, lon: number): [number, number, number] => {
    const x0 = Math.cos(lat) * Math.sin(lon);
    const y0 = Math.sin(lat);
    const z0 = Math.cos(lat) * Math.cos(lon);
    const x = x0 * Math.cos(yaw) + z0 * Math.sin(yaw);
    const z1 = -x0 * Math.sin(yaw) + z0 * Math.cos(yaw);
    return [x, y0 * Math.cos(tilt) - z1 * Math.sin(tilt), y0 * Math.sin(tilt) + z1 * Math.cos(tilt)];
  };
  const land = decodeLand();
  const near: [number, number][] = [];
  const far: [number, number][] = [];
  const step = Math.PI / ROWS;
  for (let i = 0; i < ROWS; i++) {
    const lat = -Math.PI / 2 + (i + 0.5) * step;
    const n = Math.max(1, Math.floor((2 * Math.PI * Math.cos(lat)) / step));
    const row = Math.min(LAND_H - 1, Math.floor(((Math.PI / 2 - lat) / Math.PI) * LAND_H));
    for (let j = 0; j < n; j++) {
      const lon = -Math.PI + (j + 0.5) * ((2 * Math.PI) / n);
      const col = Math.min(LAND_W - 1, Math.floor(((lon + Math.PI) / (2 * Math.PI)) * LAND_W));
      if (!land[row * LAND_W + col]) continue;
      const [x, y, z] = view(lat, lon);
      if (z < 0.08) continue;
      (z > 0.45 ? near : far).push([r1(x * R), r1(-y * R)]);
    }
  }
  const [px, py] = view((geo.lat * Math.PI) / 180, (geo.lon * Math.PI) / 180);
  const pin = { x: r1(px * R), y: r1(-py * R) };
  return (
    <div data-neural-poster="contact" className="absolute inset-0">
      <svg className="nw-side" viewBox="-250 -250 500 500" fill="none">
        <defs>
          <radialGradient id="nw-aura-c">
            <stop offset=".7" stopColor="var(--nw-ai)" stopOpacity=".18" />
            <stop offset="1" stopColor="var(--nw-ai)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle className="nw-g" r="250" fill="url(#nw-aura-c)" />
        <circle className="nw-gs" r={R} />
        <circle className="nw-e" r={R} strokeWidth="1.5" />
        <path className="nw-n nw-a" strokeOpacity=".45" strokeWidth="4" d={relDots(far)} />
        <path className="nw-n nw-a" strokeOpacity=".9" strokeWidth="5.5" d={relDots(near)} />
        <circle className="nw-okr nw-k" cx={pin.x} cy={pin.y} r="8" />
        <circle className="nw-ok" cx={pin.x} cy={pin.y} r="7" />
      </svg>
    </div>
  );
}

/** A small gear (machine) glyph centred at x, y. */
function gear(x: number, y: number, r: number) {
  let d = `M${x + r} ${y}a${r} ${r} 0 1 0 ${-2 * r} 0a${r} ${r} 0 1 0 ${2 * r} 0`;
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    d += `M${r1(x + Math.cos(a) * r)} ${r1(y + Math.sin(a) * r)}l${r1(Math.cos(a) * 5)} ${r1(Math.sin(a) * 5)}`;
  }
  return d;
}

/**
 * The services as machines on one production loop: a station per engagement (a gear and
 * its deliverable slots), joined by a conveyor that signals run along, shipping to an
 * output. ≈1.5 KB.
 */
function ServicesPoster({ count }: { count: number }) {
  const n = Math.max(2, Math.min(6, count));
  const cols = 2;
  const rows = Math.ceil(n / cols);
  const W2 = 520;
  const H2 = 120 + rows * 130;
  const boxes = Array.from({ length: n }, (_, i) => {
    const r = Math.floor(i / cols);
    const c = r % 2 === 0 ? i % cols : cols - 1 - (i % cols);
    return { x: 40 + c * 260, y: 60 + r * 130, w: 180, h: 92 };
  });
  const mid = (b: (typeof boxes)[number]) => [b.x + b.w / 2, b.y + b.h / 2] as const;
  let loop = `M20 ${mid(boxes[0])[1]}`;
  for (const b of boxes) {
    const [x, y] = mid(b);
    loop += `L${x} ${y}`;
  }
  const [lx, ly] = mid(boxes[n - 1]);
  const out = { x: lx, y: ly + 100 };
  loop += `L${out.x} ${out.y}`;
  return (
    <div data-neural-poster="services" className="absolute inset-0">
      <svg className="nw-side" viewBox={`0 0 ${W2} ${H2}`} fill="none">
        <path className="nw-e" strokeWidth="2" strokeDasharray="2 7" strokeLinecap="round" d={loop} />
        {[0, 1, 2].map((i) => (
          <path
            key={i}
            className={`nw-p ${i === 2 ? "nw-po" : "nw-pa"}`}
            strokeWidth="3"
            pathLength={100}
            d={loop}
            style={{ animationDelay: `${(-i * 2.1).toFixed(1)}s`, "--nw-d": "6.3s" } as CSSProperties}
          />
        ))}
        {boxes.map((b, i) => (
          <g key={i}>
            <rect className="nw-box" x={b.x} y={b.y} width={b.w} height={b.h} rx="12" strokeWidth="1.5" />
            <path className="nw-n nw-a" strokeOpacity=".8" strokeWidth="2" d={gear(b.x + 38, b.y + b.h / 2, 15)} />
            <path
              className="nw-n nw-a"
              strokeOpacity=".5"
              strokeWidth="5"
              d={[0, 1, 2].map((k) => `M${b.x + 78} ${b.y + 28 + k * 18}h${70 - k * 16}`).join("")}
            />
          </g>
        ))}
        <path className="nw-n nw-a" strokeOpacity=".7" strokeWidth="12" d={`M20 ${mid(boxes[0])[1]}h0`} />
        <path className="nw-n nw-o" strokeWidth="16" d={`M${out.x} ${out.y}h0`} />
      </svg>
    </div>
  );
}

/** A question mark (stroke path) centred at x, y. */
const ask = (x: number, y: number) => `M${x - 7} ${y - 8}a7 7 0 1 1 9 6.7c-1.6.6-2 1.7-2 3.6M${x} ${y + 9}h0`;

/**
 * The FAQ as a rail of questions: a node per question on a vertical rail, one open,
 * threaded to the small constellation of facts that answers it, beside a field of
 * question marks. ≈1.5 KB.
 */
function FaqPoster() {
  const rand = rng(7);
  const nodes = [0, 1, 2, 3, 4, 5].map((i) => 50 + i * 62);
  const open = 2;
  const oy = nodes[open];
  const ans: [number, number][] = [
    [300, oy - 44],
    [352, oy - 8],
    [318, oy + 40],
    [400, oy + 22],
    [420, oy - 40],
    [462, oy + 6],
  ];
  const field: [number, number][] = Array.from({ length: 34 }, () => [r1(170 + rand() * 330), r1(20 + rand() * 380)]);
  const marks = [
    [250, 60],
    [455, 300],
    [215, 345],
  ];
  const thread = `M86 ${oy}C170 ${oy} 210 ${oy - 30} ${ans[0][0]} ${ans[0][1]}`;
  const web = `M${ans[0][0]} ${ans[0][1]}L${ans[1][0]} ${ans[1][1]}L${ans[2][0]} ${ans[2][1]}M${ans[1][0]} ${ans[1][1]}L${ans[3][0]} ${ans[3][1]}L${ans[5][0]} ${ans[5][1]}M${ans[1][0]} ${ans[1][1]}L${ans[4][0]} ${ans[4][1]}L${ans[5][0]} ${ans[5][1]}`;
  return (
    <div data-neural-poster="faq" className="absolute inset-0">
      <svg className="nw-side" viewBox="0 0 520 420" fill="none">
        <path className="nw-e" strokeWidth="2" d={`M70 20V400`} />
        <path className="nw-p nw-pa" strokeWidth="3" pathLength={100} d="M70 20V400" style={{ "--nw-d": "5s" } as CSSProperties} />
        <path className="nw-n nw-a" strokeOpacity=".25" strokeWidth="4" d={relDots(field)} />
        <path className="nw-n nw-a" strokeOpacity=".35" strokeWidth="2.5" d={marks.map(([x, y]) => ask(x, y)).join("")} />
        <path className="nw-e" strokeWidth="1.5" d={web} />
        <path className="nw-e" strokeWidth="2" d={thread} />
        <path
          className="nw-p nw-po"
          strokeWidth="3"
          pathLength={100}
          d={thread}
          style={{ animationDelay: "-1.2s", "--nw-d": "3.2s" } as CSSProperties}
        />
        <path className="nw-n nw-a" strokeOpacity=".9" strokeWidth="9" d={relDots(ans)} />
        {nodes.map((y, i) => (
          <circle key={i} cx="70" cy={y} r={i === open ? 11 : 8} className="nw-box" strokeWidth={i === open ? 3 : 1.5} />
        ))}
        <path className="nw-n nw-o" strokeWidth="10" d={`M70 ${oy}h0`} />
      </svg>
    </div>
  );
}
