import type { Metadata } from "next";
import { SITE, SITE_URL } from "./config";

export type PageSeoInput = {
  path: string;
  title: string;
  description: string;
  keywords?: string[];
  ogTitle?: string;
  ogDescription?: string;
  ogType?: "website" | "article" | "profile";
  image?: string;
  publishedTime?: string;
  modifiedTime?: string;
  authors?: string[];
  tags?: string[];
};

export function buildMetadata(input: PageSeoInput): Metadata {
  const url = `${SITE_URL}${input.path}`;
  const image = input.image || "/opengraph-image";
  const ogTitle = input.ogTitle || `${input.title} — ${SITE.name}`;
  const ogDescription = input.ogDescription || input.description;

  return {
    title: input.title,
    description: input.description,
    keywords: input.keywords,
    alternates: { canonical: url },
    openGraph: {
      type: input.ogType || "website",
      url,
      title: ogTitle,
      description: ogDescription,
      siteName: SITE.name,
      locale: SITE.locale,
      images: [{ url: image, width: 1200, height: 630, alt: ogTitle }],
      ...(input.ogType === "article"
        ? {
            publishedTime: input.publishedTime,
            modifiedTime: input.modifiedTime,
            authors: input.authors,
            tags: input.tags,
          }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: ogDescription,
      images: [image],
      creator: SITE.twitter,
    },
  };
}

export function breadcrumbList(
  items: { name: string; path: string }[]
): object {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: `${SITE_URL}${it.path}`,
    })),
  };
}

export function webPageSchema(input: {
  name: string;
  description: string;
  path: string;
  type?: string;
}): object {
  return {
    "@context": "https://schema.org",
    "@type": input.type || "WebPage",
    "@id": `${SITE_URL}${input.path}#webpage`,
    url: `${SITE_URL}${input.path}`,
    name: input.name,
    description: input.description,
    isPartOf: { "@id": `${SITE_URL}#website` },
    about: { "@id": `${SITE_URL}#person` },
    inLanguage: "en-US",
  };
}

export type FAQ = { q: string; a: string };

export function faqPageSchema(faqs: FAQ[], path?: string): object {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    ...(path ? { "@id": `${SITE_URL}${path}#faq` } : {}),
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

export function serviceSchema(input: {
  name: string;
  description: string;
  serviceType: string;
  path: string;
  areaServed?: string;
  priceRange?: string;
}): object {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${SITE_URL}${input.path}#service`,
    name: input.name,
    description: input.description,
    serviceType: input.serviceType,
    url: `${SITE_URL}${input.path}`,
    provider: { "@id": `${SITE_URL}#person` },
    areaServed: input.areaServed || "Worldwide",
    ...(input.priceRange ? { priceRange: input.priceRange } : {}),
  };
}
