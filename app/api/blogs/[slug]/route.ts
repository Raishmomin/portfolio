export const dynamic = "force-dynamic";

import clientPromise from "@/lib/mongodb";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
    _req: NextRequest,
    { params }: { params: { slug: string } }
) {
    try {
        const { slug } = params;
        const client = await clientPromise;
        const db = client.db("Portfolio");
        const post = await db.collection("blogs").findOne({ slug });

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
