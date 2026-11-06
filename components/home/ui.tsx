// Shared server-safe building blocks for the Neural home page (tasks/neural-spec.md
// "Layout and readability" + "Motion"). Content scrolls over the fixed 3D stage, so
// every block of copy sits on a Panel; motion is opt-in through data-* hooks that the
// motion lane enhances (nothing here hides content without JS).
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Container, Kicker } from "../ui/primitives";
import { revealProps } from "../reveal";

/**
 * Readable surface over the canvas: opaque enough for 4.5:1 text contrast over any
 * glow (no backdrop-filter, which is too expensive over WebGL).
 */
export const panel = "rounded-xl border border-border bg-background/85";

/**
 * Full-bleed home section (transparent, so the fixed stage shows through) with the
 * content in the site container. `scene` sections own a 3D scene: at least a viewport
 * tall on desktop (content on the left, the scene on the right), and on phones they
 * open with a window onto the scene before their panel scrolls over it.
 */
export function HomeSection({
  id,
  section,
  labelledBy,
  scene = false,
  className,
  innerClassName,
  children,
  ...rest
}: {
  id: string;
  section: string;
  labelledBy: string;
  scene?: boolean;
  className?: string;
  innerClassName?: string;
  children: ReactNode;
} & Record<`data-${string}`, string>) {
  return (
    <section
      id={id}
      data-section={section}
      aria-labelledby={labelledBy}
      className={cn(
        "relative",
        scene ? "pb-20 pt-[38svh] lg:flex lg:min-h-[100svh] lg:items-center lg:py-28" : "py-20 md:py-24",
        className,
      )}
      {...rest}
    >
      <Container className={innerClassName}>{children}</Container>
    </section>
  );
}

/** AI accent (spec: --ai, dark #7C9CFF, light #3F5BD9) as literal values, so it does not depend on token format. */
export const aiText = "text-[#3F5BD9] dark:text-[#7C9CFF]";
export const aiBorder = "border-[#3F5BD9]/40 dark:border-[#7C9CFF]/40";

/** [data-reveal] (+ data-reveal-delay in ms): CSS reveal today, GSAP-enhanced by the motion lane. */
export function reveal(delayMs = 0) {
  const base = revealProps(delayMs ? { delay: delayMs / 1000 } : {});
  return delayMs ? { ...base, "data-reveal-delay": String(delayMs) } : base;
}

/**
 * Section header used on every home section: kicker, h2 (data-split: word stagger) and,
 * for 3D sections, one plain sentence saying what the visual behind the page shows.
 */
export function SectionHead({
  id,
  index,
  kicker,
  title,
  scene,
  lead,
  className,
}: {
  id: string;
  index?: string;
  kicker: string;
  title: ReactNode;
  /** What the 3D scene of this section shows, in plain words. */
  scene?: string;
  lead?: ReactNode;
  className?: string;
}) {
  return (
    <header className={className}>
      <Kicker>{index ? `${index} · ${kicker}` : kicker}</Kicker>
      <h2
        id={id}
        data-split=""
        className="mt-3 text-balance text-[clamp(1.875rem,4.2vw,3rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-foreground"
      >
        {title}
      </h2>
      {scene ? <SceneNote>{scene}</SceneNote> : null}
      {lead ? <p className="mt-4 text-[17px] leading-7 text-muted-foreground">{lead}</p> : null}
    </header>
  );
}

/** "What you're looking at" line for the 3D stage behind a section. */
export function SceneNote({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("mt-4 flex gap-3 text-[15px] leading-6 text-foreground/85", className)}>
      <span
        aria-hidden="true"
        className={cn(
          "mt-0.5 inline-flex h-5 shrink-0 items-center rounded border px-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.12em]",
          aiText,
          aiBorder,
        )}
      >
        3D
      </span>
      <span>{children}</span>
    </p>
  );
}

/** Small static neural-network glyph (3 → 2 → 1 nodes) marking AI projects, as in the 3D work scene. */
export function NeuralGlyph({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 16" className={cn("h-4 w-6", className)} fill="none" stroke="currentColor" strokeWidth="1">
      <path d="M3 2 12 5M3 2l9 9M3 8l9-3M3 8l9 3M3 14l9-9M3 14l9-3M12 5l9 3M12 11l9-3" strokeOpacity=".55" />
      <g fill="currentColor" stroke="none">
        <circle cx="3" cy="2" r="1.6" />
        <circle cx="3" cy="8" r="1.6" />
        <circle cx="3" cy="14" r="1.6" />
        <circle cx="12" cy="5" r="1.8" />
        <circle cx="12" cy="11" r="1.8" />
        <circle cx="21" cy="8" r="2" />
      </g>
    </svg>
  );
}
