import { SITE, SITE_URL } from "@/lib/config";
import { PROFILE, SAME_AS } from "@/lib/profile";
import { PERSON_ID, PERSON_IMAGE, employeeRoles, parsePeriod } from "@/lib/seo";
import { getExperience, getSkills } from "@/lib/data";
import { safeJsonLd } from "./page-json-ld";

// Site-wide Person + WebSite nodes. Identity facts come only from profile.ts;
// skills and roles come from the same cached server data the pages render, so
// structured data matches the visible content.
export async function JsonLd() {
  const [skills, experience] = await Promise.all([getSkills(), getExperience()]);
  const skillNames = [...new Set(skills.flatMap((g) => g.skills.map((s) => s.name)))];
  const current = experience.find((e) => parsePeriod(e.period).current);

  const person = {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": PERSON_ID,
    name: PROFILE.name,
    givenName: PROFILE.givenName,
    familyName: PROFILE.familyName,
    alternateName: PROFILE.alternateName,
    url: SITE_URL,
    image: PERSON_IMAGE,
    jobTitle: PROFILE.jobTitle,
    description: SITE.description,
    email: `mailto:${PROFILE.email}`,
    address: {
      "@type": "PostalAddress",
      addressLocality: PROFILE.location.locality,
      addressRegion: PROFILE.location.region,
      addressCountry: PROFILE.location.countryCode,
    },
    sameAs: [...SAME_AS],
    ...(skillNames.length ? { knowsAbout: skillNames } : {}),
    hasOccupation: {
      "@type": "Occupation",
      name: PROFILE.jobTitle,
      ...(current?.technologies.length ? { skills: current.technologies.join(", ") } : {}),
    },
    // Every role, each with its dates; the current one has no endDate.
    ...(experience.length ? { worksFor: employeeRoles(experience) } : {}),
  };

  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}#website`,
    url: SITE_URL,
    name: SITE.name,
    alternateName: [`${SITE.name} Portfolio`, new URL(SITE_URL).host],
    description: SITE.description,
    inLanguage: "en-US",
    publisher: { "@id": PERSON_ID },
    author: { "@id": PERSON_ID },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(person) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(website) }}
      />
    </>
  );
}
