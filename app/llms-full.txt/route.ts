import { SITE, SITE_URL } from "@/lib/config";
import { PROFILE } from "@/lib/profile";
import { SERVICES } from "@/lib/services";
import { FAQS } from "@/lib/faqs";
import { getExperience, getPersonal, getProjects, getSkills } from "@/lib/data";
import {
  LLMS_HEADERS,
  contactLines,
  faqLines,
  keyFacts,
  periodLabel,
  resourceLines,
  sortRoles,
} from "@/lib/llms";

// Generated from profile.ts + the same server data the pages render
// (replaces the hand-written public/llms-full.txt at the same URL).
export const revalidate = 3600;

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const categoryLabel = (c: string) => (c.toLowerCase() === "devops" ? "DevOps" : capitalize(c));

export async function GET() {
  const [personal, skills, experience, projects] = await Promise.all([
    getPersonal(),
    getSkills(),
    getExperience(),
    getProjects(),
  ]);

  const lines: string[] = [`# ${PROFILE.name}: ${PROFILE.jobTitle}`, "", `> ${SITE.description}`, ""];

  lines.push("## Key facts", "", ...keyFacts(experience).map((f) => `- ${f}`), "");

  if (personal.about || personal.intro) {
    lines.push("## About", "");
    if (personal.intro) lines.push(personal.intro, "");
    if (personal.about && personal.about !== personal.intro) lines.push(personal.about, "");
  }

  lines.push("## Experience", "");
  for (const e of sortRoles(experience)) {
    lines.push(`### ${e.title}, ${e.company}`, "");
    lines.push(`- Period: ${periodLabel(e.period)}`);
    if (e.location) lines.push(`- Work mode: ${e.location}`);
    if (e.technologies.length) lines.push(`- Technologies: ${e.technologies.join(", ")}`);
    lines.push("");
    if (e.description) lines.push(e.description, "");
    if (e.achievements.length) lines.push(...e.achievements.map((a) => `- ${a}`), "");
  }

  lines.push("## Projects", "");
  for (const p of projects) {
    lines.push(`### ${p.title}`, "");
    if (p.description) lines.push(p.description, "");
    if (p.features.length) lines.push(...p.features.map((f) => `- ${f}`), "");
    if (p.technologies.length) lines.push(`- Technologies: ${p.technologies.join(", ")}`);
    if (p.category.length) lines.push(`- Categories: ${p.category.join(", ")}`);
    if (p.liveUrl) lines.push(`- Live: ${p.liveUrl}`);
    if (p.githubUrl) lines.push(`- Source: ${p.githubUrl}`);
    lines.push("");
  }

  lines.push("## Skills", "");
  for (const g of skills) {
    lines.push(`- ${categoryLabel(g.category)}: ${g.skills.map((s) => s.name).join(", ")}`);
  }
  lines.push("");

  lines.push("## Services", "");
  for (const s of Object.values(SERVICES)) {
    lines.push(`### ${s.h1}`, "");
    lines.push(`- URL: ${SITE_URL}/services/${s.slug}`);
    lines.push(`- Pricing: from ${s.pricing.from}. ${s.pricing.model}`);
    lines.push(`- Tech stack: ${s.techStack.join(", ")}`);
    lines.push("");
    lines.push(s.tagline, "", s.hero.solution, "");
    lines.push("Deliverables:", ...s.deliverables.map((d) => `- ${d}`), "");
    if (s.faqs.length) lines.push(...faqLines(s.faqs));
  }

  lines.push("## Frequently asked questions", "");
  for (const [path, faqs] of Object.entries(FAQS)) {
    lines.push(`### ${capitalize(path.slice(1))} (${SITE_URL}${path})`, "", ...faqLines(faqs));
  }

  lines.push("## Contact", "", ...contactLines(), "");
  lines.push("## Machine-readable resources", "", ...resourceLines(), "");

  return new Response(lines.join("\n"), { headers: LLMS_HEADERS });
}
