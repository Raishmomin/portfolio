import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { Navbar } from "../../components/navbar";
import { Projects } from "../../components/projects";
import { Footer } from "../../components/footer";
import { PageJsonLd } from "../../components/page-json-ld";
import { buildMetadata, breadcrumbList, webPageSchema } from "@/lib/seo";
import { SITE_URL } from "@/lib/config";
import { TAGS } from "@/lib/cache-tags";
import clientPromise from "@/lib/mongodb";

export const revalidate = 86400;

export const metadata: Metadata = buildMetadata({
  path: "/projects",
  title: "Projects",
  description:
    "Explore selected projects by Raish Momin — full-stack web applications, DevOps pipelines, and commerce APIs built with React, Node.js, and AWS.",
  keywords: [
    "Raish Momin projects",
    "Full Stack projects",
    "Next.js projects",
    "Node.js projects",
    "DevOps pipelines",
    "Portfolio projects",
  ],
});

type ProjectDoc = {
  title?: string;
  description?: string;
  liveUrl?: string;
  technologies?: string[];
  category?: string[];
};

const getProjects = unstable_cache(
  async (): Promise<ProjectDoc[]> => {
    try {
      const client = await clientPromise;
      const db = client.db("Portfolio");
      const docs = await db
        .collection("projects")
        .find({})
        .sort({ sort: -1 })
        .collation({ locale: "en_US", numericOrdering: true })
        .toArray();
      return JSON.parse(JSON.stringify(docs));
    } catch {
      return [];
    }
  },
  ["projects-list"],
  { tags: [TAGS.projects], revalidate: 86400 }
);

export default async function ProjectsPage() {
  const projects = await getProjects();

  const schema: object[] = [
    webPageSchema({
      type: "CollectionPage",
      name: "Projects — Raish Momin",
      description: metadata.description as string,
      path: "/projects",
    }),
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      itemListOrder: "https://schema.org/ItemListOrderDescending",
      numberOfItems: projects.length,
      itemListElement: projects.map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: {
          "@type": "CreativeWork",
          name: p.title,
          description: p.description,
          url: p.liveUrl || `${SITE_URL}/projects`,
          keywords: (p.technologies || []).join(", "),
          genre: (p.category || []).join(", "),
        },
      })),
    },
    breadcrumbList([
      { name: "Home", path: "/" },
      { name: "Projects", path: "/projects" },
    ]),
  ];

  return (
    <>
      <PageJsonLd data={schema} />
      <Navbar />
      <main className="relative pt-24">
        <Projects />
      </main>
      <Footer />
    </>
  );
}
