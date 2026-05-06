import type { Metadata } from "next";
import { Navbar } from "../../components/navbar";
import { Experience } from "../../components/experience";
import { Footer } from "../../components/footer";
import { PageJsonLd } from "../../components/page-json-ld";
import { buildMetadata, breadcrumbList, webPageSchema } from "@/lib/seo";
import clientPromise from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildMetadata({
  path: "/experience",
  title: "Experience",
  description:
    "Work experience timeline of Raish Momin — from junior developer to senior full-stack engineer, with roles spanning React, Node.js, TypeScript, and cloud infrastructure.",
  keywords: [
    "Raish Momin experience",
    "Full Stack engineer roles",
    "Senior developer experience",
    "DevOps engineer experience",
    "Career timeline",
  ],
});

type ExperienceDoc = {
  title?: string;
  company?: string;
  period?: string;
  description?: string;
};

async function getExperience(): Promise<ExperienceDoc[]> {
  try {
    const client = await clientPromise;
    const db = client.db("Portfolio");
    const docs = await db.collection("experience").find({}).toArray();
    return JSON.parse(JSON.stringify(docs));
  } catch {
    return [];
  }
}

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
      itemListElement: experience.map((e, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: {
          "@type": "OrganizationRole",
          roleName: e.title,
          startDate: e.period?.split("—")[0]?.trim(),
          endDate: e.period?.split("—")[1]?.trim(),
          description: e.description,
          memberOf: { "@type": "Organization", name: e.company },
        },
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
      <main className="relative pt-24">
        <Experience />
      </main>
      <Footer />
    </>
  );
}
