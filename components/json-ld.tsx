import { SITE, SITE_URL } from "@/lib/config";

export function JsonLd() {
  const person = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: SITE.name,
    url: SITE_URL,
    jobTitle: SITE.jobTitle,
    description: SITE.description,
    sameAs: [SITE.github, SITE.linkedin].filter(Boolean),
    knowsAbout: [
      "React",
      "Next.js",
      "TypeScript",
      "Node.js",
      "Express",
      "MongoDB",
      "PostgreSQL",
      "Docker",
      "AWS",
      "DevOps",
    ],
  };

  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    url: SITE_URL,
    name: SITE.name,
    description: SITE.description,
    inLanguage: "en-US",
    author: { "@type": "Person", name: SITE.name },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(person) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(website) }}
      />
    </>
  );
}
