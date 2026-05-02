import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "../../components/navbar";
import { Footer } from "../../components/footer";
import { SITE, SITE_URL } from "@/lib/config";
import { Calendar, Clock, ArrowRight, Rss } from "lucide-react";
import clientPromise from "@/lib/mongodb";
import type { BlogPost } from "@/lib/blog-types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Blog",
    description: `Thoughts, tutorials, and dev notes by ${SITE.name} — covering AI, React, Node.js, DevOps, and full-stack engineering.`,
    alternates: { canonical: `${SITE_URL}/blog` },
    openGraph: {
        title: `Blog — ${SITE.name}`,
        description:
            "Thoughts, tutorials, and dev notes on full-stack engineering, DevOps, and modern web development.",
        url: `${SITE_URL}/blog`,
    },
};

async function getPosts(): Promise<BlogPost[]> {
    try {
        const client = await clientPromise;
        const db = client.db("Portfolio");
        const posts = await db
            .collection("blogs")
            .find({})
            .sort({ publishedAt: -1 })
            .toArray();
        return JSON.parse(JSON.stringify(posts));
    } catch {
        return [];
    }
}

function formatDate(date: string | Date): string {
    return new Date(date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });
}

export default async function BlogPage() {
    const posts = await getPosts();

    return (
        <>
            <Navbar />
            <main className="relative pt-24">
                <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
                    {/* Header */}
                    <div className="text-center mb-16 md:mb-24">
                        <span className="inline-flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-muted-foreground mb-8">
                            <span className="h-px w-8 bg-muted-foreground/40" />
                            Blog
                            <span className="h-px w-8 bg-muted-foreground/40" />
                        </span>
                        <h1 className="heading-fluid font-semibold text-foreground mb-6">
                            Thoughts &amp; tutorials.
                        </h1>
                        <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                            Writing about AI, full-stack development, DevOps, and things
                            I&apos;ve learned shipping production apps.
                        </p>
                    </div>

                    {posts.length === 0 ? (
                        /* Empty state */
                        <div className="text-center py-20">
                            <div className="grid place-items-center w-16 h-16 mx-auto mb-8 rounded-2xl border border-border bg-card">
                                <Rss className="w-6 h-6 text-muted-foreground" />
                            </div>
                            <h2 className="text-xl font-semibold tracking-tight mb-3">
                                Coming soon.
                            </h2>
                            <p className="text-sm text-muted-foreground max-w-md mx-auto">
                                I&apos;m working on some posts. New articles are published
                                daily — check back soon!
                            </p>
                        </div>
                    ) : (
                        /* Blog grid */
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {posts.map((post, i) => (
                                <Link
                                    key={post.slug}
                                    href={`/blog/${post.slug}`}
                                    className="group block focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background rounded-2xl"
                                >
                                    <article className="relative h-full overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-foreground/40 flex flex-col p-7 md:p-8">
                                        {/* Tags */}
                                        <div className="flex flex-wrap gap-1.5 mb-6">
                                            {post.tags.slice(0, 3).map((tag) => (
                                                <span
                                                    key={tag}
                                                    className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground"
                                                >
                                                    {tag}
                                                    {post.tags.indexOf(tag) <
                                                        Math.min(post.tags.length, 3) - 1 && (
                                                            <span className="mx-2">·</span>
                                                        )}
                                                </span>
                                            ))}
                                        </div>

                                        {/* Title */}
                                        <h2 className="text-xl font-semibold tracking-tight text-foreground mb-3 group-hover:text-foreground/80 transition-colors">
                                            {post.title}
                                        </h2>

                                        {/* Excerpt */}
                                        <p className="text-sm text-muted-foreground leading-relaxed mb-6 flex-1">
                                            {post.excerpt}
                                        </p>

                                        {/* Meta */}
                                        <div className="flex items-center justify-between pt-4 border-t border-border text-xs text-muted-foreground">
                                            <div className="flex items-center gap-4">
                                                <span className="inline-flex items-center gap-1.5">
                                                    <Calendar className="w-3 h-3" />
                                                    {formatDate(post.publishedAt)}
                                                </span>
                                                <span className="inline-flex items-center gap-1.5">
                                                    <Clock className="w-3 h-3" />
                                                    {post.readTime} min read
                                                </span>
                                            </div>
                                            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                                        </div>
                                    </article>
                                </Link>
                            ))}
                        </div>
                    )}
                </section>
            </main>
            <Footer />
        </>
    );
}
