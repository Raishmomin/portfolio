import type { Metadata } from "next";
import { Navbar } from "../../components/navbar";
import { Footer } from "../../components/footer";
import { PageJsonLd } from "../../components/page-json-ld";
import { toFormationData } from "../../components/cluster";
import { Accent, ButtonLink, Container, Section } from "../../components/ui/primitives";
import {
  AvailabilityLine,
  RelatedPages,
  SubpageIntro,
  SubsectionHeading,
} from "../../components/pages/about/subpage";
import { skillCount } from "@/lib/derive";
import { AboutBio } from "../../components/pages/about/bio";
import { QuickFacts } from "../../components/pages/about/quick-facts";
import { FaqList } from "../../components/pages/about/faq-list";
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
  const [personal, projects, experience, skills] = await Promise.all([
    getPersonal(),
    getProjects(),
    getExperience(),
    getSkills(),
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
  const motif = toFormationData({ skills, experience, featuredProjects: projects.slice(0, 6) });
  const technologies = skillCount(skills);

  return (
    <>
      <PageJsonLd data={schema} />
      <Navbar />
      <main id="main" tabIndex={-1} className="relative pt-24 outline-none">
        <SubpageIntro
          crumb="About"
          title={
            <>
              About {personal.name} — <Accent>obsessed with detail.</Accent>
            </>
          }
          lead="Curious by default, methodical by training. I care about how things feel as much as how they ship."
          motif={motif}
        >
          <AvailabilityLine className="mt-6" />
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href={`mailto:${personal.email}`}>Email me</ButtonLink>
            {personal.resumeUrl ? (
              <ButtonLink href={personal.resumeUrl} variant="ghost">
                Résumé ↗<span className="sr-only"> (opens in a new tab)</span>
              </ButtonLink>
            ) : null}
          </div>
        </SubpageIntro>

        <AboutBio personal={personal} projectCount={projects.length} skillCount={technologies} />
        <QuickFacts experience={experience} />

        {faqs.length ? (
          <Section id="faq" aria-labelledby="faq-heading">
            <Container className="grid gap-10 lg:grid-cols-12 lg:gap-16">
              <SubsectionHeading kicker="03 · faq" id="faq-heading" className="lg:col-span-4">
                Frequently asked questions
              </SubsectionHeading>
              <div className="min-w-0 lg:col-span-8">
                <FaqList faqs={faqs} />
              </div>
            </Container>
          </Section>
        ) : null}

        <RelatedPages kicker="04 · next" keys={["projects", "experience", "services", "contact"]} />
      </main>
      <Footer />
    </>
  );
}
