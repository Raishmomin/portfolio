import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Navbar } from "../../components/navbar";
import { Footer } from "../../components/footer";
import { PageJsonLd } from "../../components/page-json-ld";
import { buildMetadata, breadcrumbList, webPageSchema } from "@/lib/seo";
import { SERVICES } from "@/lib/services";
import { SITE_URL } from "@/lib/config";

export const revalidate = 86400;

export const metadata: Metadata = buildMetadata({
  path: "/services",
  title: "Services",
  description:
    "Freelance services by Raish Momin — Next.js & React development, MERN stack apps, DevOps & AWS consulting, and Node.js API/backend engineering. Remote, worldwide.",
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
      itemListElement: services.map((s, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: {
          "@type": "Service",
          name: s.h1,
          description: s.metaDescription,
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
      <main className="relative pt-24">
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
          <div className="text-center mb-16 md:mb-20">
            <span className="inline-flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-muted-foreground mb-8">
              <span className="h-px w-8 bg-muted-foreground/40" />
              Services
              <span className="h-px w-8 bg-muted-foreground/40" />
            </span>
            <h1 className="heading-fluid font-semibold text-foreground mb-6">
              How I help teams ship.
            </h1>
            <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Four focused engagements — pick the one that matches the work. All remote, all
              async-first, all priced before we start.
            </p>
          </div>

          <ul className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {services.map((s) => (
              <li key={s.slug}>
                <Link
                  href={`/services/${s.slug}`}
                  className="group block h-full p-7 md:p-8 rounded-2xl border border-border bg-card hover:border-foreground/40 transition-colors"
                >
                  <h2 className="text-xl md:text-2xl font-semibold tracking-tight text-foreground mb-3 group-hover:text-foreground/80 transition-colors">
                    {s.h1}
                  </h2>
                  <p className="text-sm md:text-base text-muted-foreground leading-relaxed mb-6">
                    {s.tagline}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mb-6">
                    {s.techStack.slice(0, 5).map((t) => (
                      <span
                        key={t}
                        className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                  <span className="inline-flex items-center gap-2 text-sm font-medium text-foreground/90">
                    Explore service
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <Footer />
    </>
  );
}
