// Shared server-only pieces for the subpages: text-link styles, the availability line
// and the "keep exploring" internal links (a card group in the home design language).
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Accent, StatusDot } from "../../ui/primitives";
import { PageSection, SectionHead, card, column, lit, part, type PageScene, type StageLayout } from "../ui";
import { PROFILE } from "@/lib/profile";
import { cn } from "@/lib/utils";

export const FOCUS_RING =
  "rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** Underlined text link used inside prose and fact lists. */
export const TEXT_LINK = cn(
  "underline decoration-foreground/30 underline-offset-4 transition-colors duration-150 hover:decoration-primary",
  FOCUS_RING
);

/** "● Open to …" status line (the one availability statement from profile.ts). */
export function AvailabilityLine({ className }: { className?: string }) {
  return (
    <p className={cn("flex items-start gap-2.5 text-sm leading-6 text-foreground", className)}>
      <StatusDot className="mt-2 shrink-0" />
      Open to {PROFILE.availability}
    </p>
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

/** Internal links to related pages: real <a> cards that flip in as a wave. */
export function RelatedPages({
  keys,
  index,
  stage,
  scene = "ambient",
}: {
  keys: RelatedKey[];
  index: string;
  stage: StageLayout;
  scene?: PageScene;
}) {
  const narrow = stage === "left" || stage === "right";
  return (
    <PageSection id="related" section="related" scene={scene} stage={stage} labelledBy="related-heading">
      <div className={column[stage]}>
        <SectionHead
          id="related-heading"
          index={index}
          kicker="next"
          title={
            <>
              Keep <Accent>exploring.</Accent>
            </>
          }
        />
        <ul data-card-group="" className={cn("mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2", !narrow && "lg:grid-cols-4")}>
          {keys.map((key) => {
            const link = RELATED[key];
            return (
              <li key={key} {...card("flip")} className="flex">
                <Link
                  href={link.href}
                  {...lit}
                  className="panel group flex min-h-11 w-full flex-col gap-2 p-5 transition-colors duration-150 hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span {...part} className="flex items-center justify-between gap-4 text-base font-medium text-foreground">
                    {link.label}
                    <ArrowUpRight
                      aria-hidden="true"
                      className="h-4 w-4 text-muted-foreground transition-[translate,color] duration-150 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary"
                    />
                  </span>
                  <span {...part} className="text-sm leading-6 text-muted-foreground">
                    {link.note}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </PageSection>
  );
}
