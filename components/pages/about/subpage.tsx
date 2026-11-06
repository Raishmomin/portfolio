// Shared server-only chrome for the /about, /skills, /experience and /contact
// subpages (tasks/design-spec.md §3 Subpages): breadcrumb, h1 intro with the
// decorative cluster motif, and the "keep exploring" internal links.
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { ClusterMotif } from "../../cluster/motif";
import type { FormationData } from "../../cluster/types";
import { Container, Kicker, Section, SectionHeader, StatusDot } from "../../ui/primitives";
import { PROFILE } from "@/lib/profile";
import { cn } from "@/lib/utils";

export const FOCUS_RING =
  "rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** Underlined text link used inside prose and fact lists. */
export const TEXT_LINK = cn(
  "underline decoration-foreground/30 underline-offset-4 transition-colors duration-150 hover:decoration-primary",
  FOCUS_RING
);

/** Visible breadcrumb; mirrors the page's BreadcrumbList JSON-LD (Home > Page). */
function Breadcrumb({ current }: { current: string }) {
  return (
    <nav aria-label="Breadcrumb" className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
      <ol className="flex items-center gap-2">
        <li>
          <Link href="/" className={cn("-mx-2 inline-flex min-h-11 items-center px-2 hover:text-foreground", FOCUS_RING)}>
            Home
          </Link>
        </li>
        <li aria-hidden="true">/</li>
        <li>
          <span aria-current="page" className="text-foreground">
            {current}
          </span>
        </li>
      </ol>
    </nav>
  );
}

/** Page intro: breadcrumb, the page's single h1 (never animated), lead, extras, and the decorative motif. */
export function SubpageIntro({
  crumb,
  title,
  lead,
  motif,
  children,
}: {
  crumb: string;
  title: ReactNode;
  lead?: ReactNode;
  motif: FormationData;
  children?: ReactNode;
}) {
  return (
    <Container className="pb-16 pt-6 md:pb-24 md:pt-12">
      <div className="grid gap-10 lg:grid-cols-12 lg:items-end">
        <div className="min-w-0 lg:col-span-8">
          <Breadcrumb current={crumb} />
          <SectionHeader as="h1" title={title} lead={lead} className="mt-1" />
          {children}
        </div>
        <div className="hidden lg:col-span-4 lg:flex lg:justify-end">
          <ClusterMotif data={motif} className="w-full max-w-[280px]" />
        </div>
      </div>
    </Container>
  );
}

/** "● Open to …" status line (the one availability statement from profile.ts). */
export function AvailabilityLine({ className }: { className?: string }) {
  return (
    <p className={cn("flex items-start gap-2.5 text-sm leading-6 text-foreground", className)}>
      <StatusDot className="mt-2 shrink-0" />
      Open to {PROFILE.availability}
    </p>
  );
}

/** Section heading block used inside subpage sections (kicker + h2). */
export function SubsectionHeading({
  kicker,
  id,
  children,
  className,
}: {
  kicker: string;
  id: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Kicker>{kicker}</Kicker>
      <h2 id={id} className="mt-3 text-balance text-[clamp(1.5rem,3vw,2.25rem)] font-semibold leading-[1.1] tracking-[-0.025em] text-foreground">
        {children}
      </h2>
    </div>
  );
}

const RELATED = {
  about: { href: "/about", label: "About", note: "Bio, quick facts and FAQ." },
  projects: { href: "/projects", label: "Projects", note: "Case studies and the full project archive." },
  experience: { href: "/experience", label: "Experience", note: "Roles, dates and results, newest first." },
  skills: { href: "/skills", label: "Skills", note: "The stack map, grouped by layer." },
  services: { href: "/services", label: "Services", note: "Next.js, MERN, DevOps & AWS, APIs." },
  blog: { href: "/blog", label: "Blog", note: "Notes on shipping web products." },
  contact: { href: "/contact", label: "Contact", note: "Email, availability and a contact form." },
} as const;

export type RelatedKey = keyof typeof RELATED;

/** Internal links to related pages, rendered as a hairline grid of real <a> elements. */
export function RelatedPages({ keys, kicker }: { keys: RelatedKey[]; kicker: string }) {
  return (
    <Section aria-labelledby="related-heading" className="py-16 md:py-20">
      <Container>
        <SubsectionHeading kicker={kicker} id="related-heading">
          Keep exploring
        </SubsectionHeading>
        <ul className="mt-8 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {keys.map((key) => {
            const link = RELATED[key];
            return (
              <li key={key} className="bg-background">
                <Link
                  href={link.href}
                  className="group flex h-full min-h-11 flex-col gap-2 p-5 transition-colors duration-150 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <span className="flex items-center justify-between gap-4 text-base font-medium text-foreground">
                    {link.label}
                    <ArrowUpRight
                      aria-hidden="true"
                      className="h-4 w-4 text-muted-foreground transition-[translate,color] duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary"
                    />
                  </span>
                  <span className="text-sm leading-6 text-muted-foreground">{link.note}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Container>
    </Section>
  );
}
