import type { Metadata } from "next";
import { Navbar } from "../../components/navbar";
import { Skills } from "../../components/skills";
import { Footer } from "../../components/footer";
import { PageJsonLd } from "../../components/page-json-ld";
import { buildMetadata, breadcrumbList, webPageSchema } from "@/lib/seo";
import { getSkills } from "@/lib/data";

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
  const groups = await getSkills();
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

  return (
    <>
      <PageJsonLd data={schema} />
      <Navbar />
      <main id="main" tabIndex={-1} className="relative pt-24 outline-none">
        <Skills groups={groups} headingAs="h1" />
      </main>
      <Footer />
    </>
  );
}
