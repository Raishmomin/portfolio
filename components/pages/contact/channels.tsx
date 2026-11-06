import type { ReactNode } from "react";
import { StatusDot } from "../../ui/primitives";
import { SubsectionHeading, TEXT_LINK } from "../about/subpage";
import { CopyEmail } from "../../copy-email";
import { PROFILE } from "@/lib/profile";
import type { Personal } from "@/lib/data";

/** India has a single time zone, so this follows from the profile location. */
const TIMEZONE_LABEL = "IST (UTC+5:30)";

const PROFILES = [
  ["GitHub", PROFILE.social.github],
  ["LinkedIn", PROFILE.social.linkedin],
  ["X", PROFILE.social.x],
] as const;

/** Direct contact details: identity facts from profile.ts via getPersonal(), phone from the DB. */
export function ContactChannels({ personal }: { personal: Personal }) {
  const { email, phone, location } = personal;

  const rows: { label: string; value: ReactNode }[] = [
    {
      label: "Availability",
      value: (
        <span className="flex items-start gap-2.5">
          <StatusDot className="mt-[0.7em] shrink-0" />
          Open to {PROFILE.availability}
        </span>
      ),
    },
    { label: "Location", value: location },
    { label: "Time zone", value: TIMEZONE_LABEL },
    ...(phone
      ? [
          {
            label: "Phone",
            // RFC 3966: the tel: URI carries digits and "+" only.
            value: (
              <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className={`-my-2 inline-flex min-h-11 items-center ${TEXT_LINK}`}>
                {phone}
              </a>
            ),
          },
        ]
      : []),
    {
      label: "Elsewhere",
      value: (
        <ul className="flex flex-wrap gap-x-6">
          {PROFILES.map(([label, url]) => (
            <li key={label}>
              <a href={url} target="_blank" rel="noopener noreferrer" className={`-my-2 inline-flex min-h-11 min-w-11 items-center ${TEXT_LINK}`}>
                {label} ↗<span className="sr-only"> (opens in a new tab)</span>
              </a>
            </li>
          ))}
        </ul>
      ),
    },
  ];

  return (
    <div className="min-w-0">
      <SubsectionHeading kicker="01 · direct" id="channels-heading">
        Reach me directly
      </SubsectionHeading>
      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3">
        <a
          href={`mailto:${email}`}
          className="inline-flex min-h-11 items-center break-all text-[clamp(1.25rem,2.4vw,1.75rem)] font-medium tracking-[-0.02em] text-foreground underline decoration-foreground/30 decoration-1 underline-offset-[6px] transition-colors duration-150 hover:decoration-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {email}
        </a>
        <CopyEmail email={email} icon />
      </div>

      <dl className="mt-10 divide-y divide-border border-y border-border">
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-1 gap-1 py-4 sm:grid-cols-[8.5rem_1fr] sm:gap-4">
            <dt className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground sm:pt-1">{r.label}</dt>
            <dd className="min-w-0 text-[15px] leading-7 text-foreground">{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
