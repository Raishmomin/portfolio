import type { Metadata } from "next";
import { PageJsonLd } from "../components/page-json-ld";
import { Navbar } from "../components/navbar";
import { Footer } from "../components/footer";
import { VisitBeacon } from "../components/visit-beacon";
import { Container } from "../components/ui/primitives";
import { ClusterMonitor, SectionSpy, toFormationData } from "../components/cluster";
import { Hero } from "../components/home/hero";
import { AboutSection, ExperienceSection, StackSection } from "../components/home/sections";
import { WorkSection } from "../components/home/work";
import { ContactSection, FaqSection, ServicesSection, WritingSection } from "../components/home/more";
import { getLatestPosts } from "../components/home/latest-posts";
import { stackMap, tickerSkills } from "../components/home/derive";
import { skillCount } from "@/lib/derive";
import { sortRoles } from "@/lib/llms";
import { buildMetadata, breadcrumbList, faqPageSchema, webPageSchema, PERSON_ID, PERSON_IMAGE } from "@/lib/seo";
import { SITE } from "@/lib/config";
import { PROFILE, SAME_AS, experienceLabel } from "@/lib/profile";
import { FAQS } from "@/lib/faqs";
import { SERVICES } from "@/lib/services";
import { getExperience, getPersonal, getProjects, getSkills } from "@/lib/data";

export const revalidate = 86400;

// First portfolio commit — the ProfilePage's creation date.
const SITE_CREATED = "2025-06-04T16:29:27+05:30";

const FEATURED_COUNT = 6;

// Per render (not a module constant): SITE.description carries the derived years figure.
export function generateMetadata(): Metadata {
  return buildMetadata({
    path: "/",
    title: SITE.title,
    description: SITE.description,
    keywords: [
      "Raish Momin",
      "Full Stack Developer",
      "DevOps Engineer",
      "React developer portfolio",
      "Next.js portfolio",
      "Node.js engineer",
      "TypeScript",
      "MongoDB",
      "AWS",
      "MERN stack",
    ],
  });
}

/**
 * Home FAQ: five existing entries from app/lib/faqs.ts (experience, stack,
 * availability, time zone, response time). The same objects feed the visible
 * <details> list and the FAQPage JSON-LD, so the two never drift.
 */
function homeFaqs() {
  const about = FAQS["/about"] ?? [];
  const contact = FAQS["/contact"] ?? [];
  return [...about.slice(0, 4), ...contact.slice(0, 1)];
}

export default async function Home() {
  const [personal, skills, experience, projects, posts] = await Promise.all([
    getPersonal(),
    getSkills(),
    getExperience(),
    getProjects(),
    getLatestPosts(4),
  ]);

  const featured = projects.slice(0, FEATURED_COUNT);
  const archive = projects.slice(FEATURED_COUNT);
  const groups = stackMap(skills, projects);
  const timeline = sortRoles(experience);
  const faqs = homeFaqs();
  const formation = toFormationData({ skills, experience: timeline, featuredProjects: featured });

  const years = experienceLabel();
  const proof = [`${years} yrs`, `${projects.length} shipped projects`, ...tickerSkills(groups)];
  const stats = [
    { value: years, label: "years shipping" },
    { value: String(projects.length), label: "projects shipped" },
    { value: String(skillCount(skills)), label: "technologies" },
  ];

  // One ProfilePage node (keeps the home WebPage @id `${SITE_URL}/#webpage`).
  // mainEntity repeats the Person's required fields next to its @id, so the
  // ProfilePage validates even if a consumer does not join the separate Person
  // script block by @id (rulebook 8.2).
  const schema = [
    {
      ...webPageSchema({
        type: "ProfilePage",
        name: SITE.title,
        description: SITE.description,
        path: "/",
        mainEntity: PERSON_ID,
      }),
      mainEntity: {
        "@type": "Person",
        "@id": PERSON_ID,
        name: PROFILE.name,
        image: PERSON_IMAGE,
        sameAs: [...SAME_AS],
      },
      dateCreated: SITE_CREATED,
      dateModified: PROFILE.updatedAt,
    },
    breadcrumbList([{ name: "Home", path: "/" }]),
  ];

  return (
    <>
      <PageJsonLd data={schema} />
      <PageJsonLd data={faqPageSchema(faqs, "/")} />
      <VisitBeacon />
      <Navbar />
      <main id="main" tabIndex={-1} className="relative outline-none">
        <SectionSpy />
        <Container className="lg:grid lg:grid-cols-12 lg:gap-x-8">
          <div className="min-w-0 lg:col-span-7">
            <Hero intro={personal.intro} resumeUrl={personal.resumeUrl} proof={proof} />
            <div className="pb-16 lg:hidden">
              <ClusterMonitor variant="band" data={formation} />
            </div>
            <AboutSection bio={personal.about} stats={stats} />
            <StackSection groups={groups} />
            <ExperienceSection items={timeline} />
            <WorkSection featured={featured} archive={archive} />
            <ServicesSection services={Object.values(SERVICES)} />
            <WritingSection posts={posts} />
            <FaqSection faqs={faqs} />
            <ContactSection />
          </div>
          <div className="hidden pt-8 lg:col-span-5 lg:block">
            <div className="sticky top-24 h-[calc(100vh-128px)]">
              <ClusterMonitor variant="sticky" data={formation} />
            </div>
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}
