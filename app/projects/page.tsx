import type { Metadata } from "next";
import { Navbar } from "../../components/navbar";
import { Projects } from "../../components/projects";
import { Footer } from "../../components/footer";
import { PageJsonLd } from "../../components/page-json-ld";
import { buildMetadata, breadcrumbList, webPageSchema } from "@/lib/seo";
import { getProjects } from "@/lib/data";

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
          // No listing-page fallback: four works sharing one url would read as one.
          ...(p.liveUrl || p.githubUrl ? { url: p.liveUrl || p.githubUrl } : {}),
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
      <main id="main" tabIndex={-1} className="relative pt-24 outline-none">
        <Projects projects={projects} headingAs="h1" showAll />
      </main>
      <Footer />
    </>
  );
}
