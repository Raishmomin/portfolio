import type { Metadata } from "next";
import { Navbar } from "../../components/navbar";
import { Footer } from "../../components/footer";
import { PageJsonLd } from "../../components/page-json-ld";
import { Accent } from "../../components/ui/primitives";
import { RelatedPages } from "../../components/pages/about/subpage";
import { PageIntro, StatTiles, Where } from "../../components/pages/ui";
import { pageNeuralData } from "../../components/pages/neural";
import { NeuralStage } from "../../components/neural";
import { StackMap, TopTechnologies } from "../../components/pages/skills/stack-map";
import { buildMetadata, breadcrumbList, webPageSchema } from "@/lib/seo";
import { getProjects, getSkills } from "@/lib/data";

export const revalidate = 86400;

export const metadata: Metadata = buildMetadata({
  path: "/skills",
  title: "Skills",
  description:
    "Technical skill set of Raish Momin — proficiency across React, Next.js, TypeScript, Node.js, MongoDB, PostgreSQL, Docker, AWS, and more.",
  keywords: [
    "Raish Momin skills",
    "React skills",
    "Next.js skills",
    "Node.js skills",
    "Full Stack skills",
    "DevOps skills",
    "TypeScript",
    "MongoDB",
    "AWS",
  ],
});

export default async function SkillsPage() {
  const [groups, projects, neural] = await Promise.all([getSkills(), getProjects(), pageNeuralData()]);
  const skills = groups.flatMap((g) => g.skills.map((s) => s.name));

  const schema: object[] = [
    webPageSchema({
      name: "Skills — Raish Momin",
      description: metadata.description as string,
      path: "/skills",
    }),
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "Technical skills",
      numberOfItems: skills.length,
      itemListElement: skills.map((s, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: { "@type": "DefinedTerm", name: s },
      })),
    },
    breadcrumbList([
      { name: "Home", path: "/" },
      { name: "Skills", path: "/skills" },
    ]),
  ];
  const stats = [
    { value: skills.length, label: "skills" },
    { value: groups.length, label: "layers" },
    { value: neural.links.length, label: "connections" },
    { value: projects.length, label: "projects" },
  ];

  return (
    <>
      <PageJsonLd data={schema} />
      <Navbar />
      <main id="main" tabIndex={-1} className="relative outline-none">
        <NeuralStage data={neural} />
        <PageIntro
          crumbs={[{ name: "Home", href: "/" }, { name: "Skills" }]}
          kicker={`~/skills · ${skills.length} technologies`}
          scene="stack"
          note={
            <>
              The network <Where desk="on the right" phone="above" /> is my stack: one node per skill, one ring per layer, linked wherever
              two tools shipped together.
            </>
          }
          title={
            <>
              Skills — <Accent>tools I reach for.</Accent>
            </>
          }
          lead="A working stack honed across years of shipping. Comfortable across the stack, opinionated where it matters."
        >
          <StatTiles stats={stats} className="mt-8 max-w-[36rem]" />
        </PageIntro>

        <StackMap groups={groups} projects={projects} />
        <TopTechnologies projects={projects} />

        <RelatedPages index="03" stage="left" keys={["projects", "experience", "services", "about"]} />
      </main>
      <Footer />
    </>
  );
}
