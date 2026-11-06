import type { Metadata } from "next";
import { Navbar } from "../../components/navbar";
import { Footer } from "../../components/footer";
import { PageJsonLd } from "../../components/page-json-ld";
import { buildMetadata, breadcrumbList, webPageSchema } from "@/lib/seo";
import { SERVICES } from "@/lib/services";
import { SITE_URL } from "@/lib/config";
import { Accent, ButtonLink } from "../../components/ui/primitives";
import { ContactBand, PageMotif, SubpageHeader } from "../../components/pages/projects/subpage-header";
import { ServiceIndex } from "../../components/pages/services/service-index";

export const revalidate = 86400;

export const metadata: Metadata = buildMetadata({
  path: "/services",
  title: "Services",
  description:
    "Freelance services by Raish Momin — Next.js & React development, MERN stack apps, DevOps & AWS consulting, and Node.js API engineering. Remote, worldwide.",
  keywords: [
    "freelance developer services",
    "Next.js freelancer",
    "MERN stack developer",
    "AWS DevOps consultant",
    "Node.js API developer",
    "hire full stack developer",
  ],
});

export default function ServicesIndex() {
  const services = Object.values(SERVICES);

  const schema: object[] = [
    webPageSchema({
      type: "CollectionPage",
      name: "Services — Raish Momin",
      description: metadata.description as string,
      path: "/services",
    }),
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      numberOfItems: services.length,
      itemListElement: services.map((s, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: {
          "@type": "Service",
          "@id": `${SITE_URL}/services/${s.slug}#service`,
          name: s.h1,
          // The tagline is the description visible in each /services row (structured data mirrors the page).
          description: s.tagline,
          url: `${SITE_URL}/services/${s.slug}`,
          serviceType: s.serviceType,
          provider: { "@id": `${SITE_URL}#person` },
        },
      })),
    },
    breadcrumbList([
      { name: "Home", path: "/" },
      { name: "Services", path: "/services" },
    ]),
  ];

  return (
    <>
      <PageJsonLd data={schema} />
      <Navbar />
      <main id="main" tabIndex={-1} className="relative outline-none">
        <SubpageHeader
          kicker={`~/services · ${services.length} engagements`}
          title={
            <>
              How I help <Accent>teams ship.</Accent>
            </>
          }
          lead="Four focused engagements — pick the one that matches the work. All remote, all async-first, all priced before we start."
          aside={<PageMotif />}
        />
        <ServiceIndex services={services} />
        <ContactBand
          title={
            <>
              Not sure which fits? <Accent>Ask me.</Accent>
            </>
          }
        >
          <ButtonLink href="/contact">Get in touch</ButtonLink>
          <ButtonLink href="/projects" variant="ghost">
            See projects
          </ButtonLink>
        </ContactBand>
      </main>
      <Footer />
    </>
  );
}
