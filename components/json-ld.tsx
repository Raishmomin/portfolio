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

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: SITE_URL,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "About",
        item: `${SITE_URL}/about`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: "Projects",
        item: `${SITE_URL}/projects`,
      },
      {
        "@type": "ListItem",
        position: 4,
        name: "Experience",
        item: `${SITE_URL}/experience`,
      },
      {
        "@type": "ListItem",
        position: 5,
        name: "Skills",
        item: `${SITE_URL}/skills`,
      },
      {
        "@type": "ListItem",
        position: 6,
        name: "Contact",
        item: `${SITE_URL}/contact`,
      },
      {
        "@type": "ListItem",
        position: 7,
        name: "Blog",
        item: `${SITE_URL}/blog`,
      },
    ],
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
    </>
  );
}
