import type { Metadata } from "next";
import { Navbar } from "../../components/navbar";
import { Footer } from "../../components/footer";
import { PageJsonLd } from "../../components/page-json-ld";
import { Accent, Kicker } from "../../components/ui/primitives";
import { RelatedPages, SubpageIntro } from "../../components/pages/about/subpage";
import { ExperienceTimeline } from "../../components/pages/experience/timeline";
import { buildMetadata, breadcrumbList, employeeRoles, webPageSchema } from "@/lib/seo";
import { careerStartLabel, sortRoles } from "@/lib/llms";
import { experienceLabel } from "@/lib/profile";
import { getExperience } from "@/lib/data";
import { count } from "../../components/pages/motion";

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
  const motif = { label: "neural · career", value: `since ${careerStartLabel}` };

  return (
    <>
      <PageJsonLd data={schema} />
      <Navbar />
      <main id="main" tabIndex={-1} className="relative pt-24 outline-none">
        <SubpageIntro
          crumb="Experience"
          title={
            <>
              Experience — <Accent>a working timeline.</Accent>
            </>
          }
          lead="Roles, projects, and the through-line that connects them."
          motif={motif}
        >
          <Kicker className="mt-6">
            {experienceLabel()} years · <span {...count(roles.length)}>{roles.length}</span> roles ·{" "}
            <span {...count(companies)}>{companies}</span> companies · since {careerStartLabel}
          </Kicker>
        </SubpageIntro>

        <ExperienceTimeline roles={roles} />

        <RelatedPages kicker="02 · next" keys={["projects", "skills", "about", "contact"]} />
      </main>
      <Footer />
    </>
  );
}
