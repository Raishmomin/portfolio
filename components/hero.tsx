"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { ArrowRight, Download, ArrowDown } from "lucide-react";
import { Magnetic } from "./magnetic-button";
import { usePersonalStore } from "@/lib/zutand";
import { SITE } from "@/lib/config";

const NAME = SITE.name.split("");

export function Hero() {
  const { value } = usePersonalStore();
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const opacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  const description =
    value?.personalData?.[0]?.main_desc ||
    "I transform complex problems into elegant, scalable solutions. Specialized in the React ecosystem and cloud infrastructure.";
  const resume = value?.personalData?.[0]?.resume_link;

  return (
    <section
      ref={ref}
      id="home"
      aria-labelledby="home-heading"
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
    >
      <div
        className="absolute inset-0 scrim-radial pointer-events-none"
        aria-hidden="true"
      />

      <motion.div
        style={{ y, opacity }}
        className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-32 text-center"
      >
        <motion.span
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-muted-foreground mb-10"
        >
          <span className="h-px w-8 bg-muted-foreground/40" />
          {SITE.jobTitle}
          <span className="h-px w-8 bg-muted-foreground/40" />
        </motion.span>

        <h1
          id="home-heading"
          className="display-fluid font-semibold text-foreground"
          aria-label={`Hi, I'm ${SITE.name}`}
        >
          <span className="block text-muted-foreground text-[0.4em] mb-4 tracking-normal font-normal">
            Hi, I&apos;m
          </span>
          <span className="inline-block">
            {NAME.map((ch, i) => (
              <motion.span
                key={i}
                initial={reduce ? false : { y: "100%", opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{
                  duration: 0.8,
                  delay: 0.2 + i * 0.04,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="inline-block"
                aria-hidden="true"
              >
                {ch === " " ? " " : ch}
              </motion.span>
            ))}
          </span>
        </h1>

        <motion.p
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.6 }}
          className="mt-10 text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed"
        >
          {description}
        </motion.p>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.8 }}
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
          {resume && (
            <Magnetic
              as="a"
              href={resume}
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
        </motion.div>
      </motion.div>

      <motion.a
        href="#about"
        aria-label="Scroll to about section"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4, duration: 0.8 }}
        style={{ opacity }}
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
