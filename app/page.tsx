import type { Metadata } from "next";
import { PageJsonLd } from "../components/page-json-ld";
import { Navbar } from "../components/navbar";
import { Hero } from "../components/hero";
import { About } from "../components/about";
import { Skills } from "../components/skills";
import { Experience } from "../components/experience";
import { Projects } from "../components/projects";
import { Contact } from "../components/contact";
import { Footer } from "../components/footer";
import { VisitBeacon } from "../components/visit-beacon";
import { buildMetadata, breadcrumbList, webPageSchema, PERSON_ID, PERSON_IMAGE } from "@/lib/seo";
import { SITE } from "@/lib/config";
import { PROFILE, SAME_AS } from "@/lib/profile";
import { getExperience, getPersonal, getProjects, getSkills } from "@/lib/data";

export const revalidate = 86400;

// First portfolio commit — the ProfilePage's creation date.
const SITE_CREATED = "2025-06-04T16:29:27+05:30";

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

export default async function Home() {
  const [personal, skills, experience, projects] = await Promise.all([
    getPersonal(),
    getSkills(),
    getExperience(),
    getProjects(),
  ]);

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
      <VisitBeacon />
      <Navbar />
      <main id="main" tabIndex={-1} className="relative outline-none">
        <Hero intro={personal.intro} resumeUrl={personal.resumeUrl} />
        <About personal={personal} projectCount={projects.length} />
        <Skills groups={skills} />
        <Experience items={experience} />
        <Projects projects={projects} />
        <Contact personal={personal} />
      </main>
      <Footer />
    </>
  );
}
