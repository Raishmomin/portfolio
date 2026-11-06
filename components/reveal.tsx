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
 * components/header/theme-toggle.tsx), turns motion and 3D ON for every visitor
 * (html[data-motion]="on", owner decision 2026-11-06: no toggle, the OS reduced-motion
 * setting is not followed; localStorage "cp:3d"="off" remains as a hidden QA/debug kill
 * switch), flags `html.js` and reveals `[data-reveal]`
 * elements as they enter the viewport, including ones added later by client
 * navigation. An element counts as in view once 15% of it, or a fifth of the
 * viewport's height of it, is visible (so very tall sections and the last element
 * on the page both trigger). Siblings entering together are staggered 70 ms apart (max
 * 8 steps); `data-reveal-delay="<ms>"` adds a delay and `data-reveal-y="<px>"` sets the
 * rise distance. Without JS (or IntersectionObserver) nothing is ever hidden.
 * The rest of the motion hooks live in components/motion (lazy GSAP runtime).
 */
export const REVEAL_SCRIPT = `(function(){
var d=document.documentElement,t;
try{t=localStorage.getItem("theme");}catch(e){}
if(t!=="light"&&t!=="dark")t=t==="system"&&!matchMedia("(prefers-color-scheme: dark)").matches?"light":"dark";
d.classList.add(t);d.style.colorScheme=t;
var m;try{m=localStorage.getItem("cp:3d");}catch(e){}d.dataset.motion=m==="off"?"off":"on";
if(!("IntersectionObserver" in window))return;
d.classList.add("js");
function show(n){n.setAttribute("data-in","");}
var io=new IntersectionObserver(function(es){var k=new Map();for(var i=0;i<es.length;i++){var e=es[i],n=e.target;if(e.isIntersecting&&(e.intersectionRatio>=0.15||e.intersectionRect.height>=window.innerHeight*0.2)){io.unobserve(n);var p=n.parentNode,c=k.get(p)||0;k.set(p,c+1);var y=parseFloat(n.getAttribute("data-reveal-y"));if(y===y)n.style.setProperty("--reveal-y",y+"px");var w=(parseFloat(n.getAttribute("data-reveal-delay"))||0)+Math.min(c,8)*70;if(w>0)setTimeout(show,w,n);else show(n);}}},{threshold:[0,0.01,0.02,0.05,0.1,0.15]});
function scan(n){if(n.nodeType!==1)return;if(n.hasAttribute("data-reveal")&&!n.hasAttribute("data-in"))io.observe(n);var l=n.querySelectorAll("[data-reveal]:not([data-in])");for(var i=0;i<l.length;i++)io.observe(l[i]);}
function start(){scan(document.body);new MutationObserver(function(ms){for(var i=0;i<ms.length;i++){var a=ms[i].addedNodes;for(var j=0;j<a.length;j++)scan(a[j]);}}).observe(document.body,{childList:true,subtree:true});}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
})();`;
