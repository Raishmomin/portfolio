// Shared subpage header for /projects, /services and /blog (tasks/design-spec.md §3 "Subpages").
// Server Components only. The h1 is plain, never animated (LCP).
import Link from "next/link";
import type { ReactNode } from "react";
import { ClusterMonitor, toFormationData } from "../../cluster";
import { Container, Kicker } from "../../ui/primitives";
import { getExperience, getProjects, getSkills } from "@/lib/data";
import { cn } from "@/lib/utils";

/** Visible breadcrumb trail; mirrors the page's BreadcrumbList JSON-LD. */
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
                className="rounded-sm py-1 transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

/** Decorative static cluster motif (desktop only). Data is real: skills, experience, featured projects. */
export async function PageMotif({ className }: { className?: string }) {
  const [skills, experience, projects] = await Promise.all([getSkills(), getExperience(), getProjects()]);
  const data = toFormationData({ skills, experience, featuredProjects: projects.slice(0, 6) });
  return (
    <div aria-hidden="true" className={cn("hidden lg:block", className)}>
      <ClusterMonitor data={data} variant="motif" className="ml-auto max-w-[240px]" />
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
          <h1 className="mt-4 text-[clamp(2.5rem,6vw,4.75rem)] font-semibold leading-[0.98] tracking-[-0.035em] text-foreground">
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
        <div className="md:col-span-8">
          <Kicker>next step</Kicker>
          <h2
            id="contact-band"
            className="mt-3 text-[clamp(1.875rem,4.5vw,3.25rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-foreground"
          >
            {title}
          </h2>
        </div>
        <div className="flex flex-wrap gap-3 md:col-span-4 md:justify-end">{children}</div>
      </Container>
    </section>
  );
}
