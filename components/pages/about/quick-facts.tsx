import type { ReactNode } from "react";
import Link from "next/link";
import { Container, PillList, Section, StatusDot } from "../../ui/primitives";
import { SubsectionHeading, TEXT_LINK } from "./subpage";
import { PROFILE, LOCATION_LABEL, experienceLabel } from "@/lib/profile";
import { SERVICES } from "@/lib/services";
import { parsePeriod } from "@/lib/seo";
import { careerStartLabel, sortRoles } from "@/lib/llms";
import { formatPeriod, periodParts } from "@/lib/derive";
import type { ExperienceItem } from "@/lib/data";

const PROFILES = [
  ["GitHub", PROFILE.social.github],
  ["LinkedIn", PROFILE.social.linkedin],
  ["X", PROFILE.social.x],
] as const;

/**
 * "At a glance" facts: identity from profile.ts, roles from the same experience
 * data as /experience and the Person JSON-LD. No new claims.
 */
export function QuickFacts({ experience }: { experience: ExperienceItem[] }) {
  const roles = sortRoles(experience);
  const current = roles.find((e) => parsePeriod(e.period).current);
  const previous = roles.filter((e) => e !== current);
  const services = Object.values(SERVICES);

  const rows: { label: string; value: ReactNode }[] = [
    { label: "Role", value: PROFILE.jobTitle },
    { label: "Based in", value: `${LOCATION_LABEL} · IST (UTC+5:30). Works remotely with clients worldwide.` },
    {
      label: "Experience",
      value: `${experienceLabel()} years of professional software development, since ${careerStartLabel}.`,
    },
    {
      label: "Availability",
      value: (
        <span className="flex items-start gap-2.5">
          <StatusDot className="mt-[0.7em] shrink-0" />
          Open to {PROFILE.availability}.
        </span>
      ),
    },
    ...(current
      ? [
          {
            label: "Current role",
            value: `${current.title} at ${current.company}, since ${periodParts(current.period).from}.`,
          },
        ]
      : []),
    ...(previous.length
      ? [
          {
            label: "Previous roles",
            value: (
              <ul className="space-y-1">
                {previous.map((e) => (
                  <li key={`${e.company}-${e.period}`}>
                    {e.title} at {e.company}{" "}
                    <span className="whitespace-nowrap font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
                      ({formatPeriod(e.period)})
                    </span>
                  </li>
                ))}
              </ul>
            ),
          },
        ]
      : []),
    ...(current?.technologies.length
      ? [
          {
            label: "Current stack",
            value: (
              <PillList items={current.technologies} label="Current stack" />
            ),
          },
        ]
      : []),
    {
      label: "Services",
      value: (
        <ul className="flex flex-col">
          {services.map((s) => (
            <li key={s.slug}>
              <Link href={`/services/${s.slug}`} className={`inline-flex min-h-11 items-center ${TEXT_LINK}`}>
                {s.h1}
              </Link>
            </li>
          ))}
        </ul>
      ),
    },
    {
      label: "Email",
      value: (
        <a href={`mailto:${PROFILE.email}`} className={`-my-2 inline-flex min-h-11 items-center break-all ${TEXT_LINK}`}>
          {PROFILE.email}
        </a>
      ),
    },
    {
      label: "Profiles",
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
    <Section id="profile" aria-labelledby="profile-heading">
      <Container className="grid gap-10 lg:grid-cols-12 lg:gap-16">
        <SubsectionHeading kicker="02 · profile" id="profile-heading" className="lg:col-span-4">
          {PROFILE.name} at a glance
        </SubsectionHeading>
        <dl className="min-w-0 divide-y divide-border border-y border-border lg:col-span-8">
          {rows.map((r) => (
            <div key={r.label} className="grid grid-cols-1 gap-1.5 py-4 md:grid-cols-[11rem_1fr] md:gap-6 md:py-5">
              <dt className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground md:pt-1">{r.label}</dt>
              <dd className="min-w-0 text-[15px] leading-7 text-foreground md:text-base">{r.value}</dd>
            </div>
          ))}
        </dl>
      </Container>
    </Section>
  );
}
