import type { Metadata } from "next";
import { Navbar } from "../../components/navbar";
import { Footer } from "../../components/footer";
import { PageJsonLd } from "../../components/page-json-ld";
import { Accent } from "../../components/ui/primitives";
import { RelatedPages } from "../../components/pages/about/subpage";
import { PageIntro, StatTiles } from "../../components/pages/ui";
import { pageNeuralData } from "../../components/pages/neural";
import { NeuralStage } from "../../components/neural";
import { ExperienceTimeline } from "../../components/pages/experience/timeline";
import { buildMetadata, breadcrumbList, employeeRoles, webPageSchema } from "@/lib/seo";
import { careerStartLabel, sortRoles } from "@/lib/llms";
import { experienceLabel, yearsOfExperience } from "@/lib/profile";
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
  const [experience, neural] = await Promise.all([getExperience(), pageNeuralData()]);
  // Newest first, and the ItemList positions follow the same visible order.
  const roles = sortRoles(experience);

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
      numberOfItems: roles.length,
      // Same EmployeeRole nodes (same @id) as Person.worksFor in components/json-ld.tsx.
      itemListElement: employeeRoles(roles, { withDescription: true }).map((role, i) => ({
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
  const companies = new Set(roles.map((r) => r.company)).size;
  const stats = [
    { value: yearsOfExperience(), suffix: "+", label: "years" },
    { value: roles.length, label: "roles" },
    { value: companies, label: "companies" },
    { value: new Set(roles.flatMap((r) => r.technologies.map((t) => t.toLowerCase()))).size, label: "technologies" },
  ];

  return (
    <>
      <PageJsonLd data={schema} />
      <Navbar />
      <main id="main" tabIndex={-1} className="relative outline-none">
        <NeuralStage data={neural} />
        <PageIntro
          crumbs={[{ name: "Home", href: "/" }, { name: "Experience" }]}
          kicker={`~/experience · since ${careerStartLabel}`}
          scene="experience"
          note="The glowing path on the right is my career, oldest to newest: one milestone per company, the current role pulsing at the end."
          title={
            <>
              Experience — <Accent>a working timeline.</Accent>
            </>
          }
          lead={`Roles, projects, and the through-line that connects them: ${experienceLabel()} years across ${companies} companies.`}
        >
          <StatTiles stats={stats} className="mt-8 max-w-[36rem]" />
        </PageIntro>

        <ExperienceTimeline roles={roles} />

        <RelatedPages index="02" stage="right" keys={["projects", "skills", "about", "contact"]} />
      </main>
      <Footer />
    </>
  );
}
