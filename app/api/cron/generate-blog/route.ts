export const dynamic = "force-dynamic";
export const maxDuration = 60; // Allow up to 60s for AI generation

import clientPromise from "@/lib/mongodb";
import { NextRequest, NextResponse } from "next/server";

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
            max_tokens: 2048,
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
        const topicPrompt = `You are a tech blog topic generator for a full-stack developer's portfolio blog.

The blog focuses on these areas: ${TOPICS.join(", ")}.

These blog posts already exist (DO NOT repeat any of them):
${existingTitles.length > 0 ? existingTitles.map((t) => `- ${t}`).join("\n") : "- (none yet)"}

Suggest exactly ONE new, unique, and specific blog post title. The title should be practical and actionable (e.g., "How to Build a Real-Time Chat App with WebSockets and Node.js").

Return ONLY the title, nothing else. No quotes, no numbering, no explanation.`;

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
        const contentPrompt = `Write a technical blog post with the title: "${title}"

Requirements:
- Write 600-800 words
- Use markdown formatting with ## headings
- Include practical code examples where relevant (use fenced code blocks with language)
- Make it informative and actionable
- Write in a professional but approachable tone

At the very end, on separate lines, provide:
EXCERPT: (a compelling 1-2 sentence summary)
TAGS: (3-5 comma-separated tags like AI, React, Node.js)

Do NOT include the title as a heading in the content (it will be rendered separately).`;

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
        const post = {
            title,
            slug,
            excerpt,
            content,
            tags,
            readTime: estimateReadTime(content),
            publishedAt: new Date(),
            generatedBy: MODEL,
        };

        const result = await blogsCol.insertOne(post);

        return NextResponse.json({
            success: true,
            insertedId: result.insertedId,
            title,
            slug,
        });
    } catch (error) {
        console.error("Blog generation error:", error);
        return NextResponse.json(
            { error: "Failed to generate blog", details: String(error) },
            { status: 500 }
        );
    }
}
