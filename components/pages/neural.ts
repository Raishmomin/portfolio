// Stage data for the subpages: the same toNeuralData() input as the home page (same
// cached getters, newest-first roles, the first six projects as the featured wall), so
// every page's 3D scenes show the same real skills, career and projects.
import { toNeuralData, type NeuralData } from "../neural";
import { getExperience, getProjects, getSkills } from "@/lib/data";
import { sortRoles } from "@/lib/llms";

/** Same featured count as app/page.tsx. */
const FEATURED_COUNT = 6;

export async function pageNeuralData(): Promise<NeuralData> {
  const [skills, experience, projects] = await Promise.all([getSkills(), getExperience(), getProjects()]);
  return toNeuralData({ skills, experience: sortRoles(experience), projects, featured: projects.slice(0, FEATURED_COUNT) });
}

/** For the 404 page: an unreachable DB must never break it (its scene is the ambient field). */
export async function safeNeuralData(): Promise<NeuralData> {
  try {
    return await pageNeuralData();
  } catch {
    return toNeuralData({ skills: [], experience: [], projects: [], featured: [] });
  }
}
