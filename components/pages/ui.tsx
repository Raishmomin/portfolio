// Shared server-only building blocks for every subpage, in the home page's design
// language (tasks/fullmotion-spec.md "Art direction"): full-bleed sections over the fixed
// 3D stage, each declaring its composition (data-stage) and scene (data-scene); one
// section head (kicker "0N · NAME", h2 with a serif-italic tail, the 3D caption chip);
// `.panel` surfaces; cards animated through the motion hooks (data-card, data-card-group,
// data-card-part, data-spotlight, data-draw, data-marquee). Every hook is an attribute
// only: without JS, with motion off or reduced, the server HTML is the static layout.
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Container, Kicker } from "../ui/primitives";
import { revealProps } from "../reveal";

/** Where a section's content sits; the stage frames its scene around it. */
export type StageLayout = "left" | "right" | "full" | "band";
/** Scene keys of the stage contract (`ambient`: the calm neural field). */
export type PageScene = "hero" | "stack" | "experience" | "ai" | "work" | "contact" | "ambient";

/** Readable surface over the canvas (app/globals.css `.panel`). */
export const panel = "panel";

/** Content column per composition (desktop), identical to the home sections. */
export const column: Record<StageLayout, string> = {
  left: "lg:max-w-[38rem]",
  right: "lg:ml-auto lg:max-w-[40rem]",
  full: "",
  band: "",
};

/** AI accent (light #3F5BD9, dark #7C9CFF). */
export const aiText = "text-[#3F5BD9] dark:text-[#7C9CFF]";
export const aiBorder = "border-[#3F5BD9]/40 dark:border-[#7C9CFF]/40";

/** Card hooks: `[data-card]` (rise | flip | swing | zoom) and its cascading parts. */
export const card = (kind: "rise" | "flip" | "swing" | "zoom" = "rise") => ({ "data-card": kind === "rise" ? "" : kind });
export const part = { "data-card-part": "" } as const;
/** A part whose children pop in one after another (chips, pills). */
export const pop = { "data-card-part": "pop" } as const;
/** Hover light on interactive cards (pairs with data-tilt on the same element by design). */
export const lit = { "data-tilt": "", "data-spotlight": "" } as const;

/** [data-reveal] for the intro's extras (CSS reveal; never on the h1/lead). */
export function reveal(delayMs = 0) {
  const base = revealProps(delayMs ? { delay: delayMs / 1000 } : {});
  return delayMs ? { ...base, "data-reveal-delay": String(delayMs) } : base;
}

const LAYOUT: Record<StageLayout, string> = {
  left: "py-20 md:py-24 lg:flex lg:min-h-[100svh] lg:flex-col lg:justify-center lg:py-28",
  right: "py-20 md:py-24 lg:flex lg:min-h-[100svh] lg:flex-col lg:justify-center lg:py-28",
  full: "py-20 md:py-28",
  band: "pb-20 pt-[30svh] lg:pb-28 lg:pt-[34vh]",
};

/**
 * Full-bleed subpage section (transparent: the fixed stage shows through). `scene` picks
 * the 3D scene (data-scene), `stage` the composition; consecutive sections never share a
 * composition. `full` sections get the centred scrim under their floating cards; `band`
 * sections leave the top of the viewport to the scene (no text over it).
 */
export function PageSection({
  id,
  section,
  scene,
  stage,
  labelledBy,
  label,
  className,
  innerClassName,
  bleed,
  children,
  ...rest
}: {
  id?: string;
  section: string;
  scene: PageScene;
  stage: StageLayout;
  labelledBy?: string;
  label?: string;
  className?: string;
  innerClassName?: string;
  /** Full-width content after the container (e.g. a ticker). */
  bleed?: ReactNode;
  children: ReactNode;
} & Record<`data-${string}`, string | undefined>) {
  return (
    <section
      id={id}
      data-section={section}
      data-scene={scene}
      data-stage={stage}
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : label}
      className={cn("relative", LAYOUT[stage], className)}
      {...rest}
    >
      {stage === "full" ? <div aria-hidden="true" className="scrim-c pointer-events-none absolute inset-0" /> : null}
      <Container className={cn("relative", innerClassName)}>{children}</Container>
      {bleed}
    </section>
  );
}

/** Same head as every home section: kicker, h2 (word stagger) with a serif-italic tail, 3D caption, lead. */
export function SectionHead({
  id,
  index,
  kicker,
  title,
  scene,
  lead,
  center = false,
  className,
}: {
  id: string;
  index?: string;
  kicker: string;
  title: ReactNode;
  /** What the 3D scene of this section shows, in plain words. */
  scene?: string;
  lead?: ReactNode;
  center?: boolean;
  className?: string;
}) {
  return (
    <header className={cn(center && "mx-auto max-w-3xl text-center", className)}>
      <Kicker>{index ? `${index} · ${kicker}` : kicker}</Kicker>
      <h2
        id={id}
        data-split=""
        className="mt-3 text-balance text-[clamp(1.875rem,4.2vw,3rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-foreground"
      >
        {title}
      </h2>
      {scene ? <SceneNote className={cn(center && "mx-auto max-w-[40rem] justify-center text-left")}>{scene}</SceneNote> : null}
      {lead ? <p className={cn("mt-4 text-[17px] leading-7 text-muted-foreground", center && "mx-auto max-w-[60ch]")}>{lead}</p> : null}
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

/** Visible breadcrumb trail; mirrors the page's BreadcrumbList JSON-LD. Links are 44px touch targets. */
export function Crumbs({ items, className }: { items: { name: string; href?: string }[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn("font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground", className)}>
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {items.map((item, i) => (
          <li key={item.name} className="flex min-w-0 items-center gap-2">
            {i > 0 ? <span aria-hidden="true">/</span> : null}
            {item.href ? (
              <Link
                href={item.href}
                className="-mx-2 -my-2.5 inline-flex min-h-11 items-center rounded-sm px-2 transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {item.name}
              </Link>
            ) : (
              <span aria-current="page" className="max-w-[40ch] truncate text-foreground">
                {item.name}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export type Stat = { value: number; label: string; suffix?: string; ai?: boolean };

/** Stat tiles as in the home hero: they rise in as a wave and count up (server text = final value). */
export function StatTiles({ stats, className }: { stats: Stat[]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4", className)}>
      {stats.map((s, i) => (
        <div key={s.label} className="flex flex-col-reverse gap-1 border-l border-border pl-3" {...reveal(120 + i * 90)} data-reveal-y="28">
          <dt className="font-mono text-[11px] uppercase leading-4 tracking-[0.1em] text-muted-foreground">{s.label}</dt>
          <dd
            className={cn(
              "text-[clamp(1.75rem,3.4vw,2.5rem)] font-semibold leading-none tracking-[-0.03em] tabular-nums",
              s.ai ? aiText : "text-foreground",
            )}
          >
            <span data-count={s.value}>{s.value}</span>
            {s.suffix}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Page intro, like the home hero: the page's scene fills one side of the viewport, the
 * text sits on a gradient scrim on the other ("left" by default, or "right"). The h1 and lead are plain
 * server text (LCP; never animated). Extras (stats, CTAs) and the 3D caption reveal.
 */
export function PageIntro({
  crumbs,
  kicker,
  title,
  lead,
  scene,
  note,
  children,
  wide = false,
  side = "left",
}: {
  crumbs: { name: string; href?: string }[];
  kicker: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  scene: PageScene;
  /** What the 3D scene shows here, in plain words. */
  note?: string;
  children?: ReactNode;
  /** A longer h1 (blog posts, services) gets a wider column. */
  wide?: boolean;
  /** Which side the text sits on ("left" composition = text left, scene right). */
  side?: "left" | "right";
}) {
  const right = side === "right";
  return (
    <section
      data-section="intro"
      data-scene={scene}
      data-stage={side}
      aria-labelledby="page-title"
      className="relative"
    >
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 bg-background/75 lg:bg-transparent",
          right
            ? "lg:bg-[linear-gradient(270deg,hsl(var(--background))_0%,hsl(var(--background)/0.92)_34%,hsl(var(--background)/0.5)_52%,transparent_68%)]"
            : "lg:bg-[linear-gradient(90deg,hsl(var(--background))_0%,hsl(var(--background)/0.92)_34%,hsl(var(--background)/0.5)_52%,transparent_68%)]",
        )}
      />
      <Container className="relative flex min-h-[calc(100svh-4rem-1px)] flex-col justify-center pb-14 pt-10 md:py-16">
        <div className={cn(wide ? "max-w-[48rem]" : "max-w-[42rem]", right && "lg:ml-auto")}>
          <Crumbs items={crumbs} />
          <Kicker className="mt-8">{kicker}</Kicker>
          <h1
            id="page-title"
            className="mt-4 text-balance text-[clamp(2.5rem,6vw,4.75rem)] font-semibold leading-[0.98] tracking-[-0.035em] text-foreground"
          >
            {title}
          </h1>
          {lead ? <p className="mt-6 max-w-[56ch] text-[17px] leading-7 text-muted-foreground md:text-lg md:leading-8">{lead}</p> : null}
          {children}
        </div>
        {note ? (
          <SceneNote
            {...reveal(900)}
            className={cn(
              "mt-10 max-w-[30rem] lg:absolute lg:bottom-10 lg:mt-0 lg:max-w-[22rem] lg:rounded-xl lg:border lg:border-border lg:bg-background/85 lg:p-4",
              right ? "lg:left-8" : "lg:right-8",
            )}
          >
            {note}
          </SceneNote>
        ) : null}
      </Container>
    </section>
  );
}

/** Fixed card width while a [data-hscroll] track runs sideways (desktop). */
export const hsWidth = (w: string) => ({ "--hs-w": w }) as CSSProperties;

/** Two-digit index ("01"). */
export const nn = (n: number) => String(n).padStart(2, "0");

/** Tech pills whose items pop in one after another when their card lands (`pop` part). */
export function PopPills({
  items,
  label,
  more,
  className,
  pillClassName,
}: {
  items: readonly string[];
  label?: string;
  more?: number;
  className?: string;
  pillClassName?: string;
}) {
  const pill = cn("pill", pillClassName);
  return (
    <ul {...pop} aria-label={label} className={cn("flex flex-wrap gap-1.5", className)}>
      {items.map((t) => (
        <li key={t} className={pill}>
          {t}
        </li>
      ))}
      {more ? <li className={pill}>+{more}</li> : null}
    </ul>
  );
}
