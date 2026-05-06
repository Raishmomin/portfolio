import clientPromise from "@/lib/mongodb";
import { SITE, SITE_URL } from "@/lib/config";

type PersonalDoc = {
  email?: string;
  phone_number?: string;
  location?: string;
  git_hub?: string;
  linkdin?: string;
  about_desc?: string;
  main_desc?: string;
  resume_link?: string;
  experience?: number | string;
};

async function getPersonal(): Promise<PersonalDoc | null> {
  try {
    const client = await clientPromise;
    const db = client.db("Portfolio");
    const doc = await db.collection("personal-data").findOne({});
    if (!doc) return null;
    return JSON.parse(JSON.stringify(doc));
  } catch {
    return null;
  }
}

export async function JsonLd() {
  const personal = await getPersonal();

  const sameAs = [
    personal?.git_hub || SITE.github,
    personal?.linkdin || SITE.linkedin,
  ].filter(Boolean);

  const person = {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": `${SITE_URL}#person`,
    name: SITE.name,
    url: SITE_URL,
    image: `${SITE_URL}/opengraph-image`,
    jobTitle: SITE.jobTitle,
    description: personal?.about_desc || SITE.description,
    email: personal?.email
      ? `mailto:${personal.email}`
      : SITE.email
      ? `mailto:${SITE.email}`
      : undefined,
    address: personal?.location
      ? { "@type": "PostalAddress", addressLocality: personal.location }
      : undefined,
    sameAs,
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
      "Full Stack Development",
    ],
  };

  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}#website`,
    url: SITE_URL,
    name: SITE.name,
    description: SITE.description,
    inLanguage: "en-US",
    publisher: { "@id": `${SITE_URL}#person` },
    author: { "@id": `${SITE_URL}#person` },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/blog?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
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
