import type { Metadata } from "next";
import { Navbar } from "../../components/navbar";
import { Footer } from "../../components/footer";
import { PageJsonLd } from "../../components/page-json-ld";
import { buildMetadata, breadcrumbList, webPageSchema } from "@/lib/seo";
import { SERVICES } from "@/lib/services";
import { SITE_URL } from "@/lib/config";
import { Accent, ButtonLink, Container, Kicker } from "../../components/ui/primitives";
import { NeuralMotif } from "../../components/neural";
import { parallax, reveal, split } from "../../components/pages/motion";
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
          aside={<PageMotif label="neural · services" value={`${services.length} engagements`} />}
        />
        <ServiceIndex services={services} />
        {/* Not a fifth engagement: no price and no Service node, so the ItemList above stays the four. */}
        <section aria-labelledby="interactive-heading" className="border-t border-border">
          <Container className="grid gap-10 py-16 md:grid-cols-12 md:items-center md:gap-8 md:py-24">
            <div className="min-w-0 md:col-span-7" {...reveal()}>
              <Kicker>also · interactive &amp; 3D</Kicker>
              <h2
                {...split}
                id="interactive-heading"
                className="mt-3 text-balance text-[clamp(1.75rem,4vw,2.75rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-foreground"
              >
                Interactive and <Accent>3D web experiences.</Accent>
              </h2>
              <p className="mt-5 max-w-[60ch] text-[17px] leading-7 text-muted-foreground">
                I also build animated, interactive sites: 3D scenes with React Three Fiber and WebGL, scroll-driven
                animation, and visuals that stay fast and readable. This site is one of them. Its home page is a 3D
                neural network that changes with each section.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href="/contact">
                  Ask about a 3D site <span aria-hidden="true">→</span>
                </ButtonLink>
                <ButtonLink href="/" variant="ghost">
                  See the home page
                </ButtonLink>
              </div>
            </div>
            <div aria-hidden="true" className="hidden md:col-span-4 md:col-start-9 md:block" {...parallax(0.35)}>
              <NeuralMotif className="ml-auto h-auto w-full max-w-[340px]" />
            </div>
          </Container>
        </section>
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
