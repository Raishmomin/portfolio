import type { Metadata } from "next";
import { Navbar } from "../../components/navbar";
import { Footer } from "../../components/footer";
import { PageJsonLd } from "../../components/page-json-ld";
import { buildMetadata, breadcrumbList, webPageSchema } from "@/lib/seo";
import { getProjects } from "@/lib/data";
import { Accent, ButtonLink } from "../../components/ui/primitives";
import { ProjectIndex } from "../../components/pages/projects/project-index";
import { ProjectFilter } from "../../components/pages/projects/project-filter";
import { AiPipelines } from "../../components/pages/projects/ai-pipelines";
import { categoryChips } from "../../components/pages/projects/categories";
import { CtaSection } from "../../components/pages/cta";
import { PageIntro, PageSection, SectionHead, StatTiles, column, reveal } from "../../components/pages/ui";
import { pageNeuralData } from "../../components/pages/neural";
import { NeuralStage, isAiProject } from "../../components/neural";
import { projectTechCount, topTechnologies } from "@/lib/derive";

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
  const [projects, neural] = await Promise.all([getProjects(), pageNeuralData()]);

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

  // Each project's real stack, grouped by tier (the same groups the work scene draws).
  const stacks = new Map(neural.work.map((w) => [w.slug, w.stack]));
  const live = projects.filter((p) => p.liveUrl).length;
  // Distinct technologies across the projects (same matching rule as every stack count).
  const techCount = projectTechCount(projects);
  const aiCount = projects.filter(isAiProject).length;

  // The ticker: the most used technologies (2+ projects), with their real project counts.
  const stack = topTechnologies(projects, { min: 2, limit: 20 });
  const stats = [
    { value: projects.length, label: "projects" },
    { value: live, label: "live" },
    { value: techCount, label: "technologies" },
    { value: aiCount, label: "use AI", ai: true },
  ];

  return (
    <>
      <PageJsonLd data={schema} />
      <Navbar />
      <main id="main" tabIndex={-1} className="relative outline-none">
        <NeuralStage data={neural} />
        <PageIntro
          crumbs={[{ name: "Home", href: "/" }, { name: "Projects" }]}
          kicker={`~/projects · ${projects.length} shipped`}
          scene="work"
          side="right"
          note="The 3D is a project's architecture, built from its real tech stack. Scroll the projects below and it rebuilds for each one."
          title={
            <>
              Projects with <Accent>sharp edges.</Accent>
            </>
          }
          lead="A small set of things I've built and shipped — each one had a real constraint or stakeholder. Every project is listed here with its stack, features and links."
        >
          <StatTiles stats={stats} className="mt-8 max-w-[36rem]" />
          <div className="mt-9 flex flex-wrap gap-3" {...reveal(480)}>
            <ButtonLink href="#archive" data-magnetic="">
              Browse all {projects.length} <span aria-hidden="true">↓</span>
            </ButtonLink>
            {aiCount ? (
              <ButtonLink href="#ai" variant="ghost">
                The AI work
              </ButtonLink>
            ) : null}
          </div>
        </PageIntro>

        <AiPipelines ai={neural.ai} total={projects.length} />

        {/* "right" composition: every card in one column on the right; the stage frames the
            active project's architecture in the free left half (the card at the reading
            line, or the hovered one, is the active project). Phones: no opening (the intro shows the
            architecture), so a shorter gap above the heading. */}
        <PageSection id="archive" section="archive" scene="work" stage="right" labelledBy="archive-heading" className="pt-8">
          <div className={column.right}>
            <SectionHead
              id="archive-heading"
              index={neural.ai.length ? "02" : "01"}
              kicker="archive"
              title={
                <>
                  Every project, <Accent>end to end.</Accent>
                </>
              }
              scene="The 3D draws the project you are reading as its architecture: client, server and data layers, plus AI and infra when it uses them, each node one technology from its stack. Scroll and it rebuilds project by project; hover a technology to light its node."
              lead="Filter by domain; every card lists the problem, the features I shipped and the stack, layer by layer."
            />
            <div data-marquee="" className="mt-8" aria-label={`The ${stack.length} most used technologies across the projects`} role="group">
              <ul className="flex flex-wrap justify-center">
                {stack.map((t) => (
                  <li key={t.name} className="px-1 py-1">
                    <span className="pill whitespace-nowrap">
                      {t.name} <span className="ml-1 text-foreground tabular-nums">×{t.count}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mb-6 mt-8">
              <ProjectFilter chips={categoryChips(projects)} total={projects.length} />
            </div>
            <ProjectIndex projects={projects} stacks={stacks} />
          </div>
        </PageSection>

        <CtaSection
          stage="band"
          index={neural.ai.length ? "03" : "02"}
          title={
            <>
              Have a product to ship? <Accent>Let&apos;s talk.</Accent>
            </>
          }
          primary={{ href: "/contact", label: "Start a project" }}
          secondary={{ href: "/services", label: "See services" }}
        />
      </main>
      <Footer />
    </>
  );
}
