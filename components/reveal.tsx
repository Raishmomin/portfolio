import type { CSSProperties, ReactNode } from "react";

// Reveal-on-scroll as progressive enhancement (SEO rulebook P0-2, 6.6 rule 20).
// The server HTML is always fully visible. The hidden start state lives in
// app/globals.css and applies only under `html.js` (set by REVEAL_SCRIPT in the
// root layout) and `prefers-reduced-motion: no-preference`; the script marks each
// `[data-reveal]` element `data-in` when it scrolls into view, which plays the
// entrance. `[data-enter]` plays once on load (above-the-fold chrome). No React
// state or framer-motion is involved, so these work in Server Components.

type RevealOptions = {
  /** "up" fades and slides in; "clip" wipes in from the left (headings). */
  variant?: "up" | "clip";
  /** Seconds. */
  delay?: number;
  /** Start offset in px for "up" (negative slides down from above). */
  y?: number;
  /** Seconds. */
  duration?: number;
};

function motionVars({ delay, y, duration }: RevealOptions): CSSProperties | undefined {
  const vars: Record<string, string> = {};
  if (delay) vars["--reveal-delay"] = `${delay}s`;
  if (y !== undefined) vars["--reveal-y"] = `${y}px`;
  if (duration) vars["--reveal-duration"] = `${duration}s`;
  return Object.keys(vars).length ? (vars as CSSProperties) : undefined;
}

/**
 * Props that make an element reveal when scrolled into view. The head script adds
 * `data-in` before hydration, hence suppressHydrationWarning.
 */
export function revealProps(options: RevealOptions = {}) {
  return {
    "data-reveal": options.variant === "clip" ? "clip" : "",
    suppressHydrationWarning: true,
    style: motionVars(options),
  };
}

/** Props for a one-off entrance on page load (no scroll trigger). */
export function enterProps(options: Omit<RevealOptions, "variant"> = {}) {
  return { "data-enter": "", style: motionVars(options) };
}

/**
 * Runs in <head> before first paint: flags `html.js` and reveals `[data-reveal]`
 * elements as they enter the viewport, including ones added later by client
 * navigation. An element counts as in view once 15% of it, or a fifth of the
 * viewport's height of it, is visible (so very tall sections and the last element
 * on the page both trigger). Without JS (or IntersectionObserver) nothing is ever hidden.
 */
export const REVEAL_SCRIPT = `(function(){
if(!("IntersectionObserver" in window))return;
var d=document.documentElement;d.classList.add("js");
var io=new IntersectionObserver(function(es){for(var i=0;i<es.length;i++){var e=es[i];if(e.isIntersecting&&(e.intersectionRatio>=0.15||e.intersectionRect.height>=window.innerHeight*0.2)){e.target.setAttribute("data-in","");io.unobserve(e.target);}}},{threshold:[0,0.01,0.02,0.05,0.1,0.15]});
function scan(n){if(n.nodeType!==1)return;if(n.hasAttribute("data-reveal")&&!n.hasAttribute("data-in"))io.observe(n);var l=n.querySelectorAll("[data-reveal]:not([data-in])");for(var i=0;i<l.length;i++)io.observe(l[i]);}
function start(){scan(document.body);new MutationObserver(function(ms){for(var i=0;i<ms.length;i++){var a=ms[i].addedNodes;for(var j=0;j<a.length;j++)scan(a[j]);}}).observe(document.body,{childList:true,subtree:true});}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
})();`;

type RevealProps = RevealOptions & {
  children: ReactNode;
  className?: string;
  as?: "div" | "article";
};

/** Fade-up on scroll for server-rendered content. */
export function Reveal({ children, className, as: Tag = "div", ...options }: RevealProps) {
  return (
    <Tag className={className} {...revealProps(options)}>
      {children}
    </Tag>
  );
}
