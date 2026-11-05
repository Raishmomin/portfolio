// Shared server-safe primitives for the Control Plane design system (tasks/design-spec.md §2).
// No "use client" — import freely from Server Components.
import Link from "next/link";
import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-[1280px] px-4 md:px-8", className)}>{children}</div>;
}

/** Mono uppercase kicker, e.g. "01 · about". */
export function Kicker({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <p className={cn("font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground tabular-nums", className)}>
      {children}
    </p>
  );
}

/** Section header: kicker + heading (h2 by default, h1 on subpages) + optional lead. Never animated. */
export function SectionHeader({
  kicker,
  title,
  lead,
  as: Heading = "h2",
  id,
  className,
}: {
  kicker?: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  as?: "h1" | "h2" | "h3";
  id?: string;
  className?: string;
}) {
  return (
    <header className={cn("max-w-3xl", className)}>
      {kicker ? <Kicker>{kicker}</Kicker> : null}
      <Heading id={id} className="mt-3 text-[clamp(1.875rem,4.5vw,3.25rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-foreground">
        {title}
      </Heading>
      {lead ? <p className="mt-4 text-[17px] leading-7 text-muted-foreground">{lead}</p> : null}
    </header>
  );
}

/** One italic serif accent clause inside a headline. */
export function Accent({ children }: { children: ReactNode }) {
  return <em className="font-serif font-normal italic tracking-normal">{children}</em>;
}

export function Pill({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border border-border px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground", className)}>
      {children}
    </span>
  );
}

/** Green "Running" status dot; pulse only when motion is allowed (see globals.css .status-dot). */
export function StatusDot({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("status-dot inline-block h-2 w-2 rounded-full bg-ok", className)} />;
}

export function Hairline({ className }: { className?: string }) {
  return <hr className={cn("border-0 border-t border-border", className)} />;
}

type ButtonVariant = "primary" | "ghost";
const buttonClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-primary-foreground hover:bg-primary/90",
  ghost:
    "border border-border text-foreground hover:border-foreground/40 hover:bg-accent",
};
export const buttonBase =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-5 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** Link styled as a button (≥44px). External links get rel/target automatically. */
export function ButtonLink({
  href,
  variant = "primary",
  className,
  children,
  ...rest
}: { href: string; variant?: ButtonVariant; className?: string; children: ReactNode } & Omit<ComponentPropsWithoutRef<"a">, "href">) {
  const external = /^https?:\/\//.test(href);
  const cls = cn(buttonBase, buttonClasses[variant], className);
  if (external || href.startsWith("mailto:")) {
    return (
      <a href={href} className={cls} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={cls} {...rest}>
      {children}
    </Link>
  );
}

/** Polymorphic section wrapper with a data-section hook for the cluster scroll-spy. */
export function Section({
  as: Tag = "section",
  id,
  section,
  className,
  children,
  ...rest
}: {
  as?: ElementType;
  id?: string;
  section?: string;
  className?: string;
  children: ReactNode;
} & Record<string, unknown>) {
  return (
    <Tag id={id} data-section={section} className={cn("scroll-mt-24 border-t border-border py-20 md:py-28", className)} {...rest}>
      {children}
    </Tag>
  );
}
