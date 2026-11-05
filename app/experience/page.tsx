import type { Metadata } from "next";
import { Navbar } from "../../components/navbar";
import { Experience } from "../../components/experience";
import { Footer } from "../../components/footer";
import { PageJsonLd } from "../../components/page-json-ld";
import { buildMetadata, breadcrumbList, employeeRoles, webPageSchema } from "@/lib/seo";
import { getExperience } from "@/lib/data";

export const revalidate = 86400;

export const metadata: Metadata = buildMetadata({
  path: "/experience",
  title: "Experience",
  description:
    "Work experience timeline of Raish Momin — from junior developer to senior full-stack engineer, across React, Node.js, TypeScript, and cloud infrastructure.",
  keywords: [
    "Raish Momin experience",
    "Full Stack engineer roles",
    "Senior developer experience",
    "DevOps engineer experience",
    "Career timeline",
  ],
});

export default async function ExperiencePage() {
  const experience = await getExperience();

  const schema: object[] = [
    webPageSchema({
      type: "CollectionPage",
      name: "Experience — Raish Momin",
      description: metadata.description as string,
      path: "/experience",
    }),
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      numberOfItems: experience.length,
      // Same EmployeeRole nodes (same @id) as Person.worksFor in components/json-ld.tsx.
      itemListElement: employeeRoles(experience, { withDescription: true }).map((role, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: role,
      })),
    },
    breadcrumbList([
      { name: "Home", path: "/" },
      { name: "Experience", path: "/experience" },
    ]),
  ];

  return (
    <>
      <PageJsonLd data={schema} />
      <Navbar />
      <main id="main" tabIndex={-1} className="relative pt-24 outline-none">
        <Experience items={experience} headingAs="h1" />
      </main>
      <Footer />
    </>
  );
}
