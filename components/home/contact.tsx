// Home Contact section (lane-owned: fm3-contact). Server Component; the contact form, the
// "copy email" button and the live local time are the only client islands.
// "right" composition: the details and the form sit on the right, the contact globe owns
// the left of the viewport (components/neural/scenes/contact.tsx; its static poster,
// StaticGlobe, stands in wherever the canvas is not live). The DOM drives the
// globe: channel links carry data-focus-id="contact:<channel>", and the form and the copy
// button signal focus, typing, copying and sending (components/pages/contact/signal.ts).
import { Suspense } from "react";
import { Accent, Kicker } from "../ui/primitives";
import { ContactForm } from "../contact-form";
import { PROFILE, SOCIAL_PROFILES } from "@/lib/profile";
import { cn } from "@/lib/utils";
import { CopyEmail } from "../copy-email";
import { LocalTime } from "../pages/contact/local-time";
import { StaticGlobe } from "../pages/contact/static-globe";
import { HomeSection, SectionHead, column, panel } from "./ui";

/** India has a single time zone, so this follows from the profile location. */
const IST_OFFSET_MIN = 330;

const LINK =
  "inline-flex min-h-11 items-center underline decoration-border underline-offset-4 transition-colors duration-150 hover:decoration-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const LABEL = "font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground";

export function ContactSection() {
  return (
    <HomeSection id="contact" section="contact" stage="right" scene labelledBy="contact-heading" className="contact-sec">
      <StaticGlobe />
      <div data-contact-col="" className={column.right}>
        <div data-card="" className={cn(panel, "p-6 md:p-8")}>
          <SectionHead
            id="contact-heading"
            index="08"
            kicker="contact"
            title={
              <>
                Have a product to ship? <Accent>Let&apos;s talk.</Accent>
              </>
            }
            scene={`A globe with ${PROFILE.location.locality} lit at its local time and a green beacon: I'm available. Point at a channel to light its satellite; send a message and watch it fly to ${PROFILE.location.locality}.`}
          />
          <dl className="mt-7 grid grid-cols-1 gap-x-6 border-t border-border sm:grid-cols-2">
            <div data-card-part="" className="border-b border-border py-4 sm:col-span-2">
              <dt className={LABEL}>Email</dt>
              <dd className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2">
                <a
                  href={`mailto:${PROFILE.email}`}
                  data-focus-id="contact:email"
                  className={cn(LINK, "break-all text-[clamp(1.125rem,2vw,1.375rem)] font-medium tracking-[-0.015em] text-foreground")}
                >
                  {PROFILE.email}
                </a>
                <CopyEmail email={PROFILE.email} icon />
              </dd>
            </div>
            <div data-card-part="" className="border-b border-border py-4">
              <dt className={LABEL}>Availability</dt>
              <dd className="mt-2 flex items-start gap-2.5 text-[15px] leading-6 text-foreground">
                {/* Static: the globe's green beacon pulses for it. */}
                <span aria-hidden="true" className="mt-2 inline-block h-2 w-2 shrink-0 rounded-full bg-ok" />
                Open to {PROFILE.availability}
              </dd>
            </div>
            <div data-card-part="" className="border-b border-border py-4">
              <dt className={LABEL}>Local time</dt>
              <dd className="mt-2 text-[15px] leading-6 text-foreground">
                IST (UTC+5:30) · {PROFILE.location.locality}, {PROFILE.location.country}
                <LocalTime offsetMin={IST_OFFSET_MIN} className="block" />
              </dd>
            </div>
            <div data-card-part="" className="py-3 sm:col-span-2">
              <dt className={LABEL}>Elsewhere</dt>
              <dd className="flex flex-wrap gap-x-6">
                {SOCIAL_PROFILES.map((s) => (
                  <a
                    key={s.label}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer me"
                    data-focus-id={`contact:${s.label.toLowerCase()}`}
                    className={cn(LINK, "min-w-11 gap-1 text-[15px] text-foreground")}
                  >
                    {s.label}
                    <span aria-hidden="true">↗</span>
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                ))}
              </dd>
            </div>
          </dl>
        </div>
        <div data-card="zoom" className={cn(panel, "mt-4 p-6 md:p-8")}>
          <Kicker className="mb-6">Send a message</Kicker>
          {/* Below the fold: the boundary lets React hydrate the form in its own low-priority pass. */}
          <Suspense>
            <ContactForm />
          </Suspense>
        </div>
      </div>
    </HomeSection>
  );
}
