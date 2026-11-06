import type { Metadata } from "next";
import { Navbar } from "../../components/navbar";
import { Footer } from "../../components/footer";
import { PageJsonLd } from "../../components/page-json-ld";
import { buildMetadata, breadcrumbList, webPageSchema } from "@/lib/seo";
import { SERVICES } from "@/lib/services";
import { SITE_URL } from "@/lib/config";
import { Accent, ButtonLink } from "../../components/ui/primitives";
import { NeuralStage } from "../../components/neural";
import { ServiceIndex } from "../../components/pages/services/service-index";
import { CtaSection } from "../../components/pages/cta";
import { PageIntro, PageSection, SectionHead, card, part } from "../../components/pages/ui";
import { pageNeuralData } from "../../components/pages/neural";

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

export default async function ServicesIndex() {
  const services = Object.values(SERVICES);
  const neural = await pageNeuralData();

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
        <NeuralStage data={neural} />
        <PageIntro
          crumbs={[{ name: "Home", href: "/" }, { name: "Services" }]}
          kicker={`~/services · ${services.length} engagements`}
          scene="ambient"
          title={
            <>
              How I help <Accent>teams ship.</Accent>
            </>
          }
          lead="Four focused engagements — pick the one that matches the work. All remote, all async-first, all priced before we start."
        >
          <div className="mt-9 flex flex-wrap gap-3">
            <ButtonLink href="#engagements" data-magnetic="">
              See the engagements <span aria-hidden="true">↓</span>
            </ButtonLink>
            <ButtonLink href="/contact" variant="ghost">
              Ask a question
            </ButtonLink>
          </div>
        </PageIntro>

        <ServiceIndex services={services} />

        {/* Not a fifth engagement: no price and no Service node, so the ItemList above stays the four. */}
        <PageSection id="interactive" section="interactive" scene="hero" stage="right" labelledBy="interactive-heading">
          <div {...card()} className="panel p-6 md:p-10 lg:ml-auto lg:max-w-[40rem]">
            <SectionHead
              id="interactive-heading"
              index="02"
              kicker="also · interactive & 3D"
              title={
                <>
                  Interactive and <Accent>3D web experiences.</Accent>
                </>
              }
              scene="The network on the left is drawn live in your browser with WebGL; every word on this page stays server-rendered HTML."
            />
            <p {...part} className="mt-5 text-[17px] leading-7 text-muted-foreground">
              I also build animated, interactive sites: 3D scenes with React Three Fiber and WebGL, scroll-driven
              animation, and visuals that stay fast and readable. This site is one of them. Its home page is a 3D
              neural network that changes with each section.
            </p>
            <div {...part} className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/contact" data-magnetic="">
                Ask about a 3D site <span aria-hidden="true">→</span>
              </ButtonLink>
              <ButtonLink href="/" variant="ghost">
                See the home page
              </ButtonLink>
            </div>
          </div>
        </PageSection>

        <CtaSection
          stage="band"
          index="03"
          title={
            <>
              Not sure which fits? <Accent>Ask me.</Accent>
            </>
          }
          primary={{ href: "/contact", label: "Get in touch" }}
          secondary={{ href: "/projects", label: "See projects" }}
        />
      </main>
      <Footer />
    </>
  );
}
