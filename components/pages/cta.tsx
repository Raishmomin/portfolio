// Closing call to action shared by the subpages, in the home "cta" language: one card that
// zooms in from depth, a large headline with a serif-italic tail, magnetic primary button.
// With the contact scene (the default) a smaller globe sits beside the card, on its wider
// side (scenes/contact/rig.ts reads the card as [data-contact-col]); pointing at or
// focusing the main button ("contact:go") sends a message packet from the card to the city.
import type { ReactNode } from "react";
import { ButtonLink } from "../ui/primitives";
import { PageSection, SectionHead, card, column, part, type PageScene, type StageLayout } from "./ui";
import { cn } from "@/lib/utils";

type Action = { href: string; label: ReactNode };

export function CtaSection({
  title,
  index,
  stage,
  scene = "contact",
  lead,
  primary,
  secondary,
  children,
  id = "next-step",
}: {
  title: ReactNode;
  index?: string;
  stage: StageLayout;
  scene?: PageScene;
  lead?: ReactNode;
  primary: Action;
  secondary?: Action;
  children?: ReactNode;
  id?: string;
}) {
  const center = stage === "full";
  const globe = scene === "contact";
  return (
    <PageSection
      id={id}
      section="cta"
      scene={scene}
      stage={stage}
      labelledBy={`${id}-heading`}
      // Phones / tablets: a centred card opens with a window onto the globe, like a band.
      className={globe && center ? "pt-[30svh] md:pt-[30svh] lg:pt-28" : undefined}
    >
      {/* The globe reads this untransformed wrapper (the card itself zooms in from depth). */}
      <div
        data-contact-col={globe ? "" : undefined}
        className={center ? "mx-auto max-w-[52rem]" : stage === "band" ? "lg:max-w-[52rem]" : column[stage]}
      >
        <div {...card("zoom")} className={cn("panel relative overflow-hidden p-6 md:p-10", center && "text-center")}>
          <div
            aria-hidden="true"
            data-parallax="-0.3"
            className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[radial-gradient(closest-side,rgb(63_91_217/0.22),transparent)] dark:bg-[radial-gradient(closest-side,rgb(124_156_255/0.22),transparent)]"
          />
          <SectionHead id={`${id}-heading`} index={index} kicker="next step" title={title} lead={lead} center={center} className="relative" />
          {children ? (
            <div {...part} className="relative">
              {children}
            </div>
          ) : null}
          <div {...part} className={cn("relative mt-8 flex flex-wrap gap-3", center && "justify-center")}>
            <ButtonLink href={primary.href} data-magnetic="" data-focus-id={globe ? "contact:go" : undefined}>
              {primary.label} <span aria-hidden="true">→</span>
            </ButtonLink>
            {secondary ? (
              <ButtonLink href={secondary.href} variant="ghost">
                {secondary.label}
              </ButtonLink>
            ) : null}
          </div>
        </div>
      </div>
    </PageSection>
  );
}
