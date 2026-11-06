import type { CSSProperties } from "react";

// Reveal-on-scroll as progressive enhancement (SEO rulebook P0-2, 6.6 rule 20).
// The server HTML is always fully visible. The hidden start state lives in
// app/globals.css and applies only under `html.js` (set by REVEAL_SCRIPT in the
// root layout) and `prefers-reduced-motion: no-preference`; the script marks each
// `[data-reveal]` element `data-in` when it scrolls into view, which plays the
// entrance. No React state is involved, so this works in Server Components.

type RevealOptions = {
  /** Seconds. */
  delay?: number;
  /** Start offset in px (negative slides down from above). */
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
    "data-reveal": "",
    suppressHydrationWarning: true,
    style: motionVars(options),
  };
}

/**
 * Runs in <head> before first paint: applies the color theme (localStorage "theme" =
 * "light" | "dark" | "system", default dark; html class + color-scheme, see
 * components/header/theme-toggle.tsx), applies the persisted 3D/motion preference
 * (localStorage "cp:3d" = "off" | "on" sets html[data-motion]; no attribute = follow the OS
 * reduced-motion setting; an explicit "on" overrides it,
 * see components/header/motion-toggle.tsx), flags `html.js` and reveals `[data-reveal]`
 * elements as they enter the viewport, including ones added later by client
 * navigation. An element counts as in view once 15% of it, or a fifth of the
 * viewport's height of it, is visible (so very tall sections and the last element
 * on the page both trigger). Without JS (or IntersectionObserver) nothing is ever hidden.
 */
export const REVEAL_SCRIPT = `(function(){
var d=document.documentElement,t;
try{t=localStorage.getItem("theme");}catch(e){}
if(t!=="light"&&t!=="dark")t=t==="system"&&!matchMedia("(prefers-color-scheme: dark)").matches?"light":"dark";
d.classList.add(t);d.style.colorScheme=t;
try{var m=localStorage.getItem("cp:3d");if(m==="off"||m==="on")d.dataset.motion=m;}catch(e){}
if(!("IntersectionObserver" in window))return;
d.classList.add("js");
var io=new IntersectionObserver(function(es){for(var i=0;i<es.length;i++){var e=es[i];if(e.isIntersecting&&(e.intersectionRatio>=0.15||e.intersectionRect.height>=window.innerHeight*0.2)){e.target.setAttribute("data-in","");io.unobserve(e.target);}}},{threshold:[0,0.01,0.02,0.05,0.1,0.15]});
function scan(n){if(n.nodeType!==1)return;if(n.hasAttribute("data-reveal")&&!n.hasAttribute("data-in"))io.observe(n);var l=n.querySelectorAll("[data-reveal]:not([data-in])");for(var i=0;i<l.length;i++)io.observe(l[i]);}
function start(){scan(document.body);new MutationObserver(function(ms){for(var i=0;i<ms.length;i++){var a=ms[i].addedNodes;for(var j=0;j<a.length;j++)scan(a[j]);}}).observe(document.body,{childList:true,subtree:true});}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
})();`;
