// Server-safe: turns DB data into NeuralData for the scenes. Pure, deterministic, no three.js.
import type { ExperienceItem, Project, SkillGroup } from "@/lib/data";
import { periodMonths, techKey } from "@/lib/derive";
import { SERVICES } from "@/lib/services";
import { LOCATION_LABEL, PROFILE, SOCIAL_PROFILES, yearsOfExperience } from "@/lib/profile";
import { slugify } from "@/lib/utils";
import type { ArchTech, ArchTier, NeuralData, SkillLayer } from "./types";

const LAYER: [SkillLayer, RegExp][] = [
  ["ai", /\b(ai|ml|llm|machine|deep|nlp|genai)\b/i],
  ["frontend", /front/i],
  ["backend", /back|api|server/i],
  ["database", /data|db/i],
  ["devops", /devops|cloud|infra|ops/i],
];
/** Real AI technology in a project's stack (names alone like "Matrix AI" never count). */
const AI_TECH =
  /\b(openai|gpt|anthropic|claude|gemini|llm|llama|mistral|langchain|llamaindex|hugging ?face|qdrant|pinecone|weaviate|chroma|pgvector|vector|rag|embeddings?|whisper|tts|text-to-speech|speech-to-text|speech|elevenlabs|deepgram|tensorflow|pytorch|scikit|machine learning|ai sdk)\b/i;

/** Skill layer → architecture tier (a technology that matches a skill takes its layer). */
const TIER_OF_LAYER: Record<SkillLayer, ArchTier> = { frontend: "client", backend: "server", database: "data", devops: "infra", ai: "ai" };

/**
 * Tier of a technology no skill names, by what it is (first match wins). Order matters:
 * AI before data ("Qdrant" is a vector store for RAG), storage/data before infra
 * ("AWS S3" stores files; plain "AWS" is the cloud), APIs and runtimes before client.
 */
const TIER_RULES: [ArchTier, RegExp][] = [
  ["ai", AI_TECH],
  ["ai", /\b(groq|ollama|cohere|replicate|transformers|gemini|bedrock)\b/i],
  ["data", /sql|postgres|mongo|redis|mariadb|dynamo|firestore|firebase|supabase|prisma|drizzle|sequelize|mongoose|typeorm|\bs3\b|storage|sanity|contentful|strapi|elastic|kafka|cache/i],
  ["infra", /docker|kubernetes|\bk8s\b|\baws\b|gcp|google cloud|azure|vercel|netlify|cloudflare|nginx|linux|terraform|ansible|ci\/?cd|github actions|gitlab|jenkins|vitest|jest|playwright|cypress|foundry|hardhat|monitoring|grafana|prometheus/i],
  ["server", /\bapi\b|node|express|nest|fastify|koa|django|flask|fastapi|spring|laravel|rails|graphql|trpc|websocket|socket\.io|auth|stripe|paypal|razorpay|twilio|sendgrid|resend|bullmq|queue|worker|payload|solidity|ts-morph|zod|serverless|lambda|microservice/i],
  ["client", /react|next|angular|vue|svelte|solid|astro|vite|tailwind|css|html|mui|material|ant design|chakra|shadcn|radix|redux|zustand|jotai|query|router|i18n|axios|wagmi|viem|appkit|web3|ethers|three|gsap|framer|typescript|javascript/i],
];

/** Classify one DB technology into its architecture tier (skills first, then the rules; unknown → server). */
function tierOf(name: string, skillTier: Map<string, ArchTier>): ArchTier {
  const known = skillTier.get(techKey(name));
  if (known) return known;
  return TIER_RULES.find(([, re]) => re.test(name))?.[0] ?? "server";
}

/** A project's real stack (every listed technology, DB order, no duplicates), classified into tiers. */
function archStack(p: Project, skillTier: Map<string, ArchTier>): ArchTech[] {
  const seen = new Set<string>();
  const out: ArchTech[] = [];
  for (const name of p.technologies ?? []) {
    const key = techKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ key, name: name.trim(), tier: tierOf(name, skillTier) });
  }
  return out;
}

/** Factual AI flag: tagged "ai" in the DB category, or built with real AI technology. */
export const isAiProject = (p: Pick<Project, "technologies" | "category">) =>
  (p.category ?? []).some((c) => /\bai\b/i.test(c)) || (p.technologies ?? []).some((t) => AI_TECH.test(t));

/** Readable pipeline stages for an AI project, derived from its real technologies/description. */
function aiStages(p: Project): string[] {
  const text = `${p.title} ${p.description ?? ""} ${(p.technologies ?? []).join(" ")} ${(p.features ?? []).join(" ")}`.toLowerCase();
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
  const layerOf = (category: string): SkillLayer => LAYER.find(([, re]) => re.test(category ?? ""))?.[0] ?? "backend";
  const projects = input.projects ?? [];
  const featured = input.featured ?? [];
  const featuredSlugs = new Set(featured.map((p) => slugify(p.title)));
  const projectKeys = projects.map((p) => new Set((p.technologies ?? []).map(techKey)));
  const skills = (input.skills ?? []).flatMap((g) =>
    (g.skills ?? []).map((s) => ({
      id: techKey(s.name),
      name: s.name,
      layer: layerOf(g.category),
      uses: projectKeys.filter((k) => k.has(techKey(s.name))).length,
    })),
  );
  const skillTier = new Map(skills.map((s) => [s.id, TIER_OF_LAYER[s.layer]] as const));
  const ids = skills.map((s) => s.id);
  const links: NeuralData["links"] = [];
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++) {
      const w = projectKeys.filter((k) => k.has(ids[i]) && k.has(ids[j])).length;
      if (w > 0) links.push({ a: ids[i], b: ids[j], weight: w });
    }
  const experience = [...(input.experience ?? [])].reverse().map((e) => ({
    company: e.company,
    role: e.title,
    period: e.period,
    months: periodMonths(e.period) ?? 12,
    current: /present|now|current/i.test(e.period),
  }));
  return {
    services: Object.values(SERVICES).map((s) => ({
      slug: s.slug,
      title: s.h1,
      tagline: s.tagline,
      tech: s.techStack.map((t) => t.replace(/\s*\(.*?\)/g, "").trim()),
      deliverables: [...s.deliverables],
    })),
    facts: {
      years: yearsOfExperience(),
      location: LOCATION_LABEL,
      city: PROFILE.location.locality,
      utcOffsetMin: 330, // Asia/Kolkata (IST), no DST
      availability: PROFILE.availability,
      channels: ["Email", ...SOCIAL_PROFILES.map((p) => p.label)],
    },
    skills,
    links,
    experience,
    ai: projects.filter(isAiProject).map((p) => ({ slug: slugify(p.title), title: p.title, stages: aiStages(p) })),
    // Featured first (the home order), then every other project in DB order.
    work: [...featured, ...projects.filter((p) => !featuredSlugs.has(slugify(p.title)))].map((p) => ({
      slug: slugify(p.title),
      title: p.title,
      techCount: (p.technologies ?? []).length,
      ai: isAiProject(p),
      featured: featuredSlugs.has(slugify(p.title)),
      category: [...(p.category ?? [])],
      stack: archStack(p, skillTier),
    })),
  };
}
