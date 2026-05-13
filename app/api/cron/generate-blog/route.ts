export const dynamic = "force-dynamic";
export const maxDuration = 60; // Allow up to 60s for AI generation

import clientPromise from "@/lib/mongodb";
import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { TAGS } from "@/lib/cache-tags";

const NVIDIA_API_URL =
    "https://integrate.api.nvidia.com/v1/chat/completions";
const MODEL = "meta/llama-3.1-8b-instruct";

const TOPICS = [
    "artificial intelligence",
    "machine learning",
    "large language models",
    "React.js",
    "Next.js",
    "Node.js",
    "TypeScript",
    "DevOps",
    "cloud engineering",
    "Docker",
    "Kubernetes",
    "CI/CD pipelines",
    "web performance",
    "full-stack development",
    "serverless architecture",
    "database optimization",
    "API design",
    "prompt engineering",
    "RAG systems",
    "edge computing",
];

function slugify(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

function estimateReadTime(content: string): number {
    const words = content.split(/\s+/).length;
    return Math.max(1, Math.ceil(words / 200));
}

async function callNvidia(prompt: string): Promise<string> {
    const apiKey = process.env.NVIDIA_API_KEY;
    if (!apiKey) throw new Error("NVIDIA_API_KEY not configured");

    const res = await fetch(NVIDIA_API_URL, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: MODEL,
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
            max_tokens: 4096,
        }),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`NVIDIA API error (${res.status}): ${err}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || "";
}

export async function GET(req: NextRequest) {
    // ── Auth: accept both Vercel cron header and Bearer token ──
    const isVercelCron =
        req.headers.get("x-vercel-cron") !== null;
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret) {
        const bearerValid =
            authHeader === `Bearer ${cronSecret}`;
        if (!isVercelCron && !bearerValid) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
    }

    try {
        const client = await clientPromise;
        const db = client.db("Portfolio");
        const blogsCol = db.collection("blogs");

        // ── 1. Get existing titles for duplicate avoidance ──
        const existing = await blogsCol
            .find({}, { projection: { title: 1 } })
            .toArray();
        const existingTitles = existing.map((d) => d.title);

        // ── 2. Generate a unique topic ──
        const topicPrompt = `You generate blog post titles for a senior full-stack developer's portfolio. The site targets freelance hire intent + technical authority. Audience: working engineers, CTOs, and engineering managers searching Google.

Focus areas: ${TOPICS.join(", ")}.

Existing titles (DO NOT repeat, DO NOT use near-synonyms):
${existingTitles.length > 0 ? existingTitles.map((t) => `- ${t}`).join("\n") : "- (none yet)"}

Generate ONE new title that meets ALL of these rules:
1. 8–14 words, specific enough to map to a single Google search query
2. Includes a concrete tool/version (e.g. "Next.js 14", "Node 20", "Mongo 7", "Postgres 16")
3. Promises a SPECIFIC outcome, lesson, or comparison — not a generic overview
4. Avoids clickbait formulas ("Ultimate Guide", "Everything You Need", "The Complete")
5. Reads like an experienced engineer wrote it, not marketing

Good examples:
- "Cutting Next.js 14 cold starts from 3.2s to 400ms with PPR and edge runtime"
- "When MongoDB compound indexes actually help (and the 4 times they hurt)"
- "Server Components data fetching: 5 patterns that survived production"

Return ONLY the title — no quotes, no numbering, no preamble.`;

        const title = (await callNvidia(topicPrompt)).replace(/^["']|["']$/g, "");
        const slug = slugify(title);

        // ── 3. Check duplicate by slug ──
        const existingSlug = await blogsCol.findOne({ slug });
        if (existingSlug) {
            return NextResponse.json({
                message: "Skipped — duplicate slug detected",
                slug,
            });
        }

        // ── 4. Generate the full blog post ──
        const contentPrompt = `You are writing a deep technical blog post for a senior full-stack engineer's portfolio. Target audience: working developers, tech leads, and CTOs. The voice is direct, opinionated, and grounded in production experience — never marketing.

Title: "${title}"

REQUIRED STRUCTURE (use markdown):

## The problem
2–3 paragraphs framing the concrete production problem this post solves. Use specific scenarios ("when traffic spikes past X RPS…", "when a Mongo collection grows past Y docs…"). Avoid platitudes.

## How most teams get this wrong
1–2 paragraphs naming the common anti-patterns. Be specific. Reference real failure modes (cache stampedes, N+1 queries, cold-start cascades, schema drift, etc.).

## The approach that works
The core of the post: 3–5 subsections (### subheadings) explaining the solution. Each subsection must include either a code block OR a concrete numeric example (latency numbers, query counts, bundle sizes, dollar amounts). Show, don't tell.

## A working example
A self-contained code example (30–80 lines) that a reader could paste and run, with brief inline comments where non-obvious. Use a fenced code block with the correct language tag.

## When this approach is wrong
1 paragraph — honest tradeoffs. Every real engineering choice has a "don't use this if…" caveat. Skipping this section makes the post sound like marketing.

## Takeaways
Bulleted list of 4–6 short, declarative lessons.

WRITING RULES:
- 1500–2000 words total
- First person ("I", "we") — confident, not hedging. Avoid "it's important to" / "make sure to" filler.
- Use specific tools and versions (Next.js 14, Node 20 LTS, Mongo 7, Postgres 16) — never vague "modern frameworks".
- Code blocks must have language tags (\`\`\`typescript, \`\`\`javascript, \`\`\`bash, \`\`\`sql, etc.).
- DO NOT fabricate specific client names, company logos, or named case studies. Generic patterns ("a SaaS client", "a fintech team") are fine.
- DO NOT include the title as a heading — it's rendered separately.
- DO NOT add a "Conclusion" heading — the Takeaways section closes the post.

After the post, on separate lines (NOT inside the article):
EXCERPT: 1–2 sentence summary, written to make a developer click. ≤180 chars.
TAGS: 4–6 comma-separated tags. Use Title Case. Prefer specific tags (Next.js, Server Components, MongoDB) over generic ones (Web, Coding). Include the primary tool/framework as the first tag.`;

        const raw = await callNvidia(contentPrompt);

        // ── 5. Parse response ──
        let content = raw;
        let excerpt = "";
        let tags: string[] = [];

        const excerptMatch = raw.match(/EXCERPT:\s*(.+)/i);
        if (excerptMatch) {
            excerpt = excerptMatch[1].trim();
            content = content.replace(/EXCERPT:\s*.+/i, "").trim();
        }

        const tagsMatch = raw.match(/TAGS:\s*(.+)/i);
        if (tagsMatch) {
            tags = tagsMatch[1]
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean);
            content = content.replace(/TAGS:\s*.+/i, "").trim();
        }

        if (!excerpt) {
            excerpt = content.slice(0, 160).replace(/\n/g, " ").trim() + "…";
        }
        if (tags.length === 0) {
            tags = ["Tech", "Development"];
        }

        // ── 6. Save to MongoDB ──
        const now = new Date();
        const post = {
            title,
            slug,
            excerpt,
            content,
            tags,
            readTime: estimateReadTime(content),
            publishedAt: now,
            updatedAt: now,
            published: true,
            generatedBy: MODEL,
        };

        const result = await blogsCol.insertOne(post);

        revalidateTag(TAGS.blogs);

        return NextResponse.json({
            success: true,
            insertedId: result.insertedId,
            title,
            slug,
            published: true,
            wordCount: content.split(/\s+/).filter(Boolean).length,
        });
    } catch (error) {
        console.error("Blog generation error:", error);
        return NextResponse.json(
            { error: "Failed to generate blog", details: String(error) },
            { status: 500 }
        );
    }
}
