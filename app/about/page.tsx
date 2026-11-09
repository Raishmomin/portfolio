import type { Metadata } from "next";
import { Navbar } from "../../components/navbar";
import { Footer } from "../../components/footer";
import { PageJsonLd } from "../../components/page-json-ld";
import { Accent, ButtonLink } from "../../components/ui/primitives";
import { AvailabilityLine, RelatedPages } from "../../components/pages/about/subpage";
import { PageIntro, StatTiles, reveal } from "../../components/pages/ui";
import { pageNeuralData } from "../../components/pages/neural";
import { CareerJourney } from "../../components/pages/about/journey";
import { skillCount } from "@/lib/derive";
import { AboutBio } from "../../components/pages/about/bio";
import { QuickFacts } from "../../components/pages/about/quick-facts";
import { FaqSection } from "../../components/pages/about/faq-list";
import {
  buildMetadata,
  breadcrumbList,
  webPageSchema,
  faqPageSchema,
  PERSON_ID,
} from "@/lib/seo";
import { FAQS } from "@/lib/faqs";
import { experienceLabel } from "@/lib/profile";
import { getExperience, getPersonal, getProjects, getSkills } from "@/lib/data";
import { NeuralStage, isAiProject } from "../../components/neural";

export const revalidate = 86400;

// Evaluated per render, not at module load: the years figure changes each September.
const aboutDescription = () =>
  `Learn more about Raish Momin — a full-stack developer with ${experienceLabel()} years of experience building production React, Node.js, and cloud infrastructure.`;

export function generateMetadata(): Metadata {
  return buildMetadata({
    path: "/about",
    title: "About",
    description: aboutDescription(),
    keywords: [
      "About Raish Momin",
      "Full Stack Developer biography",
      "React Next.js engineer",
      "Node.js developer",
      "DevOps engineer profile",
    ],
  });
}

export default async function AboutPage() {
  const [personal, projects, experience, skills, neural] = await Promise.all([
    getPersonal(),
    getProjects(),
    getExperience(),
    getSkills(),
    pageNeuralData(),
  ]);
  const faqs = FAQS["/about"] ?? [];
  const schema = [
    webPageSchema({
      type: "AboutPage",
      name: "About — Raish Momin",
      description: aboutDescription(),
      path: "/about",
      mainEntity: PERSON_ID,
    }),
    faqPageSchema(faqs, "/about"),
    breadcrumbList([
      { name: "Home", path: "/" },
      { name: "About", path: "/about" },
    ]),
  ];
  const technologies = skillCount(skills);
  const aiCount = projects.filter(isAiProject).length;
  const stats = [
    { value: personal.years, suffix: "+", label: "years shipping" },
    { value: projects.length, label: "projects shipped" },
    { value: aiCount, label: "AI projects", ai: true },
    { value: technologies, label: "technologies" },
  ];

  return (
    <>
      <PageJsonLd data={schema} />
      <Navbar />
      <main id="main" tabIndex={-1} className="relative outline-none">
        <NeuralStage data={neural} />
        <PageIntro
          crumbs={[{ name: "Home", href: "/" }, { name: "About" }]}
          kicker="~/about · full stack · devops · ai"
          scene="hero"
          note="The 3D brain is a neural network of thousands of glowing neurons: signals fire along its connections, and it turns toward your cursor."
          title={
            <>
              About {personal.name} — <Accent>obsessed with detail.</Accent>
            </>
          }
          lead="Curious by default, methodical by training. I care about how things feel as much as how they ship."
        >
          <StatTiles stats={stats} className="mt-8 max-w-[36rem]" />
          <div className="mt-9 flex flex-wrap gap-3" {...reveal(480)}>
            <ButtonLink href={`mailto:${personal.email}`} data-magnetic="">
              Email me
            </ButtonLink>
            {personal.resumeUrl ? (
              <ButtonLink href={personal.resumeUrl} variant="ghost">
                Résumé ↗<span className="sr-only"> (opens in a new tab)</span>
              </ButtonLink>
            ) : null}
          </div>
          <AvailabilityLine className="mt-7 text-[15px]" />
        </PageIntro>

        <AboutBio personal={personal} projectCount={projects.length} skillCount={technologies} />
        <CareerJourney experience={experience} />
        <QuickFacts experience={experience} />
        <FaqSection
          faqs={faqs}
          index="04"
          stage="left"
          title={
            <>
              Frequently asked, <Accent>plainly answered.</Accent>
            </>
          }
        />
        <RelatedPages index="05" stage="full" scene="contact" keys={["projects", "experience", "services", "contact"]} />
      </main>
      <Footer />
    </>
  );
}
