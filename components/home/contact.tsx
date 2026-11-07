// Home Contact section (lane-owned: fm3-contact). Server Component; the contact form and
// "copy email" are the only client islands.
import { Suspense } from "react";
import { Accent } from "../ui/primitives";
import { ContactForm } from "../contact-form";
import { PROFILE } from "@/lib/profile";
import { cn } from "@/lib/utils";
import { CopyEmail } from "../copy-email";
import { HomeSection, SectionHead, panel } from "./ui";

const SOCIALS = [
  { label: "GitHub", href: PROFILE.social.github },
  { label: "LinkedIn", href: PROFILE.social.linkedin },
  { label: "X", href: PROFILE.social.x },
] as const;

/** "full" composition: the network converges behind the centred contact card. */
export function ContactSection() {
  return (
    <HomeSection id="contact" section="contact" stage="full" scene labelledBy="contact-heading">
      <div data-card="">
        <SectionHead
          center
          id="contact-heading"
          index="08"
          kicker="contact"
          title={
            <>
              Have a product to ship? <Accent>Let&apos;s talk.</Accent>
            </>
          }
          scene="The whole network converges into one bright node, with a line drawn out to you: a direct line to me."
        />
      </div>
      <div data-card="zoom" className={cn(panel, "mx-auto mt-10 max-w-[52rem] p-6 md:p-8 lg:mt-14")}>
        <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
          <div data-card-part="" className="bg-background p-5 sm:col-span-2">
            <dt className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">Email</dt>
            <dd className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
              <a
                href={`mailto:${PROFILE.email}`}
                className="inline-flex min-h-11 items-center break-all text-[clamp(1.125rem,2.2vw,1.5rem)] font-medium tracking-[-0.015em] text-foreground underline decoration-border underline-offset-4 hover:decoration-primary"
              >
                {PROFILE.email}
              </a>
              <CopyEmail email={PROFILE.email} />
            </dd>
          </div>
          <div data-card-part="" className="bg-background p-5">
            <dt className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">Availability</dt>
            <dd className="mt-2 text-[15px] leading-6 text-foreground">Open to {PROFILE.availability}</dd>
          </div>
          <div data-card-part="" className="bg-background p-5">
            <dt className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">Timezone</dt>
            <dd className="mt-2 text-[15px] leading-6 text-foreground">
              IST (UTC+5:30) · {PROFILE.location.locality}, {PROFILE.location.country}
            </dd>
          </div>
          <div data-card-part="" className="bg-background p-5 sm:col-span-2">
            <dt className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">Elsewhere</dt>
            <dd className="mt-1 flex flex-wrap gap-x-6">
              {SOCIALS.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer me"
                  className="inline-flex min-h-11 min-w-11 items-center gap-1 text-[15px] text-foreground underline decoration-border underline-offset-4 hover:decoration-primary"
                >
                  {s.label}
                  <span aria-hidden="true">↗</span>
                </a>
              ))}
            </dd>
          </div>
        </dl>
        <div data-card-part="" className="mt-10">
          {/* Below the fold: the boundary lets React hydrate the form in its own low-priority pass. */}
          <Suspense>
            <ContactForm />
          </Suspense>
        </div>
      </div>
    </HomeSection>
  );
}
