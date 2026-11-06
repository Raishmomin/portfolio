import type { Metadata } from "next";
import { PageJsonLd } from "../components/page-json-ld";
import { Navbar } from "../components/navbar";
import { Footer } from "../components/footer";
import { VisitBeacon } from "../components/visit-beacon";
import { NeuralStage, isAiProject, toNeuralData } from "../components/neural";
import { Hero } from "../components/home/hero";
import { ExperienceSection, StackSection } from "../components/home/sections";
import { AiSection } from "../components/home/ai";
import { WorkSection } from "../components/home/work";
import { ContactSection, FaqSection, ServicesSection, WritingSection } from "../components/home/more";
import { getLatestPosts } from "../components/home/latest-posts";
import { skillLayers } from "../components/home/derive";
import { NavSpy } from "../components/home/nav-spy";
import { ErrorBoundary } from "../components/ui/error-boundary";
import { skillCount } from "@/lib/derive";
import { sortRoles } from "@/lib/llms";
import { slugify } from "@/lib/utils";
import { buildMetadata, breadcrumbList, faqPageSchema, webPageSchema, PERSON_ID, PERSON_IMAGE } from "@/lib/seo";
import { SITE } from "@/lib/config";
import { PROFILE, SAME_AS, yearsOfExperience } from "@/lib/profile";
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
  const timeline = sortRoles(experience); // newest first
  const faqs = homeFaqs();
  const neural = toNeuralData({ skills, experience: timeline, projects, featured });

  // The DOM mirrors the 3D scenes: same skill ids, same oldest→newest career path,
  // same AI projects in the same order (card i = scene step i).
  const bySlug = new Map(projects.map((p) => [slugify(p.title), p]));
  const aiSteps = neural.ai.flatMap((a) => {
    const project = bySlug.get(a.slug);
    return project ? [{ ...a, project }] : [];
  });
  const career = [...timeline].reverse().map((e, i) => ({ ...e, months: neural.experience[i].months, current: neural.experience[i].current }));

  const stats = [
    { value: yearsOfExperience(), suffix: "+", label: "years shipping" },
    { value: projects.length, label: "projects shipped" },
    { value: projects.filter(isAiProject).length, label: "AI projects", ai: true },
    { value: skillCount(skills), label: "technologies" },
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
        {/* A 3D failure (WebGL loss, a scene bug) must never take the page with it. */}
        <ErrorBoundary>
          <NeuralStage data={neural} />
        </ErrorBoundary>
        <NavSpy />
        <Hero intro={personal.intro} resumeUrl={personal.resumeUrl} stats={stats} />
        <StackSection layers={skillLayers(neural.skills)} linkCount={neural.links.length} />
        <ExperienceSection items={career} years={yearsOfExperience()} />
        <AiSection steps={aiSteps} total={projects.length} />
        <WorkSection featured={featured} archive={archive} />
        <ServicesSection services={Object.values(SERVICES)} />
        <WritingSection posts={posts} />
        <FaqSection faqs={faqs} />
        <ContactSection />
      </main>
      <Footer />
    </>
  );
}
