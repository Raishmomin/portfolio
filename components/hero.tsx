"use client";

import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionStyle,
} from "framer-motion";
import { useRef } from "react";
import { ArrowRight, Download, ArrowDown } from "lucide-react";
import { Magnetic } from "./magnetic-button";
import { SITE } from "@/lib/config";
import { enterProps } from "./reveal";

// CSS entrances (gated by html.js + reduced motion in globals.css), never on the h1 or intro.
const ctaEnter = enterProps({ y: 12, delay: 0.8, duration: 0.7 });
const scrollCueEnter = enterProps({ y: 0, delay: 1.4, duration: 0.8 });

type HeroProps = {
  intro: string;
  resumeUrl: string | null;
};

export function Hero({ intro, resumeUrl }: HeroProps) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const opacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  // Full-screen, but capped: renderers that grow the viewport to the page height
  // instead of scrolling (Google's WRS) would otherwise grow the hero with it and
  // keep every section below it out of view, so reveals and count-ups never ran.
  return (
    <section
      ref={ref}
      id="home"
      aria-labelledby="home-heading"
      className="relative min-h-[min(100vh,64rem)] flex items-center justify-center overflow-hidden"
    >
      <div
        className="absolute inset-0 scrim-radial pointer-events-none"
        aria-hidden="true"
      />

      <motion.div
        style={{ y, opacity }}
        className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-32 text-center"
      >
        {/* The h1 is the LCP text: plain server-rendered text with no entrance
            animation. It carries the name and the role; `order-first` keeps the
            role visually above the greeting while the text reads
            "Hi, I'm Raish Momin, Full Stack Developer & DevOps Engineer". */}
        <h1
          id="home-heading"
          className="flex flex-col items-center display-fluid font-semibold text-foreground"
        >
          <span className="block text-muted-foreground text-[0.4em] mb-4 tracking-normal font-normal">
            Hi, I&apos;m
          </span>{" "}
          <span>{SITE.name}</span>
          <span className="sr-only">, </span>
          <span className="order-first inline-flex items-center gap-3 text-xs font-normal uppercase tracking-[0.3em] text-muted-foreground mb-10">
            <span className="h-px w-8 bg-muted-foreground/40" aria-hidden="true" />
            {SITE.jobTitle}
            <span className="h-px w-8 bg-muted-foreground/40" aria-hidden="true" />
          </span>
        </h1>

        <p className="mt-10 text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          {intro}
        </p>

        <div
          {...ctaEnter}
          className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-3"
        >
          <Magnetic
            as="a"
            href="#contact"
            className="group h-12 px-7 rounded-full bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors"
          >
            <span className="flex items-center gap-2">
              Let&apos;s talk
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Magnetic>
          <Magnetic
            as="a"
            href="#projects"
            className="h-12 px-7 rounded-full border border-border text-foreground text-sm font-medium hover:bg-muted transition-colors"
          >
            <span>View work</span>
          </Magnetic>
          {resumeUrl && (
            <Magnetic
              as="a"
              href={resumeUrl}
              target="_blank"
              rel="noopener noreferrer"
              ariaLabel="Download resume"
              className="h-12 px-5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <span className="flex items-center gap-2">
                <Download className="w-4 h-4" /> Resume
              </span>
            </Magnetic>
          )}
        </div>
      </motion.div>

      <motion.a
        href="#about"
        aria-label="Scroll to about section"
        data-enter={scrollCueEnter["data-enter"]}
        style={{ ...(scrollCueEnter.style as MotionStyle), opacity }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-xs uppercase tracking-[0.3em] text-muted-foreground hover:text-foreground transition-colors"
      >
        <span>Scroll</span>
        <motion.span
          animate={reduce ? undefined : { y: [0, 6, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        >
          <ArrowDown className="w-4 h-4" aria-hidden="true" />
        </motion.span>
      </motion.a>
    </section>
  );
}
