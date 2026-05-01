"use client";

import { forwardRef, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

type SectionProps = {
  id: string;
  ariaLabel: string;
  className?: string;
  containerClassName?: string;
  children: ReactNode;
  as?: "section" | "header" | "footer";
};

export const Section = forwardRef<HTMLElement, SectionProps>(function Section(
  { id, ariaLabel, className, containerClassName, children, as = "section" },
  ref
) {
  const reduce = useReducedMotion();
  const Tag = motion[as];

  return (
    <Tag
      ref={ref as never}
      id={id}
      aria-labelledby={`${id}-heading`}
      aria-label={ariaLabel}
      initial={reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: reduce ? 0 : 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "scroll-mt-24 py-24 md:py-32",
        className
      )}
    >
      <div
        className={cn(
          "max-w-6xl mx-auto px-4 sm:px-6 lg:px-8",
          containerClassName
        )}
      >
        {children}
      </div>
    </Tag>
  );
});

type RevealHeadingProps = {
  id: string;
  eyebrow?: string;
  title: string;
  description?: string;
  className?: string;
};

export function RevealHeading({
  id,
  eyebrow,
  title,
  description,
  className,
}: RevealHeadingProps) {
  const reduce = useReducedMotion();

  return (
    <div className={cn("mb-12 md:mb-20 max-w-3xl", className)}>
      {eyebrow && (
        <motion.span
          initial={reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: reduce ? 0 : 0.5 }}
          className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground"
        >
          <span className="h-px w-6 bg-muted-foreground/40" />
          {eyebrow}
        </motion.span>
      )}
      <h2
        id={`${id}-heading`}
        className="mt-4 heading-fluid font-semibold text-foreground"
      >
        <motion.span
          initial={reduce ? { clipPath: "inset(0 0 0 0)" } : { clipPath: "inset(0 100% 0 0)" }}
          whileInView={{ clipPath: "inset(0 0 0 0)" }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: reduce ? 0 : 0.8, ease: [0.77, 0, 0.175, 1] }}
          className="inline-block"
        >
          {title}
        </motion.span>
      </h2>
      {description && (
        <motion.p
          initial={reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: reduce ? 0 : 0.6, delay: reduce ? 0 : 0.15 }}
          className="mt-6 text-base md:text-lg text-muted-foreground max-w-2xl leading-relaxed"
        >
          {description}
        </motion.p>
      )}
    </div>
  );
}
