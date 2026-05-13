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

export const revalidate = 86400;

export function generateStaticParams() {
  return SERVICE_SLUGS.map((slug) => ({ slug }));
}

export function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Metadata {
  const config = SERVICES[params.slug];
  if (!config) return { title: "Service Not Found" };

  return buildMetadata({
    path: `/services/${config.slug}`,
    title: config.metaTitle,
    description: config.metaDescription,
    keywords: config.keywords,
    ogTitle: config.metaTitle,
    ogDescription: config.metaDescription,
  });
}

export default function ServiceRoute({ params }: { params: { slug: string } }) {
  const config = SERVICES[params.slug];
  if (!config) notFound();

  const path = `/services/${config.slug}`;
  const schema: object[] = [
    webPageSchema({
      type: "Service",
      name: config.h1,
      description: config.metaDescription,
      path,
    }),
    serviceSchema({
      name: config.h1,
      description: config.metaDescription,
      serviceType: config.serviceType,
      path,
      areaServed: "Worldwide",
      priceRange: config.pricing.from,
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
      <main>
        <ServicePage config={config} />
      </main>
      <Footer />
    </>
  );
}
