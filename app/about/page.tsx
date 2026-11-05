import type { Metadata } from "next";
import { Navbar } from "../../components/navbar";
import { About } from "../../components/about";
import { Footer } from "../../components/footer";
import { PageJsonLd } from "../../components/page-json-ld";
import { FAQSection } from "../../components/faq-section";
import { ProfileFacts } from "../../components/profile-facts";
import {
  buildMetadata,
  breadcrumbList,
  webPageSchema,
  faqPageSchema,
  PERSON_ID,
} from "@/lib/seo";
import { FAQS } from "@/lib/faqs";
import { experienceLabel } from "@/lib/profile";
import { getExperience, getPersonal, getProjects } from "@/lib/data";

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
  const [personal, projects, experience] = await Promise.all([
    getPersonal(),
    getProjects(),
    getExperience(),
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

  return (
    <>
      <PageJsonLd data={schema} />
      <Navbar />
      <main id="main" tabIndex={-1} className="relative pt-24 outline-none">
        <About personal={personal} projectCount={projects.length} headingAs="h1" />
        <ProfileFacts experience={experience} />
        <FAQSection faqs={faqs} />
      </main>
      <Footer />
    </>
  );
}
