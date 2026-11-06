import type { Metadata } from "next";
import { Navbar } from "../../components/navbar";
import { Footer } from "../../components/footer";
import { PageJsonLd } from "../../components/page-json-ld";
import { toFormationData } from "../../components/cluster/formation-data";
import { Accent, Kicker } from "../../components/ui/primitives";
import { RelatedPages, SubpageIntro } from "../../components/pages/about/subpage";
import { StackMap, TopTechnologies } from "../../components/pages/skills/stack-map";
import { buildMetadata, breadcrumbList, webPageSchema } from "@/lib/seo";
import { getExperience, getProjects, getSkills } from "@/lib/data";

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
  const [groups, projects, experience] = await Promise.all([getSkills(), getProjects(), getExperience()]);
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
  const motif = toFormationData({ skills: groups, experience, featuredProjects: projects.slice(0, 6) });

  return (
    <>
      <PageJsonLd data={schema} />
      <Navbar />
      <main id="main" tabIndex={-1} className="relative pt-24 outline-none">
        <SubpageIntro
          crumb="Skills"
          title={
            <>
              Skills — <Accent>tools I reach for.</Accent>
            </>
          }
          lead="A working stack honed across years of shipping. Comfortable across the stack, opinionated where it matters."
          motif={motif}
        >
          <Kicker className="mt-6">
            {skills.length} skills · {groups.length} groups · {projects.length} projects
          </Kicker>
        </SubpageIntro>

        <StackMap groups={groups} projects={projects} />
        <TopTechnologies projects={projects} />

        <RelatedPages kicker="03 · next" keys={["projects", "experience", "services", "about"]} />
      </main>
      <Footer />
    </>
  );
}
