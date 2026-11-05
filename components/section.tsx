import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { revealProps } from "./reveal";

type SectionProps = {
  id: string;
  ariaLabel: string;
  className?: string;
  containerClassName?: string;
  children: ReactNode;
  as?: "section" | "header" | "footer";
  /**
   * Fade up on scroll (CSS progressive enhancement, see reveal.tsx). Turn it off
   * for the section that holds a page's h1: that text is the LCP candidate and
   * must be visible at first paint.
   */
  reveal?: boolean;
};

export function Section({
  id,
  ariaLabel,
  className,
  containerClassName,
  children,
  as: Tag = "section",
  reveal = true,
}: SectionProps) {
  return (
    <Tag
      id={id}
      aria-labelledby={`${id}-heading`}
      aria-label={ariaLabel}
      {...(reveal ? revealProps() : {})}
      className={cn("scroll-mt-24 py-24 md:py-32", className)}
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
}

type RevealHeadingProps = {
  id: string;
  eyebrow?: string;
  title: string;
  description?: string;
  className?: string;
  /** An h1 heads its page: it renders static, since it is the LCP text. */
  as?: "h1" | "h2";
};

export function RevealHeading({
  id,
  eyebrow,
  title,
  description,
  className,
  as: HeadingTag = "h2",
}: RevealHeadingProps) {
  const animate = HeadingTag !== "h1";

  return (
    <div className={cn("mb-12 md:mb-20 max-w-3xl", className)}>
      {eyebrow && (
        <span
          {...(animate ? revealProps({ y: 8, duration: 0.5 }) : {})}
          className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground"
        >
          <span className="h-px w-6 bg-muted-foreground/40" />
          {eyebrow}
        </span>
      )}
      {/* The clip wipe plays on the inner span; the heading is what gets observed
          (an element clipped to nothing never reports as in view). */}
      <HeadingTag
        id={`${id}-heading`}
        {...(animate ? revealProps({ variant: "clip" }) : {})}
        className="mt-4 heading-fluid font-semibold text-foreground"
      >
        <span className="inline-block">{title}</span>
      </HeadingTag>
      {description && (
        <p
          {...(animate ? revealProps({ y: 8, delay: 0.15 }) : {})}
          className="mt-6 text-base md:text-lg text-muted-foreground max-w-2xl leading-relaxed"
        >
          {description}
        </p>
      )}
    </div>
  );
}
