// Server-safe: turns DB data into NeuralData for the scenes. Pure, deterministic, no three.js.
import type { ExperienceItem, Project, SkillGroup } from "@/lib/data";
import { periodMonths, techKey } from "@/lib/derive";
import { slugify } from "@/lib/utils";
import type { NeuralData, SkillLayer } from "./types";

const LAYER: [SkillLayer, RegExp][] = [
  ["ai", /\b(ai|ml|llm|machine|deep|nlp|genai)\b/i],
  ["frontend", /front/i],
  ["backend", /back|api|server/i],
  ["database", /data|db/i],
  ["devops", /devops|cloud|infra|ops/i],
];
const AI_TERMS = /\b(ai|llm|gpt|openai|anthropic|claude|gemini|rag|agent|agentic|embedding|vector|langchain|chatbot|ml|machine learning|speech|voice|tts|stt|whisper)\b/i;

export const isAiProject = (p: Pick<Project, "title" | "description" | "technologies" | "category">) =>
  p.category.some((c) => /\bai\b/i.test(c)) || AI_TERMS.test(`${p.title} ${p.description} ${p.technologies.join(" ")}`);

/** Readable pipeline stages for an AI project, derived from its real technologies/description. */
function aiStages(p: Project): string[] {
  const text = `${p.title} ${p.description} ${p.technologies.join(" ")} ${p.features.join(" ")}`.toLowerCase();
  const stages = ["Input"];
  if (/speech|voice|audio|whisper|stt/.test(text)) stages.push("Speech-to-text");
  if (/rag|retriev|vector|embedding|qdrant|pinecone|pgvector/.test(text)) stages.push("Retrieval (RAG)");
  if (/agent/.test(text)) stages.push("Agent / tools");
  stages.push("LLM");
  if (/tts|text-to-speech|voice|speaking/.test(text)) stages.push("Text-to-speech");
  stages.push("Output");
  return stages;
}

export function toNeuralData(input: {
  skills: SkillGroup[];
  experience: ExperienceItem[];
  projects: Project[];
  featured: Project[];
}): NeuralData {
  const layerOf = (category: string): SkillLayer => LAYER.find(([, re]) => re.test(category))?.[0] ?? "backend";
  const projectKeys = input.projects.map((p) => new Set(p.technologies.map(techKey)));
  const skills = input.skills.flatMap((g) =>
    g.skills.map((s) => ({
      id: techKey(s.name),
      name: s.name,
      layer: layerOf(g.category),
      uses: projectKeys.filter((k) => k.has(techKey(s.name))).length,
    })),
  );
  const ids = skills.map((s) => s.id);
  const links: NeuralData["links"] = [];
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++) {
      const w = projectKeys.filter((k) => k.has(ids[i]) && k.has(ids[j])).length;
      if (w > 0) links.push({ a: ids[i], b: ids[j], weight: w });
    }
  const experience = [...input.experience].reverse().map((e) => ({
    company: e.company,
    role: e.title,
    period: e.period,
    months: periodMonths(e.period) ?? 12,
    current: /present|now|current/i.test(e.period),
  }));
  return {
    skills,
    links,
    experience,
    ai: input.projects.filter(isAiProject).map((p) => ({ slug: slugify(p.title), title: p.title, stages: aiStages(p) })),
    work: input.featured.map((p) => ({ slug: slugify(p.title), title: p.title, techCount: p.technologies.length, ai: isAiProject(p) })),
  };
}
