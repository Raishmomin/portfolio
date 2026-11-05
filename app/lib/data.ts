// Server-side data access for portfolio content (MongoDB "Portfolio" DB, read-only).
// Every page reads through these cached getters so the HTML is rendered on the
// server and the JSON-LD and the visible content come from the same data.
// Identity facts (email, location, social links, years) always come from
// profile.ts — raw DB values for them are ignored.
//
// DB errors are thrown, never cached: an ISR revalidation that fails keeps
// serving the last good page instead of caching an empty one.

import { unstable_cache } from "next/cache";
import clientPromise from "./mongodb";
import { TAGS } from "./cache-tags";
import { PROFILE, LOCATION_LABEL, experienceLabel, yearsOfExperience } from "./profile";

const DB_NAME = "Portfolio";
const DAY = 86400;

export type Personal = {
  name: string;
  jobTitle: string;
  email: string;
  phone: string | null;
  location: string;
  github: string;
  linkedin: string;
  x: string;
  resumeUrl: string | null;
  /** Hero intro line (DB `main_desc`). */
  intro: string;
  /** About paragraph (DB `about_desc`, falling back to `about_me`). */
  about: string;
  years: number;
  yearsLabel: string;
};

export type SkillItem = { name: string; level: number };
export type SkillGroup = { category: string; skills: SkillItem[] };

export type ExperienceItem = {
  title: string;
  company: string;
  location: string | null;
  period: string;
  description: string;
  achievements: string[];
  technologies: string[];
};

export type Project = {
  title: string;
  description: string;
  features: string[];
  technologies: string[];
  category: string[];
  liveUrl: string | null;
  githubUrl: string | null;
};

type Doc = Record<string, unknown>;

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const strOrNull = (v: unknown): string | null => str(v) || null;
const strList = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(str).filter(Boolean) : [];

async function db() {
  const client = await clientPromise;
  return client.db(DB_NAME);
}

// ---------- personal ----------

type PersonalText = {
  phone: string | null;
  resumeUrl: string | null;
  intro: string;
  about: string;
};

const getPersonalText = unstable_cache(
  async (): Promise<PersonalText> => {
    const doc = (await (await db()).collection("personal-data").findOne({})) as Doc | null;
    return {
      phone: strOrNull(doc?.phone_number),
      resumeUrl: strOrNull(doc?.resume_link),
      intro: str(doc?.main_desc),
      about: str(doc?.about_desc) || str(doc?.about_me),
    };
  },
  ["personal-data"],
  { tags: [TAGS.personal], revalidate: DAY }
);

/** DB copy hard-codes the years ("5+ years", "over 5 years"); keep it in sync with profile.ts. */
function withDerivedYears(text: string, years: number): string {
  return text
    .replace(/\b\d+\+(?=\s*years?\b)/gi, `${years}+`)
    .replace(/\b(over|more than)\s+\d+(?=\s*years?\b)/gi, `$1 ${years}`);
}

export async function getPersonal(): Promise<Personal> {
  const text = await getPersonalText();
  const years = yearsOfExperience();
  return {
    name: PROFILE.name,
    jobTitle: PROFILE.jobTitle,
    email: PROFILE.email,
    phone: text.phone,
    location: LOCATION_LABEL,
    github: PROFILE.social.github,
    linkedin: PROFILE.social.linkedin,
    x: PROFILE.social.x,
    resumeUrl: text.resumeUrl,
    intro: withDerivedYears(text.intro, years),
    about: withDerivedYears(text.about, years),
    years,
    yearsLabel: experienceLabel(),
  };
}

// ---------- skills ----------

const CATEGORY_ORDER = ["frontend", "backend", "database", "devops"];

export const getSkills = unstable_cache(
  async (): Promise<SkillGroup[]> => {
    const doc = (await (await db()).collection("skills").findOne({})) as Doc | null;
    if (!doc) return [];
    const groups: SkillGroup[] = [];
    for (const [category, value] of Object.entries(doc)) {
      if (category === "_id" || !Array.isArray(value)) continue;
      const skills = (value as Doc[])
        .map((s) => ({ name: str(s?.name), level: Number(s?.level) || 0 }))
        .filter((s) => s.name);
      if (skills.length) groups.push({ category, skills });
    }
    const rank = (c: string) => {
      const i = CATEGORY_ORDER.indexOf(c);
      return i === -1 ? CATEGORY_ORDER.length : i;
    };
    // Stable sort: known categories first, the rest keep DB order.
    return groups.sort((a, b) => rank(a.category) - rank(b.category));
  },
  ["skills-groups"],
  { tags: [TAGS.skills], revalidate: DAY }
);

// ---------- experience ----------

/** DB role titles spell it "Devops"; match PROFILE.jobTitle ("DevOps") everywhere they surface. */
const roleTitle = (v: unknown) => str(v).replace(/\bdevops\b/gi, "DevOps");

export const getExperience = unstable_cache(
  async (): Promise<ExperienceItem[]> => {
    const docs = (await (await db()).collection("experience").find({}).toArray()) as Doc[];
    return docs.map((d) => ({
      title: roleTitle(d.title),
      company: str(d.company),
      location: strOrNull(d.location),
      period: str(d.period),
      description: str(d.description),
      achievements: strList(d.achievements),
      technologies: strList(d.technologies),
    }));
  },
  ["experience-list"],
  { tags: [TAGS.experience], revalidate: DAY }
);

// ---------- projects ----------

export const getProjects = unstable_cache(
  async (): Promise<Project[]> => {
    const docs = (await (await db())
      .collection("projects")
      .find({})
      .sort({ sort: -1 })
      .collation({ locale: "en_US", numericOrdering: true })
      .toArray()) as Doc[];
    return docs.map((d) => ({
      title: str(d.title),
      description: str(d.description),
      features: strList(d.features),
      technologies: strList(d.technologies),
      category: strList(d.category),
      liveUrl: strOrNull(d.liveUrl),
      githubUrl: strOrNull(d.githubUrl),
    }));
  },
  ["projects-list"],
  { tags: [TAGS.projects], revalidate: DAY }
);
