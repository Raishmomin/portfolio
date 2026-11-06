import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { Navbar } from "../../components/navbar";
import { Footer } from "../../components/footer";
import { PageJsonLd } from "../../components/page-json-ld";
import { RSS_URL, buildMetadata, breadcrumbList } from "@/lib/seo";
import { SITE, SITE_URL } from "@/lib/config";
import { TAGS } from "@/lib/cache-tags";
import clientPromise from "@/lib/mongodb";
import type { BlogPostSummary } from "@/lib/blog-types";
import { LISTED_POSTS, POST_SUMMARY_PROJECTION, plainExcerpt, postTags, postTitle } from "@/lib/blog";
import { Accent, ButtonLink } from "../../components/ui/primitives";
import { PostList, TopicTicker } from "../../components/pages/blog/post-list";
import { CtaSection } from "../../components/pages/cta";
import { PageIntro, PageSection, SectionHead } from "../../components/pages/ui";
import { pageNeuralData } from "../../components/pages/neural";
import { NeuralStage } from "../../components/neural";

export const revalidate = 3600;

export const metadata: Metadata = buildMetadata({
    path: "/blog",
    title: "Blog",
    description: `Thoughts, tutorials, and dev notes by ${SITE.name} — covering AI, React, Node.js, DevOps, and full-stack engineering.`,
    keywords: [
        "Raish Momin blog",
        "React tutorials",
        "Next.js tutorials",
        "Node.js tutorials",
        "DevOps notes",
        "Full Stack engineering blog",
        "AI engineering",
    ],
});

// DB errors throw (never cached), so a failed ISR revalidation keeps the last good output.
const getPosts = unstable_cache(
    async (): Promise<BlogPostSummary[]> => {
        const client = await clientPromise;
        const db = client.db("Portfolio");
        const posts = await db
            .collection("blogs")
            .find(LISTED_POSTS, { projection: POST_SUMMARY_PROJECTION })
            .sort({ publishedAt: -1 })
            .toArray();
        return JSON.parse(JSON.stringify(posts));
    },
    ["blog-posts-list"],
    { tags: [TAGS.blogs], revalidate: 3600 }
);

export default async function BlogPage() {
    const [rows, neural] = await Promise.all([getPosts(), pageNeuralData()]);
    const posts = rows.map((p) => ({ ...p, tags: postTags(p.tags) }));

    const schema: object[] = [
        {
            "@context": "https://schema.org",
            "@type": "Blog",
            "@id": `${SITE_URL}/blog#blog`,
            url: `${SITE_URL}/blog`,
            name: `Blog — ${SITE.name}`,
            description: metadata.description as string,
            inLanguage: "en-US",
            author: { "@id": `${SITE_URL}#person` },
            publisher: { "@id": `${SITE_URL}#person` },
            blogPost: posts.slice(0, 10).map((p) => ({
                "@type": "BlogPosting",
                headline: postTitle(p.title),
                description: plainExcerpt(p.excerpt),
                url: `${SITE_URL}/blog/${p.slug}`,
                datePublished: new Date(p.publishedAt).toISOString(),
                keywords: p.tags?.join(", "),
                author: { "@id": `${SITE_URL}#person` },
            })),
        },
        breadcrumbList([
            { name: "Home", path: "/" },
            { name: "Blog", path: "/blog" },
        ]),
    ];

    return (
        <>
            <PageJsonLd data={schema} />
            <Navbar />
            <main id="main" tabIndex={-1} className="relative outline-none">
                <NeuralStage data={neural} />
                <PageIntro
                    crumbs={[{ name: "Home", href: "/" }, { name: "Blog" }]}
                    kicker={`~/blog · ${posts.length} posts`}
                    scene="ambient"
                    title={
                        <>
                            Thoughts &amp; <Accent>tutorials.</Accent>
                        </>
                    }
                    lead="Writing about AI, full-stack development, DevOps, and things I've learned shipping production apps."
                >
                    <div className="mt-9 flex flex-wrap gap-3">
                        <ButtonLink href="#posts" data-magnetic="">
                            Read the latest <span aria-hidden="true">↓</span>
                        </ButtonLink>
                        <ButtonLink href={RSS_URL} variant="ghost">
                            <span aria-hidden="true">◉</span>
                            Subscribe via RSS
                        </ButtonLink>
                    </div>
                </PageIntro>

                <PageSection id="posts" section="posts" scene="ambient" stage="full" labelledBy="posts-heading">
                    <SectionHead
                        id="posts-heading"
                        index="01"
                        kicker="posts"
                        center
                        title={
                            <>
                                Notes from <Accent>the build.</Accent>
                            </>
                        }
                        lead="Newest first. Each post is a short, practical write-up of something I shipped or debugged."
                    />
                    <TopicTicker posts={posts} />
                    <div className="mt-10">
                        {posts.length === 0 ? (
                            <div className="panel mx-auto max-w-xl p-8 text-center">
                                <h3 className="text-xl font-semibold tracking-tight text-foreground">Coming soon.</h3>
                                <p className="mt-3 text-sm text-muted-foreground">
                                    I&apos;m working on some posts. New articles are published
                                    daily — check back soon!
                                </p>
                            </div>
                        ) : (
                            <PostList posts={posts} />
                        )}
                    </div>
                </PageSection>

                <CtaSection
                    stage="band"
                    index="02"
                    title={
                        <>
                            Need this built, <Accent>not just written up?</Accent>
                        </>
                    }
                    primary={{ href: "/services", label: "See services" }}
                    secondary={{ href: "/contact", label: "Get in touch" }}
                />
            </main>
            <Footer />
        </>
    );
}
