export const dynamic = "force-dynamic";

import clientPromise from "@/lib/mongodb";
import { NextRequest, NextResponse } from "next/server";
import { LISTED_POSTS } from "@/lib/blog";

// Drafts (published: false) and consolidated (301) slugs 404, as the pages do.

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const { slug } = await params;
        const client = await clientPromise;
        const db = client.db("Portfolio");
        const post = await db
            .collection("blogs")
            .findOne({ $and: [LISTED_POSTS, { slug }] });

        if (!post) {
            return NextResponse.json({ error: "Post not found" }, { status: 404 });
        }

        return NextResponse.json({ post });
    } catch (error) {
        console.error("Blog GET Error:", error);
        return NextResponse.json(
            { error: "Failed to fetch blog post" },
            { status: 500 }
        );
    }
}
