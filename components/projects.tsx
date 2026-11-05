import { Section, RevealHeading } from "./section";
import { ProjectsGrid } from "./projects-grid";
import type { Project } from "@/lib/data";

const PAGE_SIZE = 5;

type ProjectsProps = {
  projects: Project[];
  headingAs?: "h1" | "h2";
  /** Render every project up front (the dedicated /projects page); otherwise page by 5. */
  showAll?: boolean;
};

export function Projects({ projects, headingAs = "h2", showAll = false }: ProjectsProps) {
  // The client island's props are serialized into the page payload: send only what a
  // card renders (it shows at most 4 features).
  const cards = projects.map((p) => ({ ...p, features: p.features.slice(0, 4) }));

  return (
    <Section
      id="projects"
      ariaLabel="Projects"
      className="bg-muted/30"
      reveal={headingAs !== "h1"}
    >
      <RevealHeading
        as={headingAs}
        id="projects"
        eyebrow="Selected work"
        title="Projects with sharp edges."
        description="A small set of things I've built and shipped — each one had a real constraint or stakeholder."
      />
      <ProjectsGrid
        projects={cards}
        pageSize={showAll ? Math.max(projects.length, PAGE_SIZE) : PAGE_SIZE}
        cardHeadingAs={headingAs === "h1" ? "h2" : "h3"}
      />
    </Section>
  );
}
