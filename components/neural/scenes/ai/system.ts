// What an AI project's system is made of, from real data only (pure and server-safe: no
// three.js). The stages come from NeuralData.ai[i].stages; the roles inside them (which
// models, vector store, agent framework, speech service) come from the project's own
// technology list, exactly as the DB names them. The home AI cards render the same roles
// as text, so every 3D label duplicates server HTML.

export type StageKind = "input" | "stt" | "rag" | "agent" | "llm" | "tts" | "output" | "generic";
/** What the system takes in: a chat prompt, source code, or speech. */
export type InputKind = "chat" | "code" | "voice";

export function stageKind(name: string): StageKind {
  const n = name.trim();
  if (/^input$/i.test(n)) return "input";
  if (/^output$/i.test(n)) return "output";
  if (/text-to-speech|\btts\b/i.test(n)) return "tts";
  if (/speech|voice|audio|\bstt\b|transcri/i.test(n)) return "stt";
  if (/retriev|\brag\b|vector|embed|search|knowledge/i.test(n)) return "rag";
  if (/agent|tool/i.test(n)) return "agent";
  if (/\b(llm|gpt|model|claude|gemini)\b/i.test(n)) return "llm";
  return "generic";
}

const MODEL = /\b(openai|gpt|anthropic|claude|gemini|groq|ollama|llama|mistral|cohere|bedrock|deepseek|hugging ?face|replicate)\b/i;
const VECTOR = /\b(qdrant|pinecone|weaviate|chroma|pgvector|milvus|vector)\b/i;
const FRAMEWORK = /\b(langchain|langgraph|llamaindex|ai sdk|crewai|autogen)\b/i;
const SPEECH = /\b(whisper|deepgram|elevenlabs|assemblyai)\b/i;
/** Tools that read source code (a code-analysis system takes code in, not a chat prompt). */
const CODE = /\b(vs ?code|ts-morph|tree-sitter)\b/i;

export type AiRoles = {
  input: InputKind;
  /** Model providers / runtimes (the LLM stage). */
  models: string[];
  /** Vector databases (the retrieval stage). */
  stores: string[];
  /** Agent / orchestration frameworks (the agent stage). */
  frameworks: string[];
  /** Speech services (speech-to-text / text-to-speech stages). */
  speech: string[];
};

/** The roles of a project's technologies inside its AI system (DB names, DB order). */
export function aiRoles(stages: readonly string[], tech: readonly string[]): AiRoles {
  const pick = (re: RegExp) => tech.filter((t) => re.test(t));
  const kinds = stages.map(stageKind);
  return {
    input: kinds.includes("stt") ? "voice" : tech.some((t) => CODE.test(t)) ? "code" : "chat",
    models: pick(MODEL),
    stores: pick(VECTOR),
    frameworks: pick(FRAMEWORK),
    speech: pick(SPEECH),
  };
}

/** The technology line under a stage (empty when the project names none for it). */
export function stageTech(kind: StageKind, roles: AiRoles): string {
  const list =
    kind === "llm"
      ? roles.models
      : kind === "rag"
        ? roles.stores
        : kind === "agent"
          ? roles.frameworks
          : kind === "stt" || kind === "tts"
            ? roles.speech
            : [];
  return list.join(" · ");
}
