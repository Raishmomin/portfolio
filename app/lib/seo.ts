import type { Metadata } from "next";
import { SITE, SITE_URL } from "./config";
import { PROFILE } from "./profile";

export const RSS_URL = `${SITE_URL}/feed.xml`;

export type PageSeoInput = {
  path: string;
  title: string;
  description: string;
  keywords?: string[];
  ogTitle?: string;
  ogDescription?: string;
  ogType?: "website" | "article" | "profile";
  /** Route's own OG image, e.g. `/blog/${slug}/opengraph-image`. Defaults to the site card. */
  image?: string;
  publishedTime?: string;
  modifiedTime?: string;
  authors?: string[];
  tags?: string[];
};

export function buildMetadata(input: PageSeoInput): Metadata {
  const url = `${SITE_URL}${input.path}`;
  const image = input.image || "/opengraph-image";
  const ogTitle =
    input.ogTitle ||
    (input.title.includes(SITE.name) ? input.title : `${input.title} — ${SITE.name}`);
  const ogDescription = input.ogDescription || input.description;

  return {
    // If the title already contains the site name, skip the layout's
    // "%s | Raish Momin" template to avoid "… — Raish Momin | Raish Momin"
    title: input.title.includes(SITE.name)
      ? { absolute: input.title }
      : input.title,
    description: input.description,
    keywords: input.keywords,
    // Page-level alternates replace the layout's, so the RSS link is repeated here.
    alternates: {
      canonical: url,
      types: { "application/rss+xml": [{ url: RSS_URL, title: `${SITE.name} — Blog` }] },
    },
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
      creator: PROFILE.social.xHandle,
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

export const PERSON_ID = `${SITE_URL}#person`;

// TODO(owner): replace with a real square headshot (ImageObject, >= 400x400,
// served from /public) once one is provided; the OG card is a stand-in.
export const PERSON_IMAGE = `${SITE_URL}/opengraph-image`;

export function webPageSchema(input: {
  name: string;
  description: string;
  path: string;
  type?: string;
  /** @id of the entity the page is primarily about (also used for `about`). */
  mainEntity?: string;
}): object {
  return {
    "@context": "https://schema.org",
    "@type": input.type || "WebPage",
    "@id": `${SITE_URL}${input.path}#webpage`,
    url: `${SITE_URL}${input.path}`,
    name: input.name,
    description: input.description,
    isPartOf: { "@id": `${SITE_URL}#website` },
    about: { "@id": input.mainEntity || PERSON_ID },
    ...(input.mainEntity ? { mainEntity: { "@id": input.mainEntity } } : {}),
    inLanguage: "en-US",
  };
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** "Sept 2021" -> "2021-09", "2021" -> "2021"; undefined when unparseable. */
function toIsoMonth(text: string): string | undefined {
  const m = text.trim().match(/^(?:([A-Za-z]+)\.?\s+)?(\d{4})$/);
  if (!m) return undefined;
  const month = m[1] ? MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) : -1;
  return month === -1 ? m[2] : `${m[2]}-${String(month + 1).padStart(2, "0")}`;
}

/**
 * Parses an experience period like "Sept 2021 - Dec 2022" or "Feb 2024 - Present"
 * (hyphen, en or em dash) into ISO dates. `endDate` is omitted for ongoing roles.
 */
export function parsePeriod(period: string): {
  startDate?: string;
  endDate?: string;
  current: boolean;
} {
  const [start = "", end = ""] = period.split(/\s*[-\u2013\u2014]\s*/);
  const current = /^(present|current|now)$/i.test(end.trim());
  return {
    startDate: toIsoMonth(start),
    endDate: current ? undefined : toIsoMonth(end),
    current,
  };
}

const idSlug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/**
 * Career history in the schema.org Role pattern: Person.worksFor -> EmployeeRole
 * (roleName, ISO start/end; no endDate while current) -> worksFor Organization.
 * The site-wide Person and the /experience ItemList emit the same nodes (same
 * @id), so the roles on /experience are attached to the Person.
 */
export function employeeRoles(
  items: { title: string; company: string; period: string; description?: string }[],
  { withDescription = false } = {}
): object[] {
  return items.map((e) => {
    const { startDate, endDate } = parsePeriod(e.period);
    return {
      "@type": "EmployeeRole",
      "@id": `${SITE_URL}/experience#role-${idSlug(`${e.company} ${startDate ?? e.title}`)}`,
      roleName: e.title,
      ...(startDate ? { startDate } : {}),
      ...(endDate ? { endDate } : {}),
      ...(withDescription && e.description ? { description: e.description } : {}),
      worksFor: { "@type": "Organization", name: e.company },
    };
  });
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

/**
 * Structured price from the displayed pricing text, e.g. "$8,000 / MVP or $2,500 / week"
 * -> two UnitPriceSpecifications. Deriving it from the visible string keeps the
 * structured data in sync with the page. The page shows these as starting prices
 * ("From $2,500 / week"), so they are emitted as `minPrice`, not an exact `price`.
 */
function priceSpecifications(display: string): object[] {
  return [...display.matchAll(/\$([\d,]+)\s*\/\s*([A-Za-z]+)/g)].map((m) => ({
    "@type": "UnitPriceSpecification",
    minPrice: Number(m[1].replace(/,/g, "")),
    priceCurrency: "USD",
    unitText: m[2],
  }));
}

export function serviceSchema(input: {
  name: string;
  description: string;
  serviceType: string;
  path: string;
  areaServed?: string;
  /** Displayed starting price, e.g. "$2,500 / week". */
  price?: string;
  /** Displayed pricing model, used as the Offer description. */
  priceModel?: string;
}): object {
  const url = `${SITE_URL}${input.path}`;
  const specs = input.price ? priceSpecifications(input.price) : [];
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${url}#service`,
    name: input.name,
    description: input.description,
    serviceType: input.serviceType,
    url,
    provider: { "@id": PERSON_ID },
    areaServed: input.areaServed || "Worldwide",
    ...(specs.length
      ? {
          offers: {
            "@type": "Offer",
            url,
            ...(input.priceModel ? { description: input.priceModel } : {}),
            priceSpecification: specs.length === 1 ? specs[0] : specs,
          },
        }
      : {}),
  };
}
