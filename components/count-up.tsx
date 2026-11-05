"use client";

import { useLayoutEffect, useRef } from "react";
import { useInView, useReducedMotion } from "framer-motion";

type CountUpProps = {
  to: number;
  duration?: number;
  suffix?: string;
  prefix?: string;
};

/**
 * Always shows the real final value until the number is actually in view (server
 * HTML, no-JS, reduced motion, and renderers that never scroll it into view, such
 * as a crawler's snapshot). Only when it enters the viewport, with motion allowed,
 * does it restart from 0 (before paint) and count up. The count writes the DOM
 * text directly, so there is no per-frame React state.
 */
export function CountUp({ to, duration = 1.6, suffix = "", prefix = "" }: CountUpProps) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  const reduce = useReducedMotion();

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || reduce || !inView) return;
    const show = (n: number) => {
      el.textContent = `${prefix}${n}${suffix}`;
    };
    show(0);
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 1000 / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      show(Math.round(to * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      show(to);
    };
  }, [inView, reduce, to, duration, prefix, suffix]);

  // Single string child so React and the animation own the same text node.
  return (
    <span ref={ref} className="tabular-nums">
      {`${prefix}${to}${suffix}`}
    </span>
  );
}
