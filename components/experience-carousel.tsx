"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { revealProps } from "./reveal";

type ExperienceCarouselProps = {
  heading: ReactNode;
  itemCount: number;
  children: ReactNode;
};

/** Interactive shell (auto-scroll, prev/next) around server-rendered experience cards. */
export function ExperienceCarousel({ heading, itemCount, children }: ExperienceCarouselProps) {
  const reduce = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (reduce || paused) return;
    const el = containerRef.current;
    if (!el) return;
    const id = setInterval(() => {
      const max = el.scrollWidth - el.clientWidth;
      const next = el.scrollLeft + el.clientWidth * 0.6;
      if (next >= max - 8) el.scrollTo({ left: 0, behavior: "smooth" });
      else el.scrollTo({ left: next, behavior: "smooth" });
    }, 4500);
    return () => clearInterval(id);
  }, [reduce, paused, itemCount]);

  function nudge(dir: -1 | 1) {
    const el = containerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.7, behavior: "smooth" });
  }

  return (
    <>
      <div className="flex items-end justify-between gap-6 mb-12 md:mb-20">
        {heading}
        <div className="hidden md:flex gap-2 pb-2 shrink-0">
          <button
            onClick={() => nudge(-1)}
            aria-label="Previous"
            className="grid place-items-center w-10 h-10 rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => nudge(1)}
            aria-label="Next"
            className="grid place-items-center w-10 h-10 rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* The track reveals as one unit: cards scrolled off to the side never
          intersect the viewport, so per-card reveals would leave them hidden. */}
      <div
        {...revealProps()}
        ref={containerRef}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={() => setPaused(true)}
        className="flex gap-6 overflow-x-auto snap-x snap-mandatory pb-6 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 no-scrollbar"
        style={{ scrollbarWidth: "none" }}
      >
        {children}
      </div>
    </>
  );
}
