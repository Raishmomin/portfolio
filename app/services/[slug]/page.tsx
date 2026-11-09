import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Navbar } from "../../../components/navbar";
import { Footer } from "../../../components/footer";
import { PageJsonLd } from "../../../components/page-json-ld";
import { ServicePage } from "../../../components/service-page";
import {
  buildMetadata,
  breadcrumbList,
  faqPageSchema,
  serviceSchema,
  webPageSchema,
} from "@/lib/seo";
import { SERVICES, SERVICE_SLUGS } from "@/lib/services";
import { SITE_URL } from "@/lib/config";
import { NeuralStage } from "../../../components/neural";
import { pageNeuralData } from "../../../components/pages/neural";

export const revalidate = 86400;
// The services are fixed at build time: any other slug 404s at routing, which serves
// the full not-found page instead of an on-demand render.
export const dynamicParams = false;

export function generateStaticParams() {
  return SERVICE_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const config = SERVICES[slug];
  if (!config) return { title: "Service Not Found" };

  return buildMetadata({
    path: `/services/${config.slug}`,
    title: config.metaTitle,
    description: config.metaDescription,
    keywords: config.keywords,
    image: `/services/${config.slug}/opengraph-image`,
    ogTitle: config.metaTitle,
    ogDescription: config.metaDescription,
  });
}

export default async function ServiceRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const config = SERVICES[slug];
  if (!config) notFound();

  const neural = await pageNeuralData();
  const path = `/services/${config.slug}`;
  const schema: object[] = [
    webPageSchema({
      name: config.h1,
      description: config.metaDescription,
      path,
      mainEntity: `${SITE_URL}${path}#service`,
    }),
    serviceSchema({
      name: config.h1,
      description: config.metaDescription,
      serviceType: config.serviceType,
      path,
      areaServed: "Worldwide",
      price: config.pricing.from,
      priceModel: config.pricing.model,
    }),
    faqPageSchema(config.faqs, path),
    breadcrumbList([
      { name: "Home", path: "/" },
      { name: "Services", path: "/services" },
      { name: config.h1, path },
    ]),
  ];

  return (
    <>
      <PageJsonLd data={schema} />
      <Navbar />
      <main id="main" tabIndex={-1} className="relative outline-none">
        <NeuralStage data={neural} />
        <ServicePage config={config} />
      </main>
      <Footer />
    </>
  );
}
