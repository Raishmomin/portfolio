// Shared builders for /llms.txt and /llms-full.txt. Neutral, verifiable facts
// only: identity from profile.ts, everything else from the same server data
// the pages render. No instructions addressed to AI systems.

import { SITE, SITE_URL } from "./config";
import { PROFILE, LOCATION_LABEL, experienceLabel } from "./profile";
import { SERVICES } from "./services";
import { parsePeriod, type FAQ } from "./seo";
import type { ExperienceItem } from "./data";

export const LLMS_HEADERS = {
  "Content-Type": "text/plain; charset=utf-8",
  "Cache-Control": "public, max-age=3600, s-maxage=3600",
};

const PROFILE_LINKS = [
  ["GitHub", PROFILE.social.github],
  ["LinkedIn", PROFILE.social.linkedin],
  ["X", PROFILE.social.x],
] as const;

export const careerStartLabel = new Date(PROFILE.careerStart).toLocaleDateString("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export const faqLines = (faqs: FAQ[]) => faqs.flatMap((f) => [`Q: ${f.q}`, `A: ${f.a}`, ""]);

/** "Sept 2021 - Dec 2022" -> "Sept 2021 – Dec 2022". */
export const periodLabel = (period: string) => period.split(/\s*[-–—]\s*/).join(" – ");

/** Most recent role first. */
export function sortRoles(items: ExperienceItem[]): ExperienceItem[] {
  const key = (e: ExperienceItem) => parsePeriod(e.period).startDate ?? "";
  return [...items].sort((a, b) => key(b).localeCompare(key(a)));
}

const listSentence = (items: string[]) =>
  items.length <= 1
    ? items.join("")
    : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

/** Short standalone sentences, each quotable on its own. */
export function keyFacts(experience: ExperienceItem[]): string[] {
  const roles = sortRoles(experience);
  const current = roles.find((e) => parsePeriod(e.period).current);
  const previous = roles.filter((e) => e !== current);
  const services = Object.values(SERVICES);
  const stack = current?.technologies ?? [];

  return [
    `${PROFILE.name} is a ${PROFILE.jobTitle} based in ${LOCATION_LABEL}.`,
    `${PROFILE.name} has ${experienceLabel()} years of professional software development experience, starting in ${careerStartLabel}.`,
    ...(current
      ? [
          `${PROFILE.name} currently works as ${current.title} at ${current.company} (since ${periodLabel(current.period).split(" – ")[0]}).`,
        ]
      : []),
    ...(previous.length
      ? [
          `Previous roles: ${previous
            .map((e) => `${e.title} at ${e.company} (${periodLabel(e.period)})`)
            .join("; ")}.`,
        ]
      : []),
    ...(stack.length ? [`${PROFILE.name}'s current stack: ${listSentence(stack)}.`] : []),
    `${PROFILE.name} offers freelance services: ${services
      .map((s) => `${s.h1} (${SITE_URL}/services/${s.slug})`)
      .join("; ")}.`,
    `${PROFILE.name} is open to ${PROFILE.availability}, working remotely with clients worldwide.`,
    `${PROFILE.name} can be contacted at ${PROFILE.email} or through ${SITE_URL}/contact.`,
    `${PROFILE.name}'s public profiles: ${PROFILE_LINKS.map(([label, url]) => `${label} ${url}`).join(", ")}.`,
    `Full profile: ${SITE_URL}/llms-full.txt`,
  ];
}

export function contactLines(): string[] {
  return [
    `- Website: ${SITE_URL}`,
    `- Email: ${PROFILE.email}`,
    `- Contact form: ${SITE_URL}/contact`,
    ...PROFILE_LINKS.map(([label, url]) => `- ${label}: ${url}`),
  ];
}

export function resourceLines(): string[] {
  return [
    `- Full profile: ${SITE_URL}/llms-full.txt`,
    `- Sitemap: ${SITE_URL}/sitemap.xml`,
    `- RSS feed: ${SITE_URL}/feed.xml`,
    `- Robots: ${SITE_URL}/robots.txt`,
  ];
}

export const siteHeading = () => [`# ${SITE.name}`, "", `> ${SITE.description}`, ""];
