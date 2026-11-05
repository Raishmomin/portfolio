import type { ReactNode } from "react";
import Link from "next/link";
import { PROFILE, LOCATION_LABEL, experienceLabel } from "@/lib/profile";
import { SERVICES } from "@/lib/services";
import { parsePeriod } from "@/lib/seo";
import { careerStartLabel, periodLabel, sortRoles } from "@/lib/llms";
import type { ExperienceItem } from "@/lib/data";

const LINK = "underline underline-offset-4 decoration-foreground/30 hover:decoration-foreground transition-colors";

/**
 * Factual summary for /about: identity from profile.ts, roles from the same
 * experience data as /experience and the Person JSON-LD. No new claims.
 */
export function ProfileFacts({ experience }: { experience: ExperienceItem[] }) {
  const roles = sortRoles(experience);
  const current = roles.find((e) => parsePeriod(e.period).current);
  const previous = roles.filter((e) => e !== current);
  const services = Object.values(SERVICES);
  const profiles = [
    ["GitHub", PROFILE.social.github],
    ["LinkedIn", PROFILE.social.linkedin],
    ["X", PROFILE.social.x],
  ] as const;

  const rows: { label: string; value: ReactNode }[] = [
    { label: "Role", value: PROFILE.jobTitle },
    { label: "Based in", value: `${LOCATION_LABEL}. Works remotely with clients worldwide.` },
    {
      label: "Experience",
      value: `${experienceLabel()} years of professional software development, since ${careerStartLabel}.`,
    },
    ...(current
      ? [
          {
            label: "Current role",
            value: `${current.title} at ${current.company}, since ${periodLabel(current.period).split(" – ")[0]}.`,
          },
        ]
      : []),
    ...(previous.length
      ? [
          {
            label: "Previous roles",
            value: (
              <ul className="space-y-1">
                {previous.map((e, i) => (
                  <li key={i}>
                    {e.title} at {e.company} ({periodLabel(e.period)})
                  </li>
                ))}
              </ul>
            ),
          },
        ]
      : []),
    ...(current?.technologies.length
      ? [{ label: "Current stack", value: current.technologies.join(", ") }]
      : []),
    {
      label: "Services",
      value: (
        <ul className="space-y-1">
          {services.map((s) => (
            <li key={s.slug}>
              <Link href={`/services/${s.slug}`} className={LINK}>
                {s.h1}
              </Link>
            </li>
          ))}
        </ul>
      ),
    },
    {
      label: "Contact",
      value: (
        <>
          <a href={`mailto:${PROFILE.email}`} className={LINK}>
            {PROFILE.email}
          </a>{" "}
          or the{" "}
          <Link href="/contact" className={LINK}>
            contact form
          </Link>
          . Profiles:{" "}
          {profiles.map(([label, url], i) => (
            <span key={label}>
              {i > 0 && ", "}
              <a href={url} target="_blank" rel="noopener noreferrer" className={LINK}>
                {label}
              </a>
            </span>
          ))}
          .
        </>
      ),
    },
  ];

  return (
    <section
      aria-labelledby="profile-facts-heading"
      className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24"
    >
      <div className="mb-12 md:mb-16 text-center">
        <span className="inline-flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-muted-foreground mb-6">
          <span className="h-px w-8 bg-muted-foreground/40" />
          Profile
          <span className="h-px w-8 bg-muted-foreground/40" />
        </span>
        <h2
          id="profile-facts-heading"
          className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground"
        >
          {PROFILE.name} at a glance
        </h2>
      </div>

      <dl className="divide-y divide-border border-y border-border">
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-1 md:grid-cols-[11rem_1fr] gap-1 md:gap-6 py-5">
            <dt className="text-xs uppercase tracking-[0.2em] text-muted-foreground md:pt-1">
              {r.label}
            </dt>
            <dd className="text-sm md:text-base text-foreground/90 leading-relaxed">{r.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
