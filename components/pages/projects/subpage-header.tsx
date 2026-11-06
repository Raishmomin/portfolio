// Shared subpage header for /projects, /services and /blog (tasks/design-spec.md §3 "Subpages").
// Server Components only. The h1 is plain, never animated (LCP).
import Link from "next/link";
import type { ReactNode } from "react";
import { NeuralMotif } from "../../neural";
import { Container, Kicker } from "../../ui/primitives";
import { parallax, reveal, split } from "../motion";
import { cn } from "@/lib/utils";

/** Visible breadcrumb trail; mirrors the page's BreadcrumbList JSON-LD. Links are 44px touch targets (padding offset by negative margins). */
export function Crumbs({ items }: { items: { name: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
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

/**
 * Decorative neural-network motif in a hairline frame, with a mono caption that says what
 * the network stands for on this page (real figures only). aria-hidden: the page's text
 * carries every fact.
 */
export function PageMotif({
  label,
  value,
  className,
  motifClassName = "ml-auto max-w-[260px]",
}: {
  /** Left part of the caption, e.g. "neural · projects". */
  label: string;
  /** Right part, e.g. "9 / 21 use AI". */
  value: string;
  className?: string;
  motifClassName?: string;
}) {
  return (
    <div aria-hidden="true" className={cn("hidden lg:block", className)}>
      <div
        {...parallax(0.25)}
        className={cn("w-full overflow-hidden rounded-lg border border-border bg-card", motifClassName)}
      >
        <div className="px-4 pb-2 pt-5">
          <NeuralMotif className="h-auto w-full" />
        </div>
        <p className="border-t border-border px-3 py-2.5 font-mono text-[11px] uppercase leading-5 tracking-[0.12em] text-muted-foreground">
          <span className="block">{label}</span>
          <span className="block text-foreground tabular-nums">{value}</span>
        </p>
      </div>
    </div>
  );
}

/** Kicker + h1 + lead, with an optional aside (motif or meta) on the right at lg. */
export function SubpageHeader({
  kicker,
  title,
  lead,
  crumbs,
  aside,
  children,
}: {
  kicker: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  crumbs?: { name: string; href?: string }[];
  aside?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Container className="pb-12 pt-28 md:pb-16 md:pt-36">
      {crumbs ? <Crumbs items={crumbs} /> : null}
      <div className={cn("grid gap-10 lg:grid-cols-12 lg:items-end", crumbs && "mt-10 md:mt-14")}>
        <header className="lg:col-span-8">
          <Kicker>{kicker}</Kicker>
          <h1 className="mt-4 text-balance text-[clamp(2.5rem,6vw,4.75rem)] font-semibold leading-[0.98] tracking-[-0.035em] text-foreground">
            {title}
          </h1>
          {lead ? <p className="mt-6 max-w-[60ch] text-[17px] leading-7 text-muted-foreground">{lead}</p> : null}
          {children}
        </header>
        {aside ? <div className="hidden lg:col-span-3 lg:col-start-10 lg:block">{aside}</div> : null}
      </div>
    </Container>
  );
}

/** Closing call to action shared by the index pages. */
export function ContactBand({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <section aria-labelledby="contact-band" className="border-t border-border">
      <Container className="grid gap-8 py-20 md:grid-cols-12 md:items-end md:py-28">
        <div className="md:col-span-8" {...reveal()}>
          <Kicker>next step</Kicker>
          <h2
            {...split}
            id="contact-band"
            className="mt-3 text-[clamp(1.875rem,4.5vw,3.25rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-foreground"
          >
            {title}
          </h2>
        </div>
        <div className="flex flex-wrap gap-3 md:col-span-4 md:justify-end" {...reveal(1)}>
          {children}
        </div>
      </Container>
    </section>
  );
}
