// Server Component: an isometric SVG of the hero formation. It is the LCP-safe
// underlay the canvas fades in over, the fallback whenever the 3D is gated off,
// and (variant "motif") the small decorative cluster on subpages. One <use> per pod
// keeps the inline markup small; the markup is built from numbers only.
import { POSTER_PRESETS, VIEW_MARGIN } from "./config";
import { buildFormations, POD, projectX, projectY, STATUS } from "./formations";
import type { ClusterVariant, FormationData } from "./types";

const S = 24; // SVG units per world unit
const H = POD / 2;
const r1 = (v: number) => Math.round(v * 10) / 10;
const pt = (x: number, y: number, z: number) => `${r1(projectX(x, y, z) * S)} ${r1(-projectY(x, y, z) * S)}`;
const face = (corners: number[][]) => `M${corners.map(([x, y, z]) => pt(x * H, y * H, z * H)).join("L")}Z`;

// Visible faces from the camera octant: top (+y), left (+z), right (+x).
const TOP = face([[-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1]]);
const LEFT = face([[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]);
const RIGHT = face([[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]]);

// Three tones per status colour. Neutral pods: bone over the dark panel; in light, ink
// over the warm hairline tone (paper-warm, not concrete grey). The scene mixes the same
// ratios in sRGB (scene.tsx readTheme). That colour sits on the <svg> (in the document
// tree, so `.dark` matches) and is inherited into the <use> shadow trees, where
// ancestor selectors would not match.
const STYLE =
  ".cp-svg{color:color-mix(in srgb,hsl(var(--foreground)) 30%,hsl(var(--border)))}" +
  ".dark .cp-svg{color:color-mix(in srgb,hsl(var(--foreground)) 88%,hsl(var(--card)))}" +
  ".cp-o{color:hsl(var(--ok))}.cp-p{color:hsl(var(--primary))}" +
  ".cp-t{fill:currentColor}.cp-l{fill:color-mix(in srgb,currentColor 74%,#000)}" +
  ".cp-r{fill:color-mix(in srgb,currentColor 58%,#000)}" +
  ".cp-g{fill:hsl(var(--foreground)/.05);stroke:hsl(var(--border));stroke-width:1}";

const STATUS_CLASS: Record<number, string> = {
  [STATUS.running]: "n",
  [STATUS.ready]: "o",
  [STATUS.pending]: "p",
};

function posterMarkup(data: FormationData, variant: ClusterVariant, count: number) {
  const { layout } = POSTER_PRESETS[variant];
  const f = buildFormations(data, count, { layout }).hero;
  const id = `cp${variant[0]}${count}`; // unique per poster: the sticky panel ships two

  const defs = Object.values(STATUS_CLASS)
    .map((c) => `<g id="${id}-${c}"${c === "n" ? "" : ` class="cp-${c}"`}><path class="cp-t" d="${TOP}"/><path class="cp-l" d="${LEFT}"/><path class="cp-r" d="${RIGHT}"/></g>`)
    .join("");

  let plates = "";
  for (let i = 0; i < f.plates.length; i += 4) {
    const [x, z, w, d] = [f.plates[i], f.plates[i + 1], f.plates[i + 2] / 2, f.plates[i + 3] / 2];
    plates += `<path class="cp-g" vector-effect="non-scaling-stroke" d="M${pt(x - w, 0, z - d)}L${pt(x + w, 0, z - d)}L${pt(x + w, 0, z + d)}L${pt(x - w, 0, z + d)}Z"/>`;
  }

  // Painter's order: farthest from the camera first.
  const order = Array.from({ length: f.visible }, (_, i) => i);
  const depth = (i: number) => f.positions[i * 3] * 12 + f.positions[i * 3 + 1] * 10 + f.positions[i * 3 + 2] * 12;
  order.sort((a, b) => depth(a) - depth(b));
  let pods = "";
  for (const i of order) {
    const [x, y, z] = [f.positions[i * 3], f.positions[i * 3 + 1], f.positions[i * 3 + 2]];
    pods += `<use href="#${id}-${STATUS_CLASS[f.status[i]] ?? "n"}" x="${Math.round(projectX(x, y, z) * S)}" y="${Math.round(-projectY(x, y, z) * S)}"/>`;
  }

  const w = f.view.w * VIEW_MARGIN;
  const h = f.view.h * VIEW_MARGIN;
  const viewBox = [(f.view.cx - w / 2) * S, (-f.view.cy - h / 2) * S, w * S, h * S].map(Math.round).join(" ");
  return { viewBox, html: `<style>${STYLE}</style><defs>${defs}</defs>${plates}${pods}` };
}

export function ClusterPoster({
  data,
  variant,
  count = POSTER_PRESETS[variant].count,
  className,
}: {
  data: FormationData;
  variant: ClusterVariant;
  /** Instance budget; must equal the scene's for the variant at this width. */
  count?: number;
  className?: string;
}) {
  const { viewBox, html } = posterMarkup(data, variant, count);
  return (
    <svg
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
      className={className ? `cp-svg ${className}` : "cp-svg"}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
