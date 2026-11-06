// Single source of truth for identity facts (entity SEO / GEO).
// Every surface — JSON-LD, metadata, llms.txt, RSS, author bio, hero copy —
// must read these values instead of hard-coding them or trusting raw DB fields.

export const PROFILE = {
  name: "Raish Momin",
  givenName: "Raish",
  familyName: "Momin",
  alternateName: "Raishmomin",
  jobTitle: "Full Stack Developer & DevOps Engineer",
  email: "rjmomin.rj@gmail.com",
  location: {
    locality: "Ahmedabad",
    region: "Gujarat",
    country: "India",
    countryCode: "IN",
  },
  // First professional role (Fahm Technologies, Sept 2021). Years are derived, never typed.
  careerStart: "2021-09-01",
  // Last human edit of these facts (ISO 8601 DateTime with offset, as ProfilePage
  // expects). Bump it when anything here changes; feeds ProfilePage.dateModified
  // and the sitemap lastmod of profile pages.
  updatedAt: "2026-11-06T00:00:00+05:30",
  // The one availability statement (rulebook 8.4), quoted as "open to …" by the
  // site description, llms.txt key facts and the availability FAQ.
  availability: "senior engineering roles and freelance projects",
  social: {
    github: "https://github.com/Raishmomin",
    linkedin: "https://www.linkedin.com/in/raish-momin-ba8927253",
    x: "https://x.com/RWankanery",
    xHandle: "@RWankanery",
  },
} as const;

/** Whole years since careerStart, e.g. 5 in Nov 2026. */
export function yearsOfExperience(now: Date = new Date()): number {
  const start = new Date(PROFILE.careerStart);
  let years = now.getUTCFullYear() - start.getUTCFullYear();
  if (now.getUTCMonth() < start.getUTCMonth()) years -= 1;
  return Math.max(years, 0);
}

/** "5+" style label used in copy and llms.txt. */
export const experienceLabel = (now?: Date) => `${yearsOfExperience(now)}+`;

/** Public profiles for visible link lists, so every sameAs URL is also linked on the page. */
export const SOCIAL_PROFILES = [
  { label: "GitHub", url: PROFILE.social.github },
  { label: "LinkedIn", url: PROFILE.social.linkedin },
  { label: "X", url: PROFILE.social.x },
] as const;

/** Canonical sameAs list: clean URLs, no query strings. */
export const SAME_AS = SOCIAL_PROFILES.map((p) => p.url);

export const LOCATION_LABEL = `${PROFILE.location.locality}, ${PROFILE.location.region}, ${PROFILE.location.country}`;
