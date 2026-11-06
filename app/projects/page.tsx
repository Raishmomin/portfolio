import type { Metadata } from "next";
import { Navbar } from "../../components/navbar";
import { Footer } from "../../components/footer";
import { PageJsonLd } from "../../components/page-json-ld";
import { buildMetadata, breadcrumbList, webPageSchema } from "@/lib/seo";
import { getProjects } from "@/lib/data";
import { projectTechCount } from "@/lib/derive";
import { Accent, ButtonLink, Container } from "../../components/ui/primitives";
import { ContactBand, PageMotif, SubpageHeader } from "../../components/pages/projects/subpage-header";
import { ProjectIndex } from "../../components/pages/projects/project-index";
import { ProjectFilter } from "../../components/pages/projects/project-filter";
import { categoryChips } from "../../components/pages/projects/categories";
import { isAiProject } from "../../components/neural";
import { count } from "../../components/pages/motion";

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

  const live = projects.filter((p) => p.liveUrl).length;
  // Distinct technologies across the projects (same matching rule as every stack count).
  const techCount = projectTechCount(projects);
  const aiCount = projects.filter(isAiProject).length;

  return (
    <>
      <PageJsonLd data={schema} />
      <Navbar />
      <main id="main" tabIndex={-1} className="relative outline-none">
        <SubpageHeader
          kicker={`~/projects · ${projects.length} shipped`}
          title={
            <>
              Projects with <Accent>sharp edges.</Accent>
            </>
          }
          lead="A small set of things I've built and shipped — each one had a real constraint or stakeholder. Every project is listed here with its stack, features and links."
          aside={<PageMotif label="neural · projects" value={`${aiCount} / ${projects.length} use AI`} />}
        >
          <dl className="mt-8 flex flex-wrap gap-x-8 gap-y-2 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground tabular-nums">
            <div className="flex gap-2">
              <dt>Projects</dt>
              <dd className="text-foreground" {...count(projects.length)}>
                {projects.length}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt>Live</dt>
              <dd className="text-foreground" {...count(live)}>
                {live}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt>Technologies used</dt>
              <dd className="text-foreground" {...count(techCount)}>
                {techCount}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt>Use AI</dt>
              <dd className="text-foreground" {...count(aiCount)}>
                {aiCount}
              </dd>
            </div>
          </dl>
        </SubpageHeader>

        <section aria-label="All projects" className="border-t border-border">
          <Container className="pb-8 pt-8">
            <ProjectFilter chips={categoryChips(projects)} total={projects.length} />
          </Container>
          <Container className="pb-16 md:pb-24">
            <ProjectIndex projects={projects} />
          </Container>
        </section>

        <ContactBand
          title={
            <>
              Have a product to ship? <Accent>Let&apos;s talk.</Accent>
            </>
          }
        >
          <ButtonLink href="/contact">Start a project</ButtonLink>
          <ButtonLink href="/services" variant="ghost">
            See services
          </ButtonLink>
        </ContactBand>
      </main>
      <Footer />
    </>
  );
}
