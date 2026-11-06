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
import { Accent, ButtonLink, Container } from "../../components/ui/primitives";
import { ContactBand, PageMotif, SubpageHeader } from "../../components/pages/projects/subpage-header";
import { PostList } from "../../components/pages/blog/post-list";

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
    const posts = (await getPosts()).map((p) => ({ ...p, tags: postTags(p.tags) }));

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
                <SubpageHeader
                    kicker={`~/blog · ${posts.length} posts`}
                    title={
                        <>
                            Thoughts &amp; <Accent>tutorials.</Accent>
                        </>
                    }
                    lead="Writing about AI, full-stack development, DevOps, and things I've learned shipping production apps."
                    aside={<PageMotif label="neural · writing" value={`${posts.length} posts`} />}
                >
                    <p className="mt-8 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
                        <a
                            href={RSS_URL}
                            className="inline-flex min-h-11 items-center gap-2 rounded-sm transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <span aria-hidden="true">◉</span>
                            Subscribe via RSS
                        </a>
                    </p>
                </SubpageHeader>

                <section aria-label="All posts" className="border-t border-border">
                    <Container className="pb-8">
                        {posts.length === 0 ? (
                            <div className="py-20">
                                <h2 className="text-xl font-semibold tracking-tight text-foreground">Coming soon.</h2>
                                <p className="mt-3 max-w-md text-sm text-muted-foreground">
                                    I&apos;m working on some posts. New articles are published
                                    daily — check back soon!
                                </p>
                            </div>
                        ) : (
                            <PostList posts={posts} />
                        )}
                    </Container>
                </section>

                <ContactBand
                    title={
                        <>
                            Need this built, <Accent>not just written up?</Accent>
                        </>
                    }
                >
                    <ButtonLink href="/services">See services</ButtonLink>
                    <ButtonLink href="/contact" variant="ghost">
                        Get in touch
                    </ButtonLink>
                </ContactBand>
            </main>
            <Footer />
        </>
    );
}
