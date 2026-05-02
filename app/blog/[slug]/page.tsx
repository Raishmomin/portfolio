import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Navbar } from "../../../components/navbar";
import { Footer } from "../../../components/footer";
import { SITE, SITE_URL } from "@/lib/config";
import { Calendar, Clock, ArrowLeft, Tag } from "lucide-react";
import clientPromise from "@/lib/mongodb";
import type { BlogPost } from "@/lib/blog-types";

export const dynamic = "force-dynamic";

async function getPost(slug: string): Promise<BlogPost | null> {
    try {
        const client = await clientPromise;
        const db = client.db("Portfolio");
        const post = await db.collection("blogs").findOne({ slug });
        if (!post) return null;
        return JSON.parse(JSON.stringify(post));
    } catch {
        return null;
    }
}

export async function generateMetadata({
    params,
}: {
    params: { slug: string };
}): Promise<Metadata> {
    const post = await getPost(params.slug);
    if (!post) return { title: "Post Not Found" };

    return {
        title: post.title,
        description: post.excerpt,
        alternates: { canonical: `${SITE_URL}/blog/${post.slug}` },
        openGraph: {
            title: `${post.title} — ${SITE.name}`,
            description: post.excerpt,
            url: `${SITE_URL}/blog/${post.slug}`,
            type: "article",
            publishedTime: new Date(post.publishedAt).toISOString(),
            authors: [SITE.name],
            tags: post.tags,
        },
        twitter: {
            card: "summary_large_image",
            title: post.title,
            description: post.excerpt,
        },
    };
}

function formatDate(date: string | Date): string {
    return new Date(date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });
}

/** Basic markdown → HTML (headings, code blocks, bold, italic, links, lists) */
function renderMarkdown(md: string): string {
    let html = md
        // Fenced code blocks
        .replace(
            /```(\w+)?\n([\s\S]*?)```/g,
            (_m, lang, code) =>
                `<pre class="blog-pre"><code class="language-${lang || "text"}">${code
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")}</code></pre>`
        )
        // Inline code
        .replace(/`([^`]+)`/g, '<code class="blog-inline-code">$1</code>')
        // Headings
        .replace(
            /^### (.+)$/gm,
            '<h3 class="text-lg font-semibold tracking-tight text-foreground mt-8 mb-3">$1</h3>'
        )
        .replace(
            /^## (.+)$/gm,
            '<h2 class="text-xl font-semibold tracking-tight text-foreground mt-10 mb-4">$1</h2>'
        )
        // Bold / italic
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.+?)\*/g, "<em>$1</em>")
        // Links
        .replace(
            /\[([^\]]+)\]\(([^)]+)\)/g,
            '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-foreground underline underline-offset-4 hover:text-foreground/70 transition-colors">$1</a>'
        )
        // Unordered lists
        .replace(/^- (.+)$/gm, '<li class="blog-li">$1</li>')
        // Numbered lists
        .replace(/^\d+\. (.+)$/gm, '<li class="blog-li">$1</li>');

    // Wrap consecutive <li> in <ul>
    html = html.replace(
        /(<li class="blog-li">[\s\S]*?<\/li>\n?)+/g,
        (match) =>
            `<ul class="space-y-2 pl-5 my-4 text-muted-foreground list-disc">${match}</ul>`
    );

    // Paragraphs: wrap remaining bare lines
    html = html
        .split("\n\n")
        .map((block) => {
            const trimmed = block.trim();
            if (!trimmed) return "";
            if (
                trimmed.startsWith("<h") ||
                trimmed.startsWith("<pre") ||
                trimmed.startsWith("<ul") ||
                trimmed.startsWith("<ol")
            )
                return trimmed;
            return `<p class="text-base text-muted-foreground leading-relaxed mb-4">${trimmed}</p>`;
        })
        .join("\n");

    return html;
}

export default async function BlogPostPage({
    params,
}: {
    params: { slug: string };
}) {
    const post = await getPost(params.slug);
    if (!post) notFound();

    return (
        <>
            <Navbar />
            <main className="relative pt-24">
                <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
                    {/* Back link */}
                    <Link
                        href="/blog"
                        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-12 group"
                    >
                        <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
                        Back to blog
                    </Link>

                    {/* Header */}
                    <header className="mb-12">
                        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mb-6">
                            <span className="inline-flex items-center gap-1.5">
                                <Calendar className="w-3 h-3" />
                                {formatDate(post.publishedAt)}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                                <Clock className="w-3 h-3" />
                                {post.readTime} min read
                            </span>
                        </div>

                        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground leading-tight mb-6">
                            {post.title}
                        </h1>

                        <p className="text-lg text-muted-foreground leading-relaxed">
                            {post.excerpt}
                        </p>

                        {/* Tags */}
                        <div className="flex flex-wrap gap-2 mt-6">
                            {post.tags.map((tag) => (
                                <span
                                    key={tag}
                                    className="inline-flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-full border border-border text-muted-foreground"
                                >
                                    <Tag className="w-2.5 h-2.5" />
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </header>

                    {/* Divider */}
                    <div className="h-px bg-border mb-12" />

                    {/* Content */}
                    <div
                        className="blog-content"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(post.content) }}
                    />

                    {/* Footer nav */}
                    <div className="mt-16 pt-8 border-t border-border">
                        <Link
                            href="/blog"
                            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
                        >
                            <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
                            All posts
                        </Link>
                    </div>
                </article>
            </main>
            <Footer />
        </>
    );
}
